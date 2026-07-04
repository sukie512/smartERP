import api from './client';

// ── customers ──────────────────────────────────────────────────────────────
export const customers = {
  list:      (params) => api.get('/customers', { params }),
  get:       (id)     => api.get(`/customers/${id}`),
  create:    (data)   => api.post('/customers', data),
  update:    (id, d)  => api.put(`/customers/${id}`, d),
  remove:    (id)     => api.delete(`/customers/${id}`),
  statement: (id)     => api.get(`/customers/${id}/statement`),
  invoices:  (id)     => api.get(`/customers/${id}/invoices`),
};

// ── suppliers ──────────────────────────────────────────────────────────────
export const suppliers = {
  list:      (params) => api.get('/suppliers', { params }),
  get:       (id)     => api.get(`/suppliers/${id}`),
  create:    (data)   => api.post('/suppliers', data),
  update:    (id, d)  => api.put(`/suppliers/${id}`, d),
  remove:    (id)     => api.delete(`/suppliers/${id}`),
  statement: (id)     => api.get(`/suppliers/${id}/statement`),
  purchases: (id)     => api.get(`/suppliers/${id}/purchases`),
};

// ── stock ──────────────────────────────────────────────────────────────────
export const stock = {
  groups:      {
    list:   ()        => api.get('/stock/groups'),
    create: (d)       => api.post('/stock/groups', d),
    update: (id, d)   => api.put(`/stock/groups/${id}`, d),
    remove: (id)      => api.delete(`/stock/groups/${id}`),
  },
  units:       {
    list:   ()        => api.get('/stock/units'),
    create: (d)       => api.post('/stock/units', d),
  },
  items:       {
    list:      (p)    => api.get('/stock/items', { params: p }),
    get:       (id)   => api.get(`/stock/items/${id}`),
    create:    (d)    => api.post('/stock/items', d),
    update:    (id,d) => api.put(`/stock/items/${id}`, d),
    remove:    (id)   => api.delete(`/stock/items/${id}`),
    movements: (id)   => api.get(`/stock/items/${id}/movements`),
  },
  adjust:      (d)    => api.post('/stock/adjust', d),
};

// ── invoices ───────────────────────────────────────────────────────────────
export const invoices = {
  list:       (p)     => api.get('/invoices', { params: p }),
  get:        (id)    => api.get(`/invoices/${id}`),
  create:     (d)     => api.post('/invoices', d),
  cancel:     (id)    => api.post(`/invoices/${id}/cancel`),
  creditNote: (d)     => api.post('/invoices/credit-note', d),
};

// ── purchases ──────────────────────────────────────────────────────────────
export const purchases = {
  list:      (p)      => api.get('/purchases', { params: p }),
  get:       (id)     => api.get(`/purchases/${id}`),
  create:    (d)      => api.post('/purchases', d),
  debitNote: (d)      => api.post('/purchases/debit-note', d),
};

// ── payments ───────────────────────────────────────────────────────────────
export const payments = {
  receive:      (d)   => api.post('/payments/receive', d),
  make:         (d)   => api.post('/payments/make', d),
  expense:      (d)   => api.post('/payments/expense', d),
  chequeStatus: (d)   => api.patch('/payments/cheque-status', d),
  receipts:     (p)   => api.get('/payments/receipts', { params: p }),
  payments:     (p)   => api.get('/payments/payments', { params: p }),
};

// ── banks ──────────────────────────────────────────────────────────────────
export const banks = {
  list:            ()      => api.get('/banks'),
  get:             (id)    => api.get(`/banks/${id}`),
  create:          (d)     => api.post('/banks', d),
  transfer:        (d)     => api.post('/banks/transfer', d),
  reconcile:       (d)     => api.post('/banks/reconcile', d),
  reconcileHist:   (id)    => api.get(`/banks/${id}/reconciliation`),
  transactions:    (id)    => api.get(`/banks/${id}/transactions`),
  pendingCheques:  ()      => api.get('/banks/cheques/pending'),
};

// ── journal ────────────────────────────────────────────────────────────────
export const journal = {
  list:    (p)    => api.get('/journal', { params: p }),
  get:     (id)   => api.get(`/journal/${id}`),
  create:  (d)    => api.post('/journal', d),
  ledgers: ()     => api.get('/journal/ledgers'),
};

// ── reports ────────────────────────────────────────────────────────────────
export const reports = {
  dashboard:        ()    => api.get('/reports/dashboard'),
  salesSummary:     (p)   => api.get('/reports/sales/summary', { params: p }),
  dailySales:       (p)   => api.get('/reports/sales/daily', { params: p }),
  monthlySales:     (p)   => api.get('/reports/sales/monthly', { params: p }),
  topCustomers:     (p)   => api.get('/reports/sales/top-customers', { params: p }),
  purchaseSummary:  (p)   => api.get('/reports/purchases/summary', { params: p }),
  purchaseRegister: (p)   => api.get('/reports/purchases/register', { params: p }),
  supplierSummary:  (p)   => api.get('/reports/purchases/suppliers', { params: p }),
  stockSummary:     ()    => api.get('/reports/stock/summary'),
  lowStock:         ()    => api.get('/reports/stock/low'),
  itemMovement:     (p)   => api.get('/reports/stock/movement', { params: p }),
  gstSummary:       (p)   => api.get('/reports/gst/summary', { params: p }),
  gstRegister:      (p)   => api.get('/reports/gst/register', { params: p }),
  trialBalance:     ()    => api.get('/reports/trial-balance'),
  profitLoss:       (p)   => api.get('/reports/profit-loss', { params: p }),
  balanceSheet:     ()    => api.get('/reports/balance-sheet'),
  cashFlow:         (p)   => api.get('/reports/cash-flow', { params: p }),
};

// ── settings ───────────────────────────────────────────────────────────────
export const settings = {
  get:    ()    => api.get('/settings'),
  update: (d)   => api.put('/settings', d),
};
