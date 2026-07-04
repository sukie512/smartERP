const router = require('express').Router();
const ctrl = require('../controllers/journalController');

router.post('/',            ctrl.create);
router.get('/',             ctrl.getAll);
router.get('/ledgers',      ctrl.ledgers);    // dropdown list for form
router.get('/:id',          ctrl.getOne);

module.exports = router;
