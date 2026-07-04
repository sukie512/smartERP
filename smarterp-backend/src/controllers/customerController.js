const svc = require('../services/customerService');

const add     = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.addCustomer(req.body) }); } catch(e){next(e);} };
const getAll  = async (req, res, next) => { try { res.json({ success: true, data: await svc.getAllCustomers(req.query) }); } catch(e){next(e);} };
const getOne  = async (req, res, next) => { try { const d = await svc.getCustomerById(req.params.id); if(!d){return res.status(404).json({success:false,message:'Not found'});} res.json({success:true,data:d}); } catch(e){next(e);} };
const update  = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateCustomer(req.params.id, req.body) }); } catch(e){next(e);} };
const remove  = async (req, res, next) => { try { await svc.deleteCustomer(req.params.id); res.json({success:true,message:'Deleted'}); } catch(e){next(e);} };
const statement = async (req, res, next) => { try { res.json({ success: true, data: await svc.getCustomerStatement(req.params.id) }); } catch(e){next(e);} };
const invoices  = async (req, res, next) => { try { res.json({ success: true, data: await svc.getCustomerInvoices(req.params.id) }); } catch(e){next(e);} };

module.exports = { add, getAll, getOne, update, remove, statement, invoices };
