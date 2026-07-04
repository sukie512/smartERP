const pool = require('../config/db');
const { createLedger, getStatement } = require('./ledgerService');

const addSupplier = async ({ name, mobile, email, address, gstin, state }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO suppliers (name, mobile, email, address, gstin, state)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, mobile, email || null, address || null, gstin || null, state || null]
    );
    const supplier = result.rows[0];

    // auto-create Sundry Creditor ledger
    await createLedger(client, supplier.id, 'supplier', name, 'sundry_creditor');

    await client.query('COMMIT');
    return supplier;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getAllSuppliers = async ({ search } = {}) => {
  let query = `
    SELECT s.*, COALESCE(l.balance, 0) AS outstanding_dues
    FROM suppliers s
    LEFT JOIN ledgers l ON l.entity_id = s.id AND l.entity_type = 'supplier'
  `;
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    query += ` WHERE s.name ILIKE $1 OR s.mobile ILIKE $1`;
  }

  query += ` ORDER BY s.name ASC`;
  const result = await pool.query(query, params);
  return result.rows;
};

const getSupplierById = async (id) => {
  const result = await pool.query(
    `SELECT s.*, COALESCE(l.balance, 0) AS outstanding_dues
     FROM suppliers s
     LEFT JOIN ledgers l ON l.entity_id = s.id AND l.entity_type = 'supplier'
     WHERE s.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const updateSupplier = async (id, { name, mobile, email, address, gstin, state }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE suppliers SET name=$1, mobile=$2, email=$3, address=$4,
       gstin=$5, state=$6, updated_at=NOW() WHERE id=$7 RETURNING *`,
      [name, mobile, email || null, address || null, gstin || null, state || null, id]
    );

    await client.query(
      `UPDATE ledgers SET name=$1 WHERE entity_id=$2 AND entity_type='supplier'`,
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

const deleteSupplier = async (id) => {
  const ledger = await pool.query(
    `SELECT balance FROM ledgers WHERE entity_id=$1 AND entity_type='supplier'`, [id]
  );
  if (ledger.rows[0]?.balance > 0) {
    const err = new Error('Cannot delete supplier with outstanding dues');
    err.status = 400;
    throw err;
  }

  const purchases = await pool.query(
    `SELECT COUNT(*) FROM purchases WHERE supplier_id=$1`, [id]
  );
  if (parseInt(purchases.rows[0].count) > 0) {
    const err = new Error('Cannot delete supplier with existing purchases');
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ledger_entries WHERE ledger_id IN (SELECT id FROM ledgers WHERE entity_id=$1)`, [id]);
    await client.query(`DELETE FROM ledgers WHERE entity_id=$1 AND entity_type='supplier'`, [id]);
    await client.query(`DELETE FROM suppliers WHERE id=$1`, [id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getSupplierStatement = (id) => getStatement(id, 'supplier');

const getSupplierPurchases = async (id) => {
  const result = await pool.query(
    `SELECT purchase_number, total_amount, amount_paid, status,
            TO_CHAR(created_at,'DD Mon YYYY') AS date
     FROM purchases WHERE supplier_id=$1 ORDER BY created_at DESC`,
    [id]
  );
  return result.rows;
};

module.exports = {
  addSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  getSupplierStatement,
  getSupplierPurchases,
};
