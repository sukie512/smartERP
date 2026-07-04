const pool = require('../config/db');
const { getLedgerByEntity, getLedgerByName, postEntry, getNextNumber } = require('./ledgerService');

// helper — get bank ledger
const getBankLedger = async (client, bankAccountId) => {
  const result = await client.query(
    `SELECT * FROM ledgers WHERE entity_id=$1 AND entity_type='bank'`, [bankAccountId]
  );
  if (!result.rows.length) throw new Error('Bank ledger not found');
  return result.rows[0];
};

// ─── receive payment FROM customer ────────────────────────────────────────
const receivePayment = async ({
  customer_id, amount, payment_mode = 'bank',
  bank_account_id, reference_invoice_id,
  cheque_number, cheque_date, note
}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const receiptNumber = await getNextNumber(client, 'receipt');

    await client.query(
      `INSERT INTO receipts
       (receipt_number, customer_id, amount, payment_mode, bank_account_id,
        reference_invoice_id, cheque_number, cheque_date, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [receiptNumber, customer_id, amount, payment_mode,
       bank_account_id || null, reference_invoice_id || null,
       cheque_number || null, cheque_date || null, note || null]
    );

    // DR: Bank or Cash (money arrives)
    let debitLedger;
    if (payment_mode === 'cash') {
      debitLedger = await getLedgerByName('Cash', client);
    } else {
      debitLedger = await getBankLedger(client, bank_account_id);
    }
    await postEntry(client, debitLedger.id, 'debit', amount,
      `Receipt ${receiptNumber}`, null, 'receipt');

    // CR: Customer Ledger (their balance reduces)
    const custLedger = await getLedgerByEntity(customer_id, 'customer', client);
    await postEntry(client, custLedger.id, 'credit', amount,
      `Receipt ${receiptNumber}`, null, 'receipt');

    // update invoice status if linked
    if (reference_invoice_id) {
      await updateInvoicePaymentStatus(client, reference_invoice_id, amount);
    }

    await client.query('COMMIT');
    return { receipt_number: receiptNumber, amount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── make payment TO supplier ─────────────────────────────────────────────
const makePayment = async ({
  supplier_id, amount, payment_mode = 'bank',
  bank_account_id, reference_purchase_id,
  cheque_number, cheque_date, note
}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const paymentNumber = await getNextNumber(client, 'payment');

    await client.query(
      `INSERT INTO payments
       (payment_number, supplier_id, amount, payment_mode, bank_account_id,
        reference_purchase_id, cheque_number, cheque_date, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [paymentNumber, supplier_id, amount, payment_mode,
       bank_account_id || null, reference_purchase_id || null,
       cheque_number || null, cheque_date || null, note || null]
    );

    // DR: Supplier Ledger (what we owe them reduces)
    const suppLedger = await getLedgerByEntity(supplier_id, 'supplier', client);
    await postEntry(client, suppLedger.id, 'debit', amount,
      `Payment ${paymentNumber}`, null, 'payment');

    // CR: Bank or Cash (money leaves)
    let creditLedger;
    if (payment_mode === 'cash') {
      creditLedger = await getLedgerByName('Cash', client);
    } else {
      creditLedger = await getBankLedger(client, bank_account_id);
    }
    await postEntry(client, creditLedger.id, 'credit', amount,
      `Payment ${paymentNumber}`, null, 'payment');

    // update purchase status if linked
    if (reference_purchase_id) {
      await updatePurchasePaymentStatus(client, reference_purchase_id, amount);
    }

    await client.query('COMMIT');
    return { payment_number: paymentNumber, amount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── record direct expense (rent, salary, electricity) ────────────────────
const recordExpense = async ({ expense_name, amount, payment_mode = 'bank', bank_account_id, note }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const voucherNumber = await getNextNumber(client, 'expense');

    await client.query(
      `INSERT INTO expense_vouchers (voucher_number, expense_name, amount, payment_mode, bank_account_id, note)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [voucherNumber, expense_name, amount, payment_mode, bank_account_id || null, note || null]
    );

    // DR: Expense Ledger
    // map common expense names to known ledgers, fallback to Other Expense
    const expenseLedgerMap = {
      'Rent':        'Rent Expense',
      'Salary':      'Salary Expense',
      'Electricity': 'Electricity Expense',
    };
    const ledgerName = expenseLedgerMap[expense_name] || 'Other Expense';
    const expLedger = await getLedgerByName(ledgerName, client);
    await postEntry(client, expLedger.id, 'debit', amount,
      `${expense_name} - ${voucherNumber}`, null, 'expense');

    // CR: Bank or Cash
    let creditLedger;
    if (payment_mode === 'cash') {
      creditLedger = await getLedgerByName('Cash', client);
    } else {
      creditLedger = await getBankLedger(client, bank_account_id);
    }
    await postEntry(client, creditLedger.id, 'credit', amount,
      `${expense_name} - ${voucherNumber}`, null, 'expense');

    await client.query('COMMIT');
    return { voucher_number: voucherNumber, expense_name, amount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── update cheque status ─────────────────────────────────────────────────
const updateChequeStatus = async ({ type, id, status }) => {
  // type = 'receipt' | 'payment'
  const table = type === 'receipt' ? 'receipts' : 'payments';
  await pool.query(`UPDATE ${table} SET cheque_status=$1 WHERE id=$2`, [status, id]);
  return { updated: true };
};

// ─── helpers to track invoice/purchase payment status ─────────────────────
const updateInvoicePaymentStatus = async (client, invoiceId, amount) => {
  const inv = await client.query(
    `SELECT total_amount, amount_paid FROM invoices WHERE id=$1`, [invoiceId]
  );
  if (!inv.rows.length) return;

  const newPaid = parseFloat(inv.rows[0].amount_paid) + parseFloat(amount);
  const total   = parseFloat(inv.rows[0].total_amount);

  let status = 'partial';
  if (newPaid >= total) status = 'paid';

  await client.query(
    `UPDATE invoices SET amount_paid=$1, status=$2 WHERE id=$3`,
    [Math.min(newPaid, total), status, invoiceId]
  );
};

const updatePurchasePaymentStatus = async (client, purchaseId, amount) => {
  const pur = await client.query(
    `SELECT total_amount, amount_paid FROM purchases WHERE id=$1`, [purchaseId]
  );
  if (!pur.rows.length) return;

  const newPaid = parseFloat(pur.rows[0].amount_paid) + parseFloat(amount);
  const total   = parseFloat(pur.rows[0].total_amount);

  let status = 'partial';
  if (newPaid >= total) status = 'paid';

  await client.query(
    `UPDATE purchases SET amount_paid=$1, status=$2 WHERE id=$3`,
    [Math.min(newPaid, total), status, purchaseId]
  );
};

// ─── list receipts ────────────────────────────────────────────────────────
const getAllReceipts = async ({ customer_id, from_date, to_date } = {}) => {
  let q = `
    SELECT r.*, c.name AS customer_name,
           TO_CHAR(r.created_at,'DD Mon YYYY') AS date
    FROM receipts r JOIN customers c ON c.id = r.customer_id WHERE 1=1
  `;
  const p = [];
  if (customer_id) { p.push(customer_id); q += ` AND r.customer_id=$${p.length}`; }
  if (from_date)   { p.push(from_date);   q += ` AND r.created_at >= $${p.length}`; }
  if (to_date)     { p.push(to_date);     q += ` AND r.created_at <= $${p.length}`; }
  q += ` ORDER BY r.created_at DESC`;
  return (await pool.query(q, p)).rows;
};

// ─── list payments ────────────────────────────────────────────────────────
const getAllPayments = async ({ supplier_id, from_date, to_date } = {}) => {
  let q = `
    SELECT p.*, s.name AS supplier_name,
           TO_CHAR(p.created_at,'DD Mon YYYY') AS date
    FROM payments p JOIN suppliers s ON s.id = p.supplier_id WHERE 1=1
  `;
  const params = [];
  if (supplier_id) { params.push(supplier_id); q += ` AND p.supplier_id=$${params.length}`; }
  if (from_date)   { params.push(from_date);   q += ` AND p.created_at >= $${params.length}`; }
  if (to_date)     { params.push(to_date);     q += ` AND p.created_at <= $${params.length}`; }
  q += ` ORDER BY p.created_at DESC`;
  return (await pool.query(q, params)).rows;
};

module.exports = {
  receivePayment,
  makePayment,
  recordExpense,
  updateChequeStatus,
  getAllReceipts,
  getAllPayments,
};
