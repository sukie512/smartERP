const pool = require('../config/db');
const { getAllLedgerBalances } = require('./ledgerService');

// ─── helper: default date range (current financial year) ─────────────────
const defaultRange = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    from: `${year}-04-01`,
    to:   `${year + 1}-03-31`,
  };
};

// ─────────────────────────────────────────────
// SALES REPORTS
// ─────────────────────────────────────────────

const getSalesSummary = async ({ from_date, to_date } = {}) => {
  const range = { from: from_date || defaultRange().from, to: to_date || defaultRange().to };

  const result = await pool.query(
    `SELECT
       COUNT(*)::int               AS total_invoices,
       COALESCE(SUM(subtotal),0)   AS total_sales,
       COALESCE(SUM(total_tax),0)  AS total_gst,
       COALESCE(SUM(total_amount),0) AS total_revenue,
       COALESCE(SUM(amount_paid),0)  AS total_collected,
       COALESCE(SUM(total_amount - amount_paid),0) AS total_outstanding
     FROM invoices
     WHERE created_at BETWEEN $1 AND $2
       AND invoice_type = 'gst_invoice'
       AND status != 'cancelled'`,
    [range.from, range.to]
  );
  return result.rows[0];
};

const getDailySales = async ({ from_date, to_date } = {}) => {
  const range = {
    from: from_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    to:   to_date   || new Date().toISOString().split('T')[0],
  };

  const result = await pool.query(
    `SELECT
       DATE(created_at)                           AS date,
       TO_CHAR(DATE(created_at),'DD Mon YYYY')   AS formatted_date,
       COUNT(*)::int                              AS invoice_count,
       COALESCE(SUM(subtotal),0)                 AS sales,
       COALESCE(SUM(total_tax),0)                AS gst,
       COALESCE(SUM(total_amount),0)             AS revenue
     FROM invoices
     WHERE created_at BETWEEN $1 AND $2
       AND invoice_type = 'gst_invoice'
       AND status != 'cancelled'
     GROUP BY DATE(created_at)
     ORDER BY DATE(created_at) DESC`,
    [range.from, range.to]
  );
  return result.rows;
};

const getMonthlySales = async ({ year } = {}) => {
  const y = year || new Date().getFullYear();
  const result = await pool.query(
    `SELECT
       EXTRACT(MONTH FROM created_at)::int        AS month_num,
       TO_CHAR(created_at,'Mon YYYY')             AS month,
       COUNT(*)::int                              AS invoice_count,
       COALESCE(SUM(subtotal),0)                 AS sales,
       COALESCE(SUM(total_amount),0)             AS revenue
     FROM invoices
     WHERE EXTRACT(YEAR FROM created_at) = $1
       AND invoice_type = 'gst_invoice'
       AND status != 'cancelled'
     GROUP BY EXTRACT(MONTH FROM created_at), TO_CHAR(created_at,'Mon YYYY')
     ORDER BY month_num`,
    [y]
  );
  return result.rows;
};

const getTopCustomers = async ({ from_date, to_date, limit = 10 } = {}) => {
  const range = { from: from_date || defaultRange().from, to: to_date || defaultRange().to };
  const result = await pool.query(
    `SELECT c.id, c.name, c.mobile,
            COUNT(i.id)::int             AS invoice_count,
            COALESCE(SUM(i.total_amount),0) AS total_billed,
            COALESCE(SUM(i.amount_paid),0)  AS total_paid,
            COALESCE(l.balance,0)           AS outstanding
     FROM customers c
     JOIN invoices i ON i.customer_id = c.id
     LEFT JOIN ledgers l ON l.entity_id = c.id AND l.entity_type='customer'
     WHERE i.created_at BETWEEN $1 AND $2
       AND i.status != 'cancelled'
     GROUP BY c.id, c.name, c.mobile, l.balance
     ORDER BY total_billed DESC
     LIMIT $3`,
    [range.from, range.to, limit]
  );
  return result.rows;
};

// ─────────────────────────────────────────────
// PURCHASE REPORTS
// ─────────────────────────────────────────────

const getPurchaseSummary = async ({ from_date, to_date } = {}) => {
  const range = { from: from_date || defaultRange().from, to: to_date || defaultRange().to };
  const result = await pool.query(
    `SELECT
       COUNT(*)::int                              AS total_purchases,
       COALESCE(SUM(subtotal),0)                 AS total_value,
       COALESCE(SUM(total_tax),0)                AS total_gst_input,
       COALESCE(SUM(total_amount),0)             AS total_payable,
       COALESCE(SUM(amount_paid),0)              AS total_paid,
       COALESCE(SUM(total_amount - amount_paid),0) AS outstanding_dues
     FROM purchases
     WHERE created_at BETWEEN $1 AND $2`,
    [range.from, range.to]
  );
  return result.rows[0];
};

