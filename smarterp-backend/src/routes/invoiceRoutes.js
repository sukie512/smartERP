const router = require('express').Router();
const ctrl = require('../controllers/invoiceController');

router.post('/',                ctrl.create);
router.get('/',                 ctrl.getAll);
router.get('/:id',              ctrl.getOne);
router.post('/:id/cancel',      ctrl.cancel);
router.post('/credit-note',     ctrl.creditNote);

module.exports = router;
