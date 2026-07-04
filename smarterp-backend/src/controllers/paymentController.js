const svc = require('../services/paymentService');

const receive        = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.receivePayment(req.body) }); } catch(e){next(e);} };
const make           = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.makePayment(req.body) }); } catch(e){next(e);} };
const expense        = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.recordExpense(req.body) }); } catch(e){next(e);} };
const chequeStatus   = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateChequeStatus(req.body) }); } catch(e){next(e);} };
const allReceipts    = async (req, res, next) => { try { res.json({ success: true, data: await svc.getAllReceipts(req.query) }); } catch(e){next(e);} };
const allPayments    = async (req, res, next) => { try { res.json({ success: true, data: await svc.getAllPayments(req.query) }); } catch(e){next(e);} };

module.exports = { receive, make, expense, chequeStatus, allReceipts, allPayments };
