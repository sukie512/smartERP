const router = require('express').Router();
const ctrl = require('../controllers/paymentController');

router.post('/receive',         ctrl.receive);       // money in from customer
router.post('/make',            ctrl.make);           // money out to supplier
router.post('/expense',         ctrl.expense);        // direct expense (rent, salary)
router.patch('/cheque-status',  ctrl.chequeStatus);   // mark cheque cleared/bounced

router.get('/receipts',         ctrl.allReceipts);    // list all receipts
router.get('/payments',         ctrl.allPayments);    // list all payments

module.exports = router;
