const pool = require('../config/db');
const { getLedgerByEntity, getLedgerByName, postEntry, getNextNumber } = require('./ledgerService');
const { adjustStock } = require('./stockService');

const createPurchase = async ({ supplier_id, items, is_igst = false, notes }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const purchaseNumber = await getNextNumber(client, 'purchase');

    let subtotal = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
    const processedItems = items.map(item => {
      const taxable = parseFloat((item.quantity * item.unit_price).toFixed(2));
      const total   = (taxable * item.gst_percentage) / 100;
      const cgst    = is_igst ? 0 : parseFloat((total / 2).toFixed(2));
      const sgst    = is_igst ? 0 : parseFloat((total / 2).toFixed(2));
      const igst    = is_igst ? parseFloat(total.toFixed(2)) : 0;
      const lineTotal = parseFloat((taxable + cgst + sgst + igst).toFixed(2));

      subtotal  += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      return { ...item, taxable_amount: taxable, cgst, sgst, igst, line_total: lineTotal };
    });

    const totalTax    = parseFloat((totalCgst + totalSgst + totalIgst).toFixed(2));
    const totalAmount = parseFloat((subtotal + totalTax).toFixed(2));

    const purResult = await client.query(
      `INSERT INTO purchases
       (purchase_number, supplier_id, is_igst, subtotal, total_cgst, total_sgst, total_igst, total_tax, total_amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [purchaseNumber, supplier_id, is_igst, subtotal, totalCgst, totalSgst, totalIgst, totalTax, totalAmount, notes || null]
    );
    const purchase = purResult.rows[0];

    for (const item of processedItems) {
      await client.query(
        `INSERT INTO purchase_items
         (purchase_id, stock_item_id, quantity, unit_price, gst_percentage,
          taxable_amount, cgst, sgst, igst, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [purchase.id, item.stock_item_id, item.quantity, item.unit_price,
         item.gst_percentage, item.taxable_amount, item.cgst, item.sgst, item.igst, item.line_total]
      );

      // auto increase stock
      await adjustStock(client, item.stock_item_id, item.quantity, 'stock_in',
        purchase.id, 'purchase', `Purchase ${purchaseNumber}`);

      // update purchase price to latest
      await client.query(
        `UPDATE stock_items SET purchase_price=$1, updated_at=NOW() WHERE id=$2`,
        [item.unit_price, item.stock_item_id]
      );
    }

    // ledger entries
    // DR Purchase Expense
    const purLedger = await getLedgerByName('Purchase Expense', client);
    await postEntry(client, purLedger.id, 'debit', subtotal,
      `Purchase ${purchaseNumber}`, purchase.id, 'purchase');

    // DR GST Input Credit (we can claim this against GST Payable)
    if (totalCgst > 0) {
      const l = await getLedgerByName('GST Input Credit (CGST)', client);
      await postEntry(client, l.id, 'debit', totalCgst, `Purchase ${purchaseNumber}`, purchase.id, 'purchase');
    }
    if (totalSgst > 0) {
      const l = await getLedgerByName('GST Input Credit (SGST)', client);
      await postEntry(client, l.id, 'debit', totalSgst, `Purchase ${purchaseNumber}`, purchase.id, 'purchase');
    }
    if (totalIgst > 0) {
      const l = await getLedgerByName('GST Input Credit (IGST)', client);
      await postEntry(client, l.id, 'debit', totalIgst, `Purchase ${purchaseNumber}`, purchase.id, 'purchase');
    }

    // CR Supplier Ledger — we owe them the full amount
    const suppLedger = await getLedgerByEntity(supplier_id, 'supplier', client);
    await postEntry(client, suppLedger.id, 'credit', totalAmount,
      `Purchase ${purchaseNumber}`, purchase.id, 'purchase');

    await client.query('COMMIT');
    return await getPurchaseById(purchase.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getPurchaseById = async (id) => {
  const purRes = await pool.query(
    `SELECT p.*, TO_CHAR(p.created_at,'DD Mon YYYY') AS date FROM purchases p WHERE p.id=$1`, [id]
  );
  if (!purRes.rows.length) return null;
  const purchase = purRes.rows[0];

  const supplier = await pool.query(
    `SELECT name, mobile, email, address FROM suppliers WHERE id=$1`, [purchase.supplier_id]
  );
  const items = await pool.query(
    `SELECT pi.*, si.name AS item_name, u.name AS unit
     FROM purchase_items pi
     JOIN stock_items si ON si.id = pi.stock_item_id
     LEFT JOIN units u ON u.id = si.unit_id
     WHERE pi.purchase_id=$1`,
    [id]
  );

  return { ...purchase, supplier: supplier.rows[0], items: items.rows };
};

const getAllPurchases = async ({ supplier_id, status, from_date, to_date } = {}) => {
  let q = `
    SELECT p.*, s.name AS supplier_name,
           TO_CHAR(p.created_at,'DD Mon YYYY') AS date
    FROM purchases p
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE 1=1
  `;
  const params = [];

  if (supplier_id) { params.push(supplier_id); q += ` AND p.supplier_id=$${params.length}`; }
  if (status)      { params.push(status);       q += ` AND p.status=$${params.length}`; }
  if (from_date)   { params.push(from_date);    q += ` AND p.created_at >= $${params.length}`; }
  if (to_date)     { params.push(to_date);      q += ` AND p.created_at <= $${params.length}`; }

  q += ` ORDER BY p.created_at DESC`;
  const result = await pool.query(q, params);
  return result.rows;
};

// debit note (purchase return)
const createDebitNote = async ({ purchase_id, supplier_id, items, reason }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dnNumber = await getNextNumber(client, 'debit_note');
    let totalReturn = 0, returnSubtotal = 0, returnCgst = 0, returnSgst = 0, returnIgst = 0;

    const dnResult = await client.query(
      `INSERT INTO debit_notes (debit_note_number, purchase_id, supplier_id, reason, total_amount)
       VALUES ($1,$2,$3,$4,0) RETURNING *`,
      [dnNumber, purchase_id, supplier_id, reason || null]
    );
    const dn = dnResult.rows[0];

    for (const item of items) {
      const taxable   = parseFloat((item.quantity * item.unit_price).toFixed(2));
      const lineTotal = parseFloat((taxable + item.cgst + item.sgst + item.igst).toFixed(2));

      await client.query(
        `INSERT INTO debit_note_items
         (debit_note_id, stock_item_id, quantity, unit_price, gst_percentage, cgst, sgst, igst, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [dn.id, item.stock_item_id, item.quantity, item.unit_price,
         item.gst_percentage, item.cgst, item.sgst, item.igst, lineTotal]
      );

      // stock goes back out
      await adjustStock(client, item.stock_item_id, item.quantity, 'stock_out',
        dn.id, 'debit_note', `Debit Note ${dnNumber}`);

      returnSubtotal += taxable;
      returnCgst     += item.cgst;
      returnSgst     += item.sgst;
      returnIgst     += item.igst;
      totalReturn    += lineTotal;
    }

    await client.query(`UPDATE debit_notes SET total_amount=$1 WHERE id=$2`, [totalReturn, dn.id]);

    // reverse ledger entries
    const suppLedger = await getLedgerByEntity(supplier_id, 'supplier', client);
    await postEntry(client, suppLedger.id, 'debit', totalReturn, `Debit Note ${dnNumber}`, dn.id, 'debit_note');

    const purLedger = await getLedgerByName('Purchase Expense', client);
    await postEntry(client, purLedger.id, 'credit', returnSubtotal, `Debit Note ${dnNumber}`, dn.id, 'debit_note');

    if (returnCgst > 0) {
      const l = await getLedgerByName('GST Input Credit (CGST)', client);
      await postEntry(client, l.id, 'credit', returnCgst, `Debit Note ${dnNumber}`, dn.id, 'debit_note');
    }
    if (returnSgst > 0) {
      const l = await getLedgerByName('GST Input Credit (SGST)', client);
      await postEntry(client, l.id, 'credit', returnSgst, `Debit Note ${dnNumber}`, dn.id, 'debit_note');
    }
    if (returnIgst > 0) {
      const l = await getLedgerByName('GST Input Credit (IGST)', client);
      await postEntry(client, l.id, 'credit', returnIgst, `Debit Note ${dnNumber}`, dn.id, 'debit_note');
    }

    await client.query('COMMIT');
    return { debit_note_number: dnNumber, total_amount: totalReturn };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { createPurchase, getPurchaseById, getAllPurchases, createDebitNote };
