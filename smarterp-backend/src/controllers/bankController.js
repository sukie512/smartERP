const svc = require('../services/bankService');

const add              = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.addBankAccount(req.body) }); } catch(e){next(e);} };
const getAll           = async (req, res, next) => { try { res.json({ success: true, data: await svc.getAllBankAccounts() }); } catch(e){next(e);} };
const getOne           = async (req, res, next) => { try { const d = await svc.getBankAccountById(req.params.id); if(!d){return res.status(404).json({success:false,message:'Not found'});} res.json({success:true,data:d}); } catch(e){next(e);} };
const transfer         = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.transferFunds(req.body) }); } catch(e){next(e);} };
const reconcile        = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.reconcileBank(req.body) }); } catch(e){next(e);} };
const reconcileHistory = async (req, res, next) => { try { res.json({ success: true, data: await svc.getReconciliationHistory(req.params.id) }); } catch(e){next(e);} };
const transactions     = async (req, res, next) => { try { res.json({ success: true, data: await svc.getBankTransactions(req.params.id) }); } catch(e){next(e);} };
const pendingCheques   = async (req, res, next) => { try { res.json({ success: true, data: await svc.getPendingCheques() }); } catch(e){next(e);} };

module.exports = { add, getAll, getOne, transfer, reconcile, reconcileHistory, transactions, pendingCheques };
