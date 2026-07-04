const router = require('express').Router();
const ctrl = require('../controllers/purchaseController');

router.post('/',                ctrl.create);
router.get('/',                 ctrl.getAll);
router.get('/:id',              ctrl.getOne);
router.post('/debit-note',      ctrl.debitNote);

module.exports = router;
