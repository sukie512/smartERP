const svc = require('../services/journalService');

const create     = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createJournalVoucher(req.body) }); } catch(e){next(e);} };
const getAll     = async (req, res, next) => { try { res.json({ success: true, data: await svc.getAllJournalVouchers(req.query) }); } catch(e){next(e);} };
const getOne     = async (req, res, next) => { try { const d = await svc.getJournalVoucherById(req.params.id); if(!d){return res.status(404).json({success:false,message:'Not found'});} res.json({success:true,data:d}); } catch(e){next(e);} };
const ledgers    = async (req, res, next) => { try { res.json({ success: true, data: await svc.getAvailableLedgers() }); } catch(e){next(e);} };

module.exports = { create, getAll, getOne, ledgers };
