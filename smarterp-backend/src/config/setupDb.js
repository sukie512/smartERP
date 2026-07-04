/**
 * SmartERP — PostgreSQL Database Setup
 * Run once: node src/config/setupDb.js
 * Creates all tables, indexes, seeds default data
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const schema = `

-- ─────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────
-- COUNTERS (for auto-incrementing doc numbers)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS counters (
  name   VARCHAR(50) PRIMARY KEY,
  value  INTEGER DEFAULT 0
);


-- ─────────────────────────────────────────────
-- STOCK GROUPS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);


-- ─────────────────────────────────────────────
-- UNITS OF MEASURE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS units (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE   -- PCS, KG, BOX, LTR ...
);


-- ─────────────────────────────────────────────
-- STOCK ITEMS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(255) NOT NULL,
  sku                 VARCHAR(100) UNIQUE NOT NULL,
  stock_group_id      UUID REFERENCES stock_groups(id) ON DELETE SET NULL,
  unit_id             UUID REFERENCES units(id) ON DELETE SET NULL,
  purchase_price      DECIMAL(14,2) NOT NULL DEFAULT 0,
  selling_price       DECIMAL(14,2) NOT NULL DEFAULT 0,
  gst_percentage      DECIMAL(5,2)  NOT NULL DEFAULT 0,
  current_stock       DECIMAL(14,3) DEFAULT 0,
  reserved_stock      DECIMAL(14,3) DEFAULT 0,
  damaged_stock       DECIMAL(14,3) DEFAULT 0,
  low_stock_threshold DECIMAL(14,3) DEFAULT 10,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_items_sku ON stock_items(sku);
CREATE INDEX IF NOT EXISTS idx_stock_items_group ON stock_items(stock_group_id);


-- ─────────────────────────────────────────────
-- CUSTOMERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  mobile     VARCHAR(15)  NOT NULL,
  email      VARCHAR(255),
  address    TEXT,
  gstin      VARCHAR(20),   -- customer GST number (for B2B)
  state      VARCHAR(100),  -- used to determine CGST+SGST vs IGST
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);


-- ─────────────────────────────────────────────
-- SUPPLIERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  mobile     VARCHAR(15)  NOT NULL,
  email      VARCHAR(255),
  address    TEXT,
  gstin      VARCHAR(20),
  state      VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_mobile ON suppliers(mobile);


-- ─────────────────────────────────────────────
-- BANK ACCOUNTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  account_number  VARCHAR(50),
  bank_name       VARCHAR(255),
  ifsc            VARCHAR(20),
  opening_balance DECIMAL(14,2) DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);


-- ─────────────────────────────────────────────
-- LEDGERS (accounting accounts — auto-created, never user-touched)
-- group_type values: sundry_debtor | sundry_creditor | bank | cash |
--                    income | expense | liability | asset | gst
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledgers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   UUID,           -- FK to customer/supplier/bank/null
  entity_type VARCHAR(50),    -- 'customer'|'supplier'|'bank'|'cash'|'gst'|'income'|'expense'
  name        VARCHAR(255) NOT NULL,
  group_type  VARCHAR(50)  NOT NULL,
  balance     DECIMAL(14,2) DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledgers_entity ON ledgers(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_ledgers_name   ON ledgers(name);


-- ─────────────────────────────────────────────
-- LEDGER ENTRIES (every transaction posts here — immutable audit log)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id      UUID REFERENCES ledgers(id),
  entry_type     VARCHAR(10) NOT NULL CHECK (entry_type IN ('debit','credit')),
  amount         DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  description    TEXT,
  reference_id   UUID,           -- invoice_id / purchase_id / payment_id etc.
  reference_type VARCHAR(50),    -- 'invoice'|'purchase'|'payment'|'receipt'|'credit_note'|'debit_note'|'transfer'|'opening'
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_ledger    ON ledger_entries(ledger_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_reference ON ledger_entries(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_date      ON ledger_entries(created_at);


-- ─────────────────────────────────────────────
-- INVOICES (sales)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  invoice_type   VARCHAR(20) DEFAULT 'gst_invoice'
                   CHECK (invoice_type IN ('gst_invoice','proforma','quotation','estimate')),
  customer_id    UUID REFERENCES customers(id),
  is_igst        BOOLEAN DEFAULT false,   -- true = inter-state
  subtotal       DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_cgst     DECIMAL(14,2) DEFAULT 0,
  total_sgst     DECIMAL(14,2) DEFAULT 0,
  total_igst     DECIMAL(14,2) DEFAULT 0,
  total_tax      DECIMAL(14,2) DEFAULT 0,
  total_amount   DECIMAL(14,2) NOT NULL DEFAULT 0,
  amount_paid    DECIMAL(14,2) DEFAULT 0,
  status         VARCHAR(20) DEFAULT 'unpaid'
                   CHECK (status IN ('unpaid','partial','paid','cancelled')),
  notes          TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status   ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date     ON invoices(created_at);


-- ─────────────────────────────────────────────
-- INVOICE ITEMS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     UUID REFERENCES invoices(id) ON DELETE CASCADE,
  stock_item_id  UUID REFERENCES stock_items(id),
  quantity       DECIMAL(14,3) NOT NULL,
  unit_price     DECIMAL(14,2) NOT NULL,
  gst_percentage DECIMAL(5,2)  NOT NULL DEFAULT 0,
  taxable_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  cgst           DECIMAL(14,2) DEFAULT 0,
  sgst           DECIMAL(14,2) DEFAULT 0,
  igst           DECIMAL(14,2) DEFAULT 0,
  line_total     DECIMAL(14,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);


-- ─────────────────────────────────────────────
-- PURCHASES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id     UUID REFERENCES suppliers(id),
  is_igst         BOOLEAN DEFAULT false,
  subtotal        DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_cgst      DECIMAL(14,2) DEFAULT 0,
  total_sgst      DECIMAL(14,2) DEFAULT 0,
  total_igst      DECIMAL(14,2) DEFAULT 0,
  total_tax       DECIMAL(14,2) DEFAULT 0,
  total_amount    DECIMAL(14,2) NOT NULL DEFAULT 0,
  amount_paid     DECIMAL(14,2) DEFAULT 0,
  status          VARCHAR(20) DEFAULT 'unpaid'
                    CHECK (status IN ('unpaid','partial','paid')),
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date     ON purchases(created_at);


-- ─────────────────────────────────────────────
-- PURCHASE ITEMS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id    UUID REFERENCES purchases(id) ON DELETE CASCADE,
  stock_item_id  UUID REFERENCES stock_items(id),
  quantity       DECIMAL(14,3) NOT NULL,
  unit_price     DECIMAL(14,2) NOT NULL,
  gst_percentage DECIMAL(5,2)  NOT NULL DEFAULT 0,
  taxable_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  cgst           DECIMAL(14,2) DEFAULT 0,
  sgst           DECIMAL(14,2) DEFAULT 0,
  igst           DECIMAL(14,2) DEFAULT 0,
  line_total     DECIMAL(14,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);


-- ─────────────────────────────────────────────
-- RECEIPTS (money IN — from customer)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number       VARCHAR(50) UNIQUE NOT NULL,
  customer_id          UUID REFERENCES customers(id),
  amount               DECIMAL(14,2) NOT NULL,
  payment_mode         VARCHAR(20) NOT NULL DEFAULT 'bank'
                         CHECK (payment_mode IN ('bank','cash','cheque','upi')),
  bank_account_id      UUID REFERENCES bank_accounts(id),
  reference_invoice_id UUID REFERENCES invoices(id),
  cheque_number        VARCHAR(50),
  cheque_date          DATE,
  cheque_status        VARCHAR(20) DEFAULT 'pending'
                         CHECK (cheque_status IN ('pending','cleared','bounced')),
  note                 TEXT,
  created_at           TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_customer ON receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date     ON receipts(created_at);


-- ─────────────────────────────────────────────
-- PAYMENTS (money OUT — to supplier)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number        VARCHAR(50) UNIQUE NOT NULL,
  supplier_id           UUID REFERENCES suppliers(id),
  amount                DECIMAL(14,2) NOT NULL,
  payment_mode          VARCHAR(20) NOT NULL DEFAULT 'bank'
                          CHECK (payment_mode IN ('bank','cash','cheque','upi')),
  bank_account_id       UUID REFERENCES bank_accounts(id),
  reference_purchase_id UUID REFERENCES purchases(id),
  cheque_number         VARCHAR(50),
  cheque_date           DATE,
  cheque_status         VARCHAR(20) DEFAULT 'pending'
                          CHECK (cheque_status IN ('pending','cleared','bounced')),
  note                  TEXT,
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_supplier ON payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payments_date     ON payments(created_at);


-- ─────────────────────────────────────────────
-- CREDIT NOTES (sales returns)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number VARCHAR(50) UNIQUE NOT NULL,
  invoice_id        UUID REFERENCES invoices(id),
  customer_id       UUID REFERENCES customers(id),
  reason            TEXT,
  total_amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_note_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id   UUID REFERENCES credit_notes(id) ON DELETE CASCADE,
  stock_item_id    UUID REFERENCES stock_items(id),
  quantity         DECIMAL(14,3) NOT NULL,
  unit_price       DECIMAL(14,2) NOT NULL,
  gst_percentage   DECIMAL(5,2)  DEFAULT 0,
  cgst             DECIMAL(14,2) DEFAULT 0,
  sgst             DECIMAL(14,2) DEFAULT 0,
  igst             DECIMAL(14,2) DEFAULT 0,
  line_total       DECIMAL(14,2) NOT NULL
);


-- ─────────────────────────────────────────────
-- DEBIT NOTES (purchase returns)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debit_notes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debit_note_number VARCHAR(50) UNIQUE NOT NULL,
  purchase_id      UUID REFERENCES purchases(id),
  supplier_id      UUID REFERENCES suppliers(id),
  reason           TEXT,
  total_amount     DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS debit_note_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debit_note_id   UUID REFERENCES debit_notes(id) ON DELETE CASCADE,
  stock_item_id   UUID REFERENCES stock_items(id),
  quantity        DECIMAL(14,3) NOT NULL,
  unit_price      DECIMAL(14,2) NOT NULL,
  gst_percentage  DECIMAL(5,2)  DEFAULT 0,
  cgst            DECIMAL(14,2) DEFAULT 0,
  sgst            DECIMAL(14,2) DEFAULT 0,
  igst            DECIMAL(14,2) DEFAULT 0,
  line_total      DECIMAL(14,2) NOT NULL
);


-- ─────────────────────────────────────────────
-- STOCK MOVEMENTS (full audit trail)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id  UUID REFERENCES stock_items(id),
  movement_type  VARCHAR(30) NOT NULL
                   CHECK (movement_type IN ('stock_in','stock_out','adjustment_add','adjustment_remove','damaged','transfer_in','transfer_out')),
  quantity       DECIMAL(14,3) NOT NULL,
  reference_id   UUID,
  reference_type VARCHAR(50),
  note           TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);


-- ─────────────────────────────────────────────
-- BANK RECONCILIATION
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_reconciliation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID REFERENCES bank_accounts(id),
  statement_date  DATE NOT NULL,
  statement_balance DECIMAL(14,2) NOT NULL,
  book_balance    DECIMAL(14,2) NOT NULL,
  difference      DECIMAL(14,2) GENERATED ALWAYS AS (statement_balance - book_balance) STORED,
  notes           TEXT,
  reconciled_at   TIMESTAMP DEFAULT NOW()
);


-- ─────────────────────────────────────────────
-- JOURNAL VOUCHERS (manual accounting entries)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_vouchers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number  VARCHAR(50) UNIQUE NOT NULL,
  description     TEXT,
  total_amount    DECIMAL(14,2) NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_voucher_id UUID REFERENCES journal_vouchers(id) ON DELETE CASCADE,
  ledger_id         UUID REFERENCES ledgers(id),
  entry_type        VARCHAR(10) NOT NULL CHECK (entry_type IN ('debit','credit')),
  amount            DECIMAL(14,2) NOT NULL
);


-- ─────────────────────────────────────────────
-- EXPENSE VOUCHERS (direct expenses — rent, salary etc.)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_vouchers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number  VARCHAR(50) UNIQUE NOT NULL,
  expense_name    VARCHAR(255) NOT NULL,   -- "Rent", "Electricity"
  amount          DECIMAL(14,2) NOT NULL,
  payment_mode    VARCHAR(20) NOT NULL DEFAULT 'bank'
                    CHECK (payment_mode IN ('bank','cash','cheque','upi')),
  bank_account_id UUID REFERENCES bank_accounts(id),
  note            TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);


-- ─────────────────────────────────────────────
-- FUND TRANSFERS (contra voucher)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fund_transfers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number VARCHAR(50) UNIQUE NOT NULL,
  from_type       VARCHAR(10) NOT NULL CHECK (from_type IN ('bank','cash')),
  from_id         UUID,   -- bank_account_id or null for cash
  to_type         VARCHAR(10) NOT NULL CHECK (to_type IN ('bank','cash')),
  to_id           UUID,
  amount          DECIMAL(14,2) NOT NULL,
  note            TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);


-- ─────────────────────────────────────────────
-- COMPANY SETTINGS (single row)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL DEFAULT 'My Company',
  address      TEXT,
  mobile       VARCHAR(15),
  email        VARCHAR(255),
  gstin        VARCHAR(20),
  state        VARCHAR(100) DEFAULT 'Maharashtra',
  logo_url     TEXT,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);


-- ─────────────────────────────────────────────
-- SEEDS
-- ─────────────────────────────────────────────

-- counters
INSERT INTO counters (name, value) VALUES
  ('invoice', 0),
  ('purchase', 0),
  ('payment', 0),
  ('receipt', 0),
  ('credit_note', 0),
  ('debit_note', 0),
  ('journal', 0),
  ('expense', 0),
  ('transfer', 0)
ON CONFLICT (name) DO NOTHING;

-- default units
INSERT INTO units (name) VALUES
  ('PCS'), ('KG'), ('BOX'), ('LTR'), ('MTR'), ('GM'), ('TON'), ('DZN')
ON CONFLICT (name) DO NOTHING;

-- default stock groups
INSERT INTO stock_groups (name) VALUES
  ('Electronics'), ('Furniture'), ('Groceries'), ('Medical'), ('General')
ON CONFLICT (name) DO NOTHING;

-- system ledgers (never user-created — always exist)
INSERT INTO ledgers (entity_type, name, group_type) VALUES
  ('cash',    'Cash',                       'cash'),
  ('income',  'Sales Income',               'income'),
  ('expense', 'Purchase Expense',           'expense'),
  ('gst',     'GST Payable (CGST)',         'liability'),
  ('gst',     'GST Payable (SGST)',         'liability'),
  ('gst',     'GST Payable (IGST)',         'liability'),
  ('gst',     'GST Input Credit (CGST)',    'asset'),
  ('gst',     'GST Input Credit (SGST)',    'asset'),
  ('gst',     'GST Input Credit (IGST)',    'asset'),
  ('expense', 'Rent Expense',               'expense'),
  ('expense', 'Salary Expense',             'expense'),
  ('expense', 'Electricity Expense',        'expense'),
  ('expense', 'Other Expense',              'expense')
ON CONFLICT DO NOTHING;

-- default company settings
INSERT INTO company_settings (company_name, state)
VALUES ('My Company', 'Maharashtra')
ON CONFLICT DO NOTHING;

`;

async function setup() {
  const client = await pool.connect();
  try {
    console.log('Setting up SmartERP database...');
    await client.query(schema);
    console.log('✅ All tables created successfully');
    console.log('✅ Default data seeded');
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setup();
module.exports = setup;
