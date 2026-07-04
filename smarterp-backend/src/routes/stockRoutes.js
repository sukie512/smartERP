const router = require('express').Router();
const ctrl = require('../controllers/stockController');

// groups
router.post('/groups',          ctrl.addGroup);
router.get('/groups',           ctrl.getGroups);
router.put('/groups/:id',       ctrl.updateGroup);
router.delete('/groups/:id',    ctrl.deleteGroup);

// units
router.get('/units',            ctrl.getUnits);
router.post('/units',           ctrl.addUnit);

// items
router.post('/items',           ctrl.addItem);
router.get('/items',            ctrl.getItems);
router.get('/items/:id',        ctrl.getItem);
router.put('/items/:id',        ctrl.updateItem);
router.delete('/items/:id',     ctrl.deleteItem);
router.get('/items/:id/movements', ctrl.movements);

// manual adjustment
router.post('/adjust',          ctrl.adjust);

module.exports = router;
