/**
 * JOURNAL VOUCHER SERVICE
 * Used for manual accounting adjustments — depreciation, corrections, etc.
 * User picks two ledgers, enters debit/credit amounts.
 * Total debits must equal total credits.
 */

const pool = require('../config/db');
const { postEntry, getNextNumber, getAllLedgerBalances } = require('./ledgerService');

const createJournalVoucher = async ({ description, entries }) => {
  // validate: sum of debits must equal sum of credits
  const totalDebits  = entries.filter(e => e.entry_type === 'debit').reduce((s, e) => s + Number(e.amount), 0);
  const totalCredits = entries.filter(e => e.entry_type === 'credit').reduce((s, e) => s + Number(e.amount), 0);

  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    const err = new Error(`Journal entries do not balance. Debits: ${totalDebits}, Credits: ${totalCredits}`);
    err.status = 400;
    throw err;
  }
  if (entries.length < 2) {
    const err = new Error('Journal voucher must have at least 2 entries');
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const voucherNumber = await getNextNumber(client, 'journal');

    const jvResult = await client.query(
      `INSERT INTO journal_vouchers (voucher_number, description, total_amount)
       VALUES ($1, $2, $3) RETURNING *`,
      [voucherNumber, description || null, totalDebits]
    );
    const jv = jvResult.rows[0];

    for (const entry of entries) {
      // post to journal_entries table
      await client.query(
        `INSERT INTO journal_entries (journal_voucher_id, ledger_id, entry_type, amount)
         VALUES ($1, $2, $3, $4)`,
        [jv.id, entry.ledger_id, entry.entry_type, entry.amount]
      );

      // also post to ledger_entries (running balance)
      await postEntry(
        client,
        entry.ledger_id,
        entry.entry_type,
        entry.amount,
        `Journal Voucher ${voucherNumber} - ${description || ''}`,
        jv.id,
        'journal'
      );
    }

    await client.query('COMMIT');
    return await getJournalVoucherById(jv.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getJournalVoucherById = async (id) => {
  const jv = await pool.query(
    `SELECT jv.*, TO_CHAR(jv.created_at, 'DD Mon YYYY') AS date
     FROM journal_vouchers jv WHERE jv.id = $1`,
    [id]
  );
  if (!jv.rows.length) return null;

  const entries = await pool.query(
    `SELECT je.*, l.name AS ledger_name, l.group_type
     FROM journal_entries je
     JOIN ledgers l ON l.id = je.ledger_id
     WHERE je.journal_voucher_id = $1`,
    [id]
  );

  return { ...jv.rows[0], entries: entries.rows };
};

const getAllJournalVouchers = async ({ from_date, to_date } = {}) => {
  let q = `
    SELECT jv.*, TO_CHAR(jv.created_at, 'DD Mon YYYY') AS date
    FROM journal_vouchers jv
    WHERE 1=1
  `;
  const p = [];
  if (from_date) { p.push(from_date); q += ` AND jv.created_at >= $${p.length}`; }
  if (to_date)   { p.push(to_date);   q += ` AND jv.created_at <= $${p.length}`; }
  q += ` ORDER BY jv.created_at DESC`;
  return (await pool.query(q, p)).rows;
};

// get all available ledgers for the journal voucher form dropdown
const getAvailableLedgers = async () => {
  return await getAllLedgerBalances();
};

module.exports = {
  createJournalVoucher,
  getJournalVoucherById,
  getAllJournalVouchers,
  getAvailableLedgers,
};
