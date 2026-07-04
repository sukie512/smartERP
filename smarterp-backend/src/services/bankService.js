const pool = require('../config/db');
const { createLedger, postEntry, getNextNumber } = require('./ledgerService');

// ─── add bank account + auto-create ledger ────────────────────────────────
const addBankAccount = async ({ name, account_number, bank_name, ifsc, opening_balance = 0 }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO bank_accounts (name, account_number, bank_name, ifsc, opening_balance)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, account_number || null, bank_name || null, ifsc || null, opening_balance]
    );
    const bank = result.rows[0];

    // auto-create Bank ledger
    const ledger = await createLedger(client, bank.id, 'bank', name, 'bank');

    // post opening balance as a debit entry
    if (opening_balance > 0) {
      await postEntry(client, ledger.id, 'debit', opening_balance,
        'Opening Balance', bank.id, 'opening');
    }

    await client.query('COMMIT');
    return bank;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── list all banks with live balance ─────────────────────────────────────
const getAllBankAccounts = async () => {
  const result = await pool.query(
    `SELECT b.*, COALESCE(l.balance, 0) AS current_balance
     FROM bank_accounts b
     LEFT JOIN ledgers l ON l.entity_id = b.id AND l.entity_type = 'bank'
     ORDER BY b.name`
  );
  return result.rows;
};

const getBankAccountById = async (id) => {
  const result = await pool.query(
    `SELECT b.*, COALESCE(l.balance, 0) AS current_balance
     FROM bank_accounts b
     LEFT JOIN ledgers l ON l.entity_id = b.id AND l.entity_type = 'bank'
     WHERE b.id=$1`,
    [id]
  );
  return result.rows[0] || null;
};

// ─── fund transfer between bank/cash accounts (contra voucher) ────────────
const transferFunds = async ({ from_type, from_id, to_type, to_id, amount, note }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const transferNumber = await getNextNumber(client, 'transfer');

    await client.query(
      `INSERT INTO fund_transfers (transfer_number, from_type, from_id, to_type, to_id, amount, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [transferNumber, from_type, from_id || null, to_type, to_id || null, amount, note || null]
    );

    // get source ledger
    let fromLedger;
    if (from_type === 'cash') {
      const r = await client.query(`SELECT * FROM ledgers WHERE entity_type='cash' AND name='Cash'`);
      fromLedger = r.rows[0];
    } else {
      const r = await client.query(`SELECT * FROM ledgers WHERE entity_id=$1 AND entity_type='bank'`, [from_id]);
      fromLedger = r.rows[0];
    }
    if (!fromLedger) throw new Error('Source account ledger not found');
    if (fromLedger.balance < amount) {
      const e = new Error('Insufficient balance in source account'); e.status = 400; throw e;
    }

    // get destination ledger
    let toLedger;
    if (to_type === 'cash') {
      const r = await client.query(`SELECT * FROM ledgers WHERE entity_type='cash' AND name='Cash'`);
      toLedger = r.rows[0];
    } else {
      const r = await client.query(`SELECT * FROM ledgers WHERE entity_id=$1 AND entity_type='bank'`, [to_id]);
      toLedger = r.rows[0];
    }
    if (!toLedger) throw new Error('Destination account ledger not found');

    // CR source
    await postEntry(client, fromLedger.id, 'credit', amount,
      `Transfer ${transferNumber} out`, null, 'transfer');

    // DR destination
    await postEntry(client, toLedger.id, 'debit', amount,
      `Transfer ${transferNumber} in`, null, 'transfer');

    await client.query('COMMIT');
    return { transfer_number: transferNumber, amount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── bank reconciliation ──────────────────────────────────────────────────
const reconcileBank = async ({ bank_account_id, statement_date, statement_balance, notes }) => {
  // get current book balance from ledger
  const ledger = await pool.query(
    `SELECT balance FROM ledgers WHERE entity_id=$1 AND entity_type='bank'`,
    [bank_account_id]
  );
  if (!ledger.rows.length) throw new Error('Bank ledger not found');

  const bookBalance = ledger.rows[0].balance;

  const result = await pool.query(
    `INSERT INTO bank_reconciliation (bank_account_id, statement_date, statement_balance, book_balance, notes)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [bank_account_id, statement_date, statement_balance, bookBalance, notes || null]
  );
  return result.rows[0];
};

const getReconciliationHistory = async (bankAccountId) => {
  const result = await pool.query(
    `SELECT *, TO_CHAR(statement_date,'DD Mon YYYY') AS formatted_date
     FROM bank_reconciliation
     WHERE bank_account_id=$1
     ORDER BY statement_date DESC`,
    [bankAccountId]
  );
  return result.rows;
};

// ─── get bank transaction history ─────────────────────────────────────────
const getBankTransactions = async (bankAccountId) => {
  const ledger = await pool.query(
    `SELECT * FROM ledgers WHERE entity_id=$1 AND entity_type='bank'`, [bankAccountId]
  );
  if (!ledger.rows.length) return [];

  const entries = await pool.query(
    `SELECT le.*,
            TO_CHAR(le.created_at,'DD Mon YYYY HH24:MI') AS date
     FROM ledger_entries le
     WHERE le.ledger_id=$1
     ORDER BY le.created_at DESC`,
    [ledger.rows[0].id]
  );
  return entries.rows;
};

// ─── cheque management ────────────────────────────────────────────────────
const getPendingCheques = async () => {
  const issued = await pool.query(
    `SELECT p.*, s.name AS party_name, 'issued' AS cheque_direction
     FROM payments p JOIN suppliers s ON s.id=p.supplier_id
     WHERE p.payment_mode='cheque' AND p.cheque_status='pending'`
  );
  const received = await pool.query(
    `SELECT r.*, c.name AS party_name, 'received' AS cheque_direction
     FROM receipts r JOIN customers c ON c.id=r.customer_id
     WHERE r.payment_mode='cheque' AND r.cheque_status='pending'`
  );
  return { issued: issued.rows, received: received.rows };
};

module.exports = {
  addBankAccount,
  getAllBankAccounts,
  getBankAccountById,
  transferFunds,
  reconcileBank,
  getReconciliationHistory,
  getBankTransactions,
  getPendingCheques,
};
