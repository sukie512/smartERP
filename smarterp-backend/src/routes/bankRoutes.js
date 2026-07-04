const router = require('express').Router();
const ctrl = require('../controllers/bankController');

router.post('/',                        ctrl.add);
router.get('/',                         ctrl.getAll);
router.get('/cheques/pending',          ctrl.pendingCheques);
router.get('/:id',                      ctrl.getOne);
router.get('/:id/transactions',         ctrl.transactions);
router.get('/:id/reconciliation',       ctrl.reconcileHistory);
router.post('/transfer',                ctrl.transfer);
router.post('/reconcile',               ctrl.reconcile);

module.exports = router;