const getPurchaseRegister = async ({ from_date, to_date, supplier_id } = {}) => {
  const range = { from: from_date || defaultRange().from, to: to_date || defaultRange().to };
  let q = `
    SELECT p.purchase_number, s.name AS supplier,
           p.subtotal, p.total_tax, p.total_amount, p.amount_paid, p.status,
           TO_CHAR(p.created_at,'DD Mon YYYY') AS date
    FROM purchases p JOIN suppliers s ON s.id=p.supplier_id
    WHERE p.created_at BETWEEN $1 AND $2
  `;
  const params = [range.from, range.to];
  if (supplier_id) { params.push(supplier_id); q += ` AND p.supplier_id=$${params.length}`; }
  q += ` ORDER BY p.created_at DESC`;
  return (await pool.query(q, params)).rows;
};

const getSupplierSummary = async ({ from_date, to_date } = {}) => {
  const range = { from: from_date || defaultRange().from, to: to_date || defaultRange().to };
  const result = await pool.query(
    `SELECT s.id, s.name, s.mobile,
            COUNT(p.id)::int               AS purchase_count,
            COALESCE(SUM(p.total_amount),0) AS total_purchased,
            COALESCE(l.balance,0)           AS outstanding_dues
     FROM suppliers s
     JOIN purchases p ON p.supplier_id = s.id
     LEFT JOIN ledgers l ON l.entity_id = s.id AND l.entity_type='supplier'
     WHERE p.created_at BETWEEN $1 AND $2
     GROUP BY s.id, s.name, s.mobile, l.balance
     ORDER BY total_purchased DESC`,
    [range.from, range.to]
  );
  return result.rows;
};

// ─────────────────────────────────────────────
// INVENTORY REPORTS
// ─────────────────────────────────────────────

const getStockSummary = async () => {
  const result = await pool.query(
    `SELECT si.name, si.sku, sg.name AS group_name, u.name AS unit,
            si.current_stock, si.reserved_stock, si.damaged_stock,
            (si.current_stock - si.reserved_stock - si.damaged_stock) AS available_stock,
            si.purchase_price, si.selling_price,
            (si.current_stock * si.purchase_price)    AS stock_value_at_cost,
            (si.current_stock * si.selling_price)     AS stock_value_at_selling,
            si.low_stock_threshold,
            CASE WHEN si.current_stock <= si.low_stock_threshold THEN true ELSE false END AS is_low_stock
     FROM stock_items si
     LEFT JOIN stock_groups sg ON sg.id = si.stock_group_id
     LEFT JOIN units u ON u.id = si.unit_id
     ORDER BY si.name`
  );
  return result.rows;
};

const getLowStockItems = async () => {
  const result = await pool.query(
    `SELECT si.name, si.sku, u.name AS unit,
            si.current_stock, si.low_stock_threshold,
            (si.low_stock_threshold - si.current_stock) AS shortage
     FROM stock_items si
     LEFT JOIN units u ON u.id = si.unit_id
     WHERE si.current_stock <= si.low_stock_threshold
     ORDER BY si.current_stock ASC`
  );
  return result.rows;
};

const getItemMovementReport = async ({ stock_item_id, from_date, to_date } = {}) => {
  let q = `
    SELECT sm.*, si.name AS item_name, u.name AS unit,
           TO_CHAR(sm.created_at,'DD Mon YYYY HH24:MI') AS date
    FROM stock_movements sm
    JOIN stock_items si ON si.id = sm.stock_item_id
    LEFT JOIN units u ON u.id = si.unit_id
    WHERE 1=1
  `;
  const p = [];
  if (stock_item_id) { p.push(stock_item_id); q += ` AND sm.stock_item_id=$${p.length}`; }
  if (from_date)     { p.push(from_date);     q += ` AND sm.created_at >= $${p.length}`; }
  if (to_date)       { p.push(to_date);       q += ` AND sm.created_at <= $${p.length}`; }
  q += ` ORDER BY sm.created_at DESC`;
  return (await pool.query(q, p)).rows;
};

// ─────────────────────────────────────────────
// GST REPORTS
// ─────────────────────────────────────────────

