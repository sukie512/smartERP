/**
 * LEDGER SERVICE — The double-entry accounting engine
 *
 * Every rupee movement in SmartERP goes through here.
 * Two rules always hold:
 *   1. Every transaction has exactly one DR and one CR (or multiple pairs)
 *   2. Sum of all DR == Sum of all CR (Trial Balance balances)
 *
 * balance field meaning by group_type:
 *   asset / expense   → positive = DR balance (normal)
 *   liability / income → positive = CR balance (normal)
 *   We store raw signed balance; reports interpret direction.
 */

const pool = require('../config/db');

// ─── create a new ledger (called on customer/supplier/bank creation) ───────
const createLedger = async (client, entityId, entityType, name, groupType) => {
  const result = await client.query(
    `INSERT INTO ledgers (entity_id, entity_type, name, group_type, balance)
     VALUES ($1, $2, $3, $4, 0)
     RETURNING *`,
    [entityId, entityType, name, groupType]
  );
  return result.rows[0];
};

// ─── get ledger by entity (customer/supplier/bank) ─────────────────────────
const getLedgerByEntity = async (entityId, entityType, client = pool) => {
  const result = await client.query(
    `SELECT * FROM ledgers WHERE entity_id = $1 AND entity_type = $2`,
    [entityId, entityType]
  );
  if (!result.rows.length) throw new Error(`Ledger not found for ${entityType} ${entityId}`);
  return result.rows[0];
};

// ─── get system ledger by name (Sales Income, GST Payable etc.) ────────────
const getLedgerByName = async (name, client = pool) => {
  const result = await client.query(
    `SELECT * FROM ledgers WHERE name = $1`,
    [name]
  );
  if (!result.rows.length) throw new Error(`System ledger "${name}" not found. Run db:setup first.`);
  return result.rows[0];
};

// ─── post one side of a double entry ───────────────────────────────────────
// Always called in pairs (DR + CR) inside a transaction
const postEntry = async (client, ledgerId, entryType, amount, description, referenceId, referenceType) => {
  // insert the immutable audit record
  await client.query(
    `INSERT INTO ledger_entries
     (ledger_id, entry_type, amount, description, reference_id, reference_type)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [ledgerId, entryType, amount, description, referenceId, referenceType]
  );

  // update running balance on ledger
  // convention: debit = +balance, credit = -balance
  // reports flip sign for liability/income ledgers when displaying
  const op = entryType === 'debit' ? '+' : '-';
  await client.query(
    `UPDATE ledgers SET balance = balance ${op} $1 WHERE id = $2`,
    [amount, ledgerId]
  );
};

// ─── get full ledger statement for a customer/supplier ─────────────────────
const getStatement = async (entityId, entityType) => {
  const ledgerResult = await pool.query(
    `SELECT * FROM ledgers WHERE entity_id = $1 AND entity_type = $2`,
    [entityId, entityType]
  );
  if (!ledgerResult.rows.length) return null;
  const ledger = ledgerResult.rows[0];

  const entries = await pool.query(
    `SELECT le.*,
            TO_CHAR(le.created_at, 'DD Mon YYYY') AS date,
            TO_CHAR(le.created_at, 'HH24:MI') AS time
     FROM ledger_entries le
     WHERE le.ledger_id = $1
     ORDER BY le.created_at ASC`,
    [ledger.id]
  );

  // compute running balance per row
  let running = 0;
  const rows = entries.rows.map(e => {
    running += e.entry_type === 'debit' ? Number(e.amount) : -Number(e.amount);
    return { ...e, running_balance: running };
  });

  return { ledger, entries: rows };
};

// ─── get next sequential document number ───────────────────────────────────
// Atomic: PostgreSQL row-lock ensures no duplicates under concurrency
const getNextNumber = async (client, type) => {
  const result = await client.query(
    `UPDATE counters SET value = value + 1 WHERE name = $1 RETURNING value`,
    [type]
  );
  const num = String(result.rows[0].value).padStart(4, '0');
  const prefixes = {
    invoice:    'INV',
    purchase:   'PUR',
    payment:    'PAY',
    receipt:    'REC',
    credit_note:'CN',
    debit_note: 'DN',
    journal:    'JV',
    expense:    'EXP',
    transfer:   'TRF',
  };
  return `${prefixes[type]}-${num}`;
};

// ─── get all ledger balances (for trial balance / balance sheet) ────────────
const getAllLedgerBalances = async () => {
  const result = await pool.query(
    `SELECT l.*, 
            CASE 
              WHEN l.entity_type = 'customer' THEN c.name
              WHEN l.entity_type = 'supplier' THEN s.name
              WHEN l.entity_type = 'bank'     THEN b.name
              ELSE l.name
            END AS display_name
     FROM ledgers l
     LEFT JOIN customers c ON c.id = l.entity_id AND l.entity_type = 'customer'
     LEFT JOIN suppliers s ON s.id = l.entity_id AND l.entity_type = 'supplier'
     LEFT JOIN bank_accounts b ON b.id = l.entity_id AND l.entity_type = 'bank'
     ORDER BY l.group_type, l.name`
  );
  return result.rows;
};

module.exports = {
  createLedger,
  getLedgerByEntity,
  getLedgerByName,
  postEntry,
  getStatement,
  getNextNumber,
  getAllLedgerBalances,
};
