const router = require('express').Router();
const ctrl = require('../controllers/reportController');

// dashboard
router.get('/dashboard',            ctrl.dashboard);

// sales
router.get('/sales/summary',        ctrl.salesSummary);
router.get('/sales/daily',          ctrl.dailySales);
router.get('/sales/monthly',        ctrl.monthlySales);
router.get('/sales/top-customers',  ctrl.topCustomers);

// purchases
router.get('/purchases/summary',    ctrl.purchaseSummary);
router.get('/purchases/register',   ctrl.purchaseRegister);
router.get('/purchases/suppliers',  ctrl.supplierSummary);

// inventory
router.get('/stock/summary',        ctrl.stockSummary);
router.get('/stock/low',            ctrl.lowStock);
router.get('/stock/movement',       ctrl.itemMovement);

// gst
router.get('/gst/summary',          ctrl.gstSummary);
router.get('/gst/register',         ctrl.gstRegister);

// financial
router.get('/trial-balance',        ctrl.trialBalance);
router.get('/profit-loss',          ctrl.profitLoss);
router.get('/balance-sheet',        ctrl.balanceSheet);
router.get('/cash-flow',            ctrl.cashFlow);

module.exports = router;