const getGSTSummary = async ({ from_date, to_date } = {}) => {
  const range = { from: from_date || defaultRange().from, to: to_date || defaultRange().to };

  const sales = await pool.query(
    `SELECT
       COALESCE(SUM(total_cgst),0) AS cgst_collected,
       COALESCE(SUM(total_sgst),0) AS sgst_collected,
       COALESCE(SUM(total_igst),0) AS igst_collected,
       COALESCE(SUM(total_tax),0)  AS total_output_gst
     FROM invoices
     WHERE created_at BETWEEN $1 AND $2
       AND invoice_type='gst_invoice' AND status!='cancelled'`,
    [range.from, range.to]
  );

  const purchases = await pool.query(
    `SELECT
       COALESCE(SUM(total_cgst),0) AS cgst_input,
       COALESCE(SUM(total_sgst),0) AS sgst_input,
       COALESCE(SUM(total_igst),0) AS igst_input,
       COALESCE(SUM(total_tax),0)  AS total_input_gst
     FROM purchases
     WHERE created_at BETWEEN $1 AND $2`,
    [range.from, range.to]
  );

  const s = sales.rows[0];
  const p = purchases.rows[0];

  return {
    output_gst:   s,
    input_credit: p,
    net_payable: {
      cgst: parseFloat(s.cgst_collected) - parseFloat(p.cgst_input),
      sgst: parseFloat(s.sgst_collected) - parseFloat(p.sgst_input),
      igst: parseFloat(s.igst_collected) - parseFloat(p.igst_input),
      total: parseFloat(s.total_output_gst) - parseFloat(p.total_input_gst),
    },
  };
};

const getGSTRegister = async ({ from_date, to_date } = {}) => {
  const range = { from: from_date || defaultRange().from, to: to_date || defaultRange().to };
  const result = await pool.query(
    `SELECT i.invoice_number, c.name AS customer, c.gstin,
            i.subtotal, i.total_cgst, i.total_sgst, i.total_igst,
            i.total_tax, i.total_amount, i.is_igst,
            TO_CHAR(i.created_at,'DD Mon YYYY') AS date
     FROM invoices i JOIN customers c ON c.id=i.customer_id
     WHERE i.created_at BETWEEN $1 AND $2
       AND i.invoice_type='gst_invoice' AND i.status!='cancelled'
     ORDER BY i.created_at`,
    [range.from, range.to]
  );
  return result.rows;
};

// ─────────────────────────────────────────────
// FINANCIAL REPORTS
// ─────────────────────────────────────────────

const getTrialBalance = async () => {
  const ledgers = await getAllLedgerBalances();

  // separate into debit and credit normal balances
  const rows = ledgers.map(l => {
    const debit  = l.balance > 0 ? l.balance : 0;
    const credit = l.balance < 0 ? Math.abs(l.balance) : 0;
    return { name: l.display_name || l.name, group_type: l.group_type, debit, credit };
  });

  const totalDebit  = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return { rows, total_debit: totalDebit, total_credit: totalCredit };
};

const getProfitAndLoss = async ({ from_date, to_date } = {}) => {
  const range = { from: from_date || defaultRange().from, to: to_date || defaultRange().to };

  const revenue = await pool.query(
    `SELECT COALESCE(SUM(subtotal),0) AS total
     FROM invoices WHERE created_at BETWEEN $1 AND $2
       AND invoice_type='gst_invoice' AND status!='cancelled'`,
    [range.from, range.to]
  );

  const cogs = await pool.query(
    `SELECT COALESCE(SUM(subtotal),0) AS total
     FROM purchases WHERE created_at BETWEEN $1 AND $2`,
    [range.from, range.to]
  );

  // direct expenses from expense_vouchers
  const expenses = await pool.query(
    `SELECT expense_name, COALESCE(SUM(amount),0) AS total
     FROM expense_vouchers
     WHERE created_at BETWEEN $1 AND $2
     GROUP BY expense_name`,
    [range.from, range.to]
  );

  const totalRevenue  = parseFloat(revenue.rows[0].total);
  const totalCOGS     = parseFloat(cogs.rows[0].total);
  const grossProfit   = totalRevenue - totalCOGS;
  const totalExpenses = expenses.rows.reduce((s, e) => s + parseFloat(e.total), 0);
  const netProfit     = grossProfit - totalExpenses;

  return {
    revenue:        totalRevenue,
    cogs:           totalCOGS,
    gross_profit:   grossProfit,
    expenses:       expenses.rows,
    total_expenses: totalExpenses,
    net_profit:     netProfit,
  };
};

