const svc = require('../services/invoiceService');

const create      = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createInvoice(req.body) }); } catch(e){next(e);} };
const getAll      = async (req, res, next) => { try { res.json({ success: true, data: await svc.getAllInvoices(req.query) }); } catch(e){next(e);} };
const getOne      = async (req, res, next) => { try { const d = await svc.getInvoiceById(req.params.id); if(!d){return res.status(404).json({success:false,message:'Not found'});} res.json({success:true,data:d}); } catch(e){next(e);} };
const cancel      = async (req, res, next) => { try { res.json({ success: true, data: await svc.cancelInvoice(req.params.id) }); } catch(e){next(e);} };
const creditNote  = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createCreditNote(req.body) }); } catch(e){next(e);} };

module.exports = { create, getAll, getOne, cancel, creditNote };
