const pool = require('../config/db');
const { getLedgerByEntity, getLedgerByName, postEntry, getNextNumber } = require('./ledgerService');
const { adjustStock } = require('./stockService');

// ─── GST calculation helper ───────────────────────────────────────────────
// is_igst = true → inter-state → full IGST
// is_igst = false → intra-state → split CGST + SGST
const calcGST = (taxableAmount, gstPct, isIgst) => {
  const total = (taxableAmount * gstPct) / 100;
  if (isIgst) return { cgst: 0, sgst: 0, igst: parseFloat(total.toFixed(2)) };
  const half = parseFloat((total / 2).toFixed(2));
  return { cgst: half, sgst: half, igst: 0 };
};

// ─── create invoice (sales voucher) ──────────────────────────────────────
// items: [{ stock_item_id, quantity, unit_price, gst_percentage }]
// invoice_type: 'gst_invoice' | 'proforma' | 'quotation' | 'estimate'
// Only 'gst_invoice' affects stock and ledgers.
const createInvoice = async ({ customer_id, items, invoice_type = 'gst_invoice', is_igst = false, notes }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invoiceNumber = await getNextNumber(client, 'invoice');

    // compute all line items
    let subtotal = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
    const processedItems = items.map(item => {
      const taxable = parseFloat((item.quantity * item.unit_price).toFixed(2));
      const { cgst, sgst, igst } = calcGST(taxable, item.gst_percentage, is_igst);
      const lineTotal = parseFloat((taxable + cgst + sgst + igst).toFixed(2));
      subtotal    += taxable;
      totalCgst   += cgst;
      totalSgst   += sgst;
      totalIgst   += igst;
      return { ...item, taxable_amount: taxable, cgst, sgst, igst, line_total: lineTotal };
    });

    const totalTax    = parseFloat((totalCgst + totalSgst + totalIgst).toFixed(2));
    const totalAmount = parseFloat((subtotal + totalTax).toFixed(2));

    // insert invoice header
    const invResult = await client.query(
      `INSERT INTO invoices
       (invoice_number, invoice_type, customer_id, is_igst,
        subtotal, total_cgst, total_sgst, total_igst, total_tax, total_amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [invoiceNumber, invoice_type, customer_id, is_igst,
       subtotal, totalCgst, totalSgst, totalIgst, totalTax, totalAmount, notes || null]
    );
    const invoice = invResult.rows[0];

    // insert line items
    for (const item of processedItems) {
      await client.query(
        `INSERT INTO invoice_items
         (invoice_id, stock_item_id, quantity, unit_price, gst_percentage,
          taxable_amount, cgst, sgst, igst, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [invoice.id, item.stock_item_id, item.quantity, item.unit_price,
         item.gst_percentage, item.taxable_amount, item.cgst, item.sgst, item.igst, item.line_total]
      );

      // only reduce stock for actual invoices, not quotations/proforma
      if (invoice_type === 'gst_invoice') {
        await adjustStock(client, item.stock_item_id, item.quantity, 'stock_out',
          invoice.id, 'invoice', `Invoice ${invoiceNumber}`);
      }
    }

    // double-entry ledger postings (only for gst_invoice)
    if (invoice_type === 'gst_invoice') {
      // DR Customer — they owe us the full amount
      const custLedger = await getLedgerByEntity(customer_id, 'customer', client);
      await postEntry(client, custLedger.id, 'debit', totalAmount,
        `Invoice ${invoiceNumber}`, invoice.id, 'invoice');

      // CR Sales Income — revenue (subtotal only, excl. GST)
      const salesLedger = await getLedgerByName('Sales Income', client);
      await postEntry(client, salesLedger.id, 'credit', subtotal,
        `Invoice ${invoiceNumber}`, invoice.id, 'invoice');

      // CR GST Payable
      if (totalCgst > 0) {
        const l = await getLedgerByName('GST Payable (CGST)', client);
        await postEntry(client, l.id, 'credit', totalCgst, `Invoice ${invoiceNumber}`, invoice.id, 'invoice');
      }
      if (totalSgst > 0) {
        const l = await getLedgerByName('GST Payable (SGST)', client);
        await postEntry(client, l.id, 'credit', totalSgst, `Invoice ${invoiceNumber}`, invoice.id, 'invoice');
      }
      if (totalIgst > 0) {
        const l = await getLedgerByName('GST Payable (IGST)', client);
        await postEntry(client, l.id, 'credit', totalIgst, `Invoice ${invoiceNumber}`, invoice.id, 'invoice');
      }
    }

    await client.query('COMMIT');
    return await getInvoiceById(invoice.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── get full invoice with customer + items ────────────────────────────────
const getInvoiceById = async (id) => {
  const invRes = await pool.query(
    `SELECT i.*, TO_CHAR(i.created_at,'DD Mon YYYY') AS date
     FROM invoices i WHERE i.id=$1`, [id]
  );
  if (!invRes.rows.length) return null;
  const invoice = invRes.rows[0];

  const customer = await pool.query(
    `SELECT name, mobile, email, address, gstin FROM customers WHERE id=$1`,
    [invoice.customer_id]
  );

  const items = await pool.query(
    `SELECT ii.*, si.name AS item_name, u.name AS unit
     FROM invoice_items ii
     JOIN stock_items si ON si.id = ii.stock_item_id
     LEFT JOIN units u ON u.id = si.unit_id
     WHERE ii.invoice_id=$1`,
    [id]
  );

  return { ...invoice, customer: customer.rows[0], items: items.rows };
};

// ─── list invoices with optional filters ──────────────────────────────────
const getAllInvoices = async ({ customer_id, status, invoice_type, from_date, to_date } = {}) => {
  let q = `
    SELECT i.*, c.name AS customer_name,
           TO_CHAR(i.created_at,'DD Mon YYYY') AS date
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    WHERE 1=1
  `;
  const p = [];

  if (customer_id) { p.push(customer_id); q += ` AND i.customer_id=$${p.length}`; }
  if (status)      { p.push(status);      q += ` AND i.status=$${p.length}`; }
  if (invoice_type){ p.push(invoice_type);q += ` AND i.invoice_type=$${p.length}`; }
  if (from_date)   { p.push(from_date);   q += ` AND i.created_at >= $${p.length}`; }
  if (to_date)     { p.push(to_date);     q += ` AND i.created_at <= $${p.length}`; }

  q += ` ORDER BY i.created_at DESC`;
  const result = await pool.query(q, p);
  return result.rows;
};

// ─── cancel invoice (reverses stock and ledger) ───────────────────────────
const cancelInvoice = async (id) => {
  const invoice = await getInvoiceById(id);
  if (!invoice) { const e = new Error('Invoice not found'); e.status = 404; throw e; }
  if (invoice.status === 'cancelled') {
    const e = new Error('Invoice already cancelled'); e.status = 400; throw e;
  }
  if (invoice.status === 'paid') {
    const e = new Error('Cannot cancel a paid invoice'); e.status = 400; throw e;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (invoice.invoice_type === 'gst_invoice') {
      // reverse stock
      for (const item of invoice.items) {
        await adjustStock(client, item.stock_item_id, item.quantity, 'stock_in',
          id, 'invoice_cancel', `Cancelled Invoice ${invoice.invoice_number}`);
      }

      // reverse ledger entries
      const custLedger = await getLedgerByEntity(invoice.customer_id, 'customer', client);
      await postEntry(client, custLedger.id, 'credit', invoice.total_amount,
        `Cancel ${invoice.invoice_number}`, id, 'invoice_cancel');

      const salesLedger = await getLedgerByName('Sales Income', client);
      await postEntry(client, salesLedger.id, 'debit', invoice.subtotal,
        `Cancel ${invoice.invoice_number}`, id, 'invoice_cancel');

      if (invoice.total_cgst > 0) {
        const l = await getLedgerByName('GST Payable (CGST)', client);
        await postEntry(client, l.id, 'debit', invoice.total_cgst, `Cancel ${invoice.invoice_number}`, id, 'invoice_cancel');
      }
      if (invoice.total_sgst > 0) {
        const l = await getLedgerByName('GST Payable (SGST)', client);
        await postEntry(client, l.id, 'debit', invoice.total_sgst, `Cancel ${invoice.invoice_number}`, id, 'invoice_cancel');
      }
      if (invoice.total_igst > 0) {
        const l = await getLedgerByName('GST Payable (IGST)', client);
        await postEntry(client, l.id, 'debit', invoice.total_igst, `Cancel ${invoice.invoice_number}`, id, 'invoice_cancel');
      }
    }

    await client.query(`UPDATE invoices SET status='cancelled' WHERE id=$1`, [id]);
    await client.query('COMMIT');
    return { message: `Invoice ${invoice.invoice_number} cancelled` };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── credit note (sales return) ───────────────────────────────────────────
// items: [{ stock_item_id, quantity, unit_price, gst_percentage, cgst, sgst, igst }]
const createCreditNote = async ({ invoice_id, customer_id, items, reason }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cnNumber = await getNextNumber(client, 'credit_note');
    let totalReturn = 0, returnSubtotal = 0, returnCgst = 0, returnSgst = 0, returnIgst = 0;

    const cnResult = await client.query(
      `INSERT INTO credit_notes (credit_note_number, invoice_id, customer_id, reason, total_amount)
       VALUES ($1,$2,$3,$4,0) RETURNING *`,
      [cnNumber, invoice_id, customer_id, reason || null]
    );
    const cn = cnResult.rows[0];

    for (const item of items) {
      const taxable = parseFloat((item.quantity * item.unit_price).toFixed(2));
      const lineTotal = parseFloat((taxable + item.cgst + item.sgst + item.igst).toFixed(2));

      await client.query(
        `INSERT INTO credit_note_items
         (credit_note_id, stock_item_id, quantity, unit_price, gst_percentage, cgst, sgst, igst, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cn.id, item.stock_item_id, item.quantity, item.unit_price,
         item.gst_percentage, item.cgst, item.sgst, item.igst, lineTotal]
      );

      // stock comes back
      await adjustStock(client, item.stock_item_id, item.quantity, 'stock_in',
        cn.id, 'credit_note', `Credit Note ${cnNumber}`);

      returnSubtotal += taxable;
      returnCgst     += item.cgst;
      returnSgst     += item.sgst;
      returnIgst     += item.igst;
      totalReturn    += lineTotal;
    }

    await client.query(`UPDATE credit_notes SET total_amount=$1 WHERE id=$2`, [totalReturn, cn.id]);

    // reverse ledger entries
    const custLedger = await getLedgerByEntity(customer_id, 'customer', client);
    await postEntry(client, custLedger.id, 'credit', totalReturn, `Credit Note ${cnNumber}`, cn.id, 'credit_note');

    const salesLedger = await getLedgerByName('Sales Income', client);
    await postEntry(client, salesLedger.id, 'debit', returnSubtotal, `Credit Note ${cnNumber}`, cn.id, 'credit_note');

    if (returnCgst > 0) {
      const l = await getLedgerByName('GST Payable (CGST)', client);
      await postEntry(client, l.id, 'debit', returnCgst, `Credit Note ${cnNumber}`, cn.id, 'credit_note');
    }
    if (returnSgst > 0) {
      const l = await getLedgerByName('GST Payable (SGST)', client);
      await postEntry(client, l.id, 'debit', returnSgst, `Credit Note ${cnNumber}`, cn.id, 'credit_note');
    }
    if (returnIgst > 0) {
      const l = await getLedgerByName('GST Payable (IGST)', client);
      await postEntry(client, l.id, 'debit', returnIgst, `Credit Note ${cnNumber}`, cn.id, 'credit_note');
    }

    await client.query('COMMIT');
    return { credit_note_number: cnNumber, total_amount: totalReturn };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  createInvoice,
  getInvoiceById,
  getAllInvoices,
  cancelInvoice,
  createCreditNote,
};
