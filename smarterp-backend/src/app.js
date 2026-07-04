require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

// ─── middleware ────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// request logger in dev
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ─── routes ───────────────────────────────────────────────────────────────
app.use('/api/customers',  require('./routes/customerRoutes'));
app.use('/api/suppliers',  require('./routes/supplierRoutes'));
app.use('/api/stock',      require('./routes/stockRoutes'));
app.use('/api/invoices',   require('./routes/invoiceRoutes'));
app.use('/api/purchases',  require('./routes/purchaseRoutes'));
app.use('/api/payments',   require('./routes/paymentRoutes'));
app.use('/api/banks',      require('./routes/bankRoutes'));
app.use('/api/journal',    require('./routes/journalRoutes'));
app.use('/api/reports',    require('./routes/reportRoutes'));
app.use('/api/settings',   require('./routes/settingsRoutes'));

// ─── health check ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 handler ──────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── global error handler (must be last) ──────────────────────────────────
app.use(require('./middleware/errorHandler'));

// ─── start server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`SmartERP backend running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
