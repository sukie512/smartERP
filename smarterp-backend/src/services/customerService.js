const pool = require('../config/db');
const { createLedger, getStatement } = require('./ledgerService');

// ─── add customer + auto-create their ledger ──────────────────────────────
const addCustomer = async ({ name, mobile, email, address, gstin, state }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO customers (name, mobile, email, address, gstin, state)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, mobile, email || null, address || null, gstin || null, state || null]
    );
    const customer = result.rows[0];

    // auto-create Sundry Debtor ledger
    await createLedger(client, customer.id, 'customer', name, 'sundry_debtor');

    await client.query('COMMIT');
    return customer;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── list all customers with live outstanding balance ─────────────────────
const getAllCustomers = async ({ search } = {}) => {
  let query = `
    SELECT c.*, COALESCE(l.balance, 0) AS outstanding_balance
    FROM customers c
    LEFT JOIN ledgers l ON l.entity_id = c.id AND l.entity_type = 'customer'
  `;
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    query += ` WHERE c.name ILIKE $1 OR c.mobile ILIKE $1`;
  }

  query += ` ORDER BY c.name ASC`;
  const result = await pool.query(query, params);
  return result.rows;
};

// ─── get single customer ──────────────────────────────────────────────────
const getCustomerById = async (id) => {
  const result = await pool.query(
    `SELECT c.*, COALESCE(l.balance, 0) AS outstanding_balance
     FROM customers c
     LEFT JOIN ledgers l ON l.entity_id = c.id AND l.entity_type = 'customer'
     WHERE c.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

// ─── update customer (keep ledger name in sync) ───────────────────────────
const updateCustomer = async (id, { name, mobile, email, address, gstin, state }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE customers SET name=$1, mobile=$2, email=$3, address=$4,
       gstin=$5, state=$6, updated_at=NOW() WHERE id=$7 RETURNING *`,
      [name, mobile, email || null, address || null, gstin || null, state || null, id]
    );

    // keep ledger name in sync
    await client.query(
      `UPDATE ledgers SET name=$1 WHERE entity_id=$2 AND entity_type='customer'`,
      [name, id]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── delete customer (block if has balance or transactions) ───────────────
const deleteCustomer = async (id) => {
  const ledger = await pool.query(
    `SELECT balance FROM ledgers WHERE entity_id=$1 AND entity_type='customer'`,
    [id]
  );
  if (ledger.rows[0]?.balance > 0) {
    const err = new Error('Cannot delete customer with outstanding balance');
    err.status = 400;
    throw err;
  }

  const invoices = await pool.query(
    `SELECT COUNT(*) FROM invoices WHERE customer_id=$1`, [id]
  );
  if (parseInt(invoices.rows[0].count) > 0) {
    const err = new Error('Cannot delete customer with existing invoices');
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ledger_entries WHERE ledger_id IN (SELECT id FROM ledgers WHERE entity_id=$1)`, [id]);
    await client.query(`DELETE FROM ledgers WHERE entity_id=$1 AND entity_type='customer'`, [id]);
    await client.query(`DELETE FROM customers WHERE id=$1`, [id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── full ledger statement ────────────────────────────────────────────────
const getCustomerStatement = (id) => getStatement(id, 'customer');

// ─── customer invoice history ─────────────────────────────────────────────
const getCustomerInvoices = async (id) => {
  const result = await pool.query(
    `SELECT invoice_number, invoice_type, total_amount, amount_paid,
            status, TO_CHAR(created_at,'DD Mon YYYY') AS date
     FROM invoices WHERE customer_id=$1 ORDER BY created_at DESC`,
    [id]
  );
  return result.rows;
};

module.exports = {
  addCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  getCustomerStatement,
  getCustomerInvoices,
};