const getBalanceSheet = async () => {
  // ASSETS
  const cash = await pool.query(
    `SELECT COALESCE(balance,0) AS balance FROM ledgers WHERE entity_type='cash' AND name='Cash'`
  );
  const banks = await pool.query(
    `SELECT b.name, COALESCE(l.balance,0) AS balance
     FROM bank_accounts b JOIN ledgers l ON l.entity_id=b.id AND l.entity_type='bank'`
  );
  const debtors = await pool.query(
    `SELECT COALESCE(SUM(balance),0) AS total FROM ledgers WHERE entity_type='customer' AND balance > 0`
  );
  const stockVal = await pool.query(
    `SELECT COALESCE(SUM(current_stock * purchase_price),0) AS total FROM stock_items`
  );
  const gstInput = await pool.query(
    `SELECT COALESCE(SUM(balance),0) AS total FROM ledgers WHERE name LIKE 'GST Input Credit%'`
  );

  // LIABILITIES
  const creditors = await pool.query(
    `SELECT COALESCE(SUM(ABS(balance)),0) AS total FROM ledgers WHERE entity_type='supplier' AND balance < 0`
  );
  const gstPayable = await pool.query(
    `SELECT COALESCE(SUM(ABS(balance)),0) AS total FROM ledgers WHERE name LIKE 'GST Payable%'`
  );

  const cashBalance   = parseFloat(cash.rows[0]?.balance || 0);
  const bankTotal     = banks.rows.reduce((s, b) => s + parseFloat(b.balance), 0);
  const debtorTotal   = parseFloat(debtors.rows[0]?.total || 0);
  const stockTotal    = parseFloat(stockVal.rows[0]?.total || 0);
  const gstInputTotal = parseFloat(gstInput.rows[0]?.total || 0);
  const totalAssets   = cashBalance + bankTotal + debtorTotal + stockTotal + gstInputTotal;

  const creditorTotal   = parseFloat(creditors.rows[0]?.total || 0);
  const gstPayableTotal = parseFloat(gstPayable.rows[0]?.total || 0);
  const totalLiabilities = creditorTotal + gstPayableTotal;

  return {
    assets: {
      cash:            cashBalance,
      bank_accounts:   banks.rows,
      bank_total:      bankTotal,
      sundry_debtors:  debtorTotal,
      stock_value:     stockTotal,
      gst_input_credit: gstInputTotal,
      total:           totalAssets,
    },
    liabilities: {
      sundry_creditors: creditorTotal,
      gst_payable:      gstPayableTotal,
      total:            totalLiabilities,
    },
    net_worth: totalAssets - totalLiabilities,
  };
};

const getCashFlowStatement = async ({ from_date, to_date } = {}) => {
  const range = { from: from_date || defaultRange().from, to: to_date || defaultRange().to };

  // operating: receipts from customers
  const receipts = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total FROM receipts WHERE created_at BETWEEN $1 AND $2`,
    [range.from, range.to]
  );
  // operating: payments to suppliers
  const payments = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE created_at BETWEEN $1 AND $2`,
    [range.from, range.to]
  );
  // operating: direct expenses
  const expenses = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total FROM expense_vouchers WHERE created_at BETWEEN $1 AND $2`,
    [range.from, range.to]
  );

  const cashIn    = parseFloat(receipts.rows[0].total);
  const cashOut   = parseFloat(payments.rows[0].total) + parseFloat(expenses.rows[0].total);
  const netOpFlow = cashIn - cashOut;

  return {
    operating: {
      cash_received_from_customers: cashIn,
      cash_paid_to_suppliers:       parseFloat(payments.rows[0].total),
      direct_expenses:              parseFloat(expenses.rows[0].total),
      net_operating_cash_flow:      netOpFlow,
    },
    net_cash_flow: netOpFlow,
  };
};

// ─── dashboard summary ────────────────────────────────────────────────────
const getDashboardSummary = async () => {
  const today = new Date().toISOString().split('T')[0];

  const [todaySales, pendingInvoices, lowStock, totalCustomers, totalSuppliers, cashBalance] =
    await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(total_amount),0) AS total FROM invoices
         WHERE DATE(created_at)=CURRENT_DATE AND invoice_type='gst_invoice' AND status!='cancelled'`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(total_amount - amount_paid),0) AS amount
         FROM invoices WHERE status IN ('unpaid','partial')`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM stock_items WHERE current_stock <= low_stock_threshold`
      ),
      pool.query(`SELECT COUNT(*)::int AS count FROM customers`),
      pool.query(`SELECT COUNT(*)::int AS count FROM suppliers`),
      pool.query(`SELECT COALESCE(balance,0) AS balance FROM ledgers WHERE entity_type='cash' AND name='Cash'`),
    ]);

  return {
    today_sales:          parseFloat(todaySales.rows[0].total),
    pending_invoices:     pendingInvoices.rows[0].count,
    pending_amount:       parseFloat(pendingInvoices.rows[0].amount),
    low_stock_alerts:     lowStock.rows[0].count,
    total_customers:      totalCustomers.rows[0].count,
    total_suppliers:      totalSuppliers.rows[0].count,
    cash_balance:         parseFloat(cashBalance.rows[0]?.balance || 0),
  };
};

module.exports = {
  getSalesSummary,
  getDailySales,
  getMonthlySales,
  getTopCustomers,
  getPurchaseSummary,
  getPurchaseRegister,
  getSupplierSummary,
  getStockSummary,
  getLowStockItems,
  getItemMovementReport,
  getGSTSummary,
  getGSTRegister,
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getCashFlowStatement,
  getDashboardSummary,
};
