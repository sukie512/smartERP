const svc = require('../services/purchaseService');

const create     = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createPurchase(req.body) }); } catch(e){next(e);} };
const getAll     = async (req, res, next) => { try { res.json({ success: true, data: await svc.getAllPurchases(req.query) }); } catch(e){next(e);} };
const getOne     = async (req, res, next) => { try { const d = await svc.getPurchaseById(req.params.id); if(!d){return res.status(404).json({success:false,message:'Not found'});} res.json({success:true,data:d}); } catch(e){next(e);} };
const debitNote  = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createDebitNote(req.body) }); } catch(e){next(e);} };

module.exports = { create, getAll, getOne, debitNote };
