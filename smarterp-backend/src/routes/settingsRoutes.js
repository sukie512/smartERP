const router = require('express').Router();
const svc = require('../services/settingsService');

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await svc.getSettings() }); } catch(e){next(e);}
});

router.put('/', async (req, res, next) => {
  try { res.json({ success: true, data: await svc.updateSettings(req.body) }); } catch(e){next(e);}
});

module.exports = router;
