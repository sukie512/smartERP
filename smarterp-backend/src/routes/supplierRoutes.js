const router = require('express').Router();
const ctrl = require('../controllers/supplierController');

router.post('/',                ctrl.add);
router.get('/',                 ctrl.getAll);
router.get('/:id',              ctrl.getOne);
router.put('/:id',              ctrl.update);
router.delete('/:id',           ctrl.remove);
router.get('/:id/statement',    ctrl.statement);
router.get('/:id/purchases',    ctrl.purchases);

module.exports = router;
