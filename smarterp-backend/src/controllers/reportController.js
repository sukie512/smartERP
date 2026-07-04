const svc = require('../services/reportService');

const dashboard         = async (req, res, next) => { try { res.json({ success: true, data: await svc.getDashboardSummary() }); } catch(e){next(e);} };
const salesSummary      = async (req, res, next) => { try { res.json({ success: true, data: await svc.getSalesSummary(req.query) }); } catch(e){next(e);} };
const dailySales        = async (req, res, next) => { try { res.json({ success: true, data: await svc.getDailySales(req.query) }); } catch(e){next(e);} };
const monthlySales      = async (req, res, next) => { try { res.json({ success: true, data: await svc.getMonthlySales(req.query) }); } catch(e){next(e);} };
const topCustomers      = async (req, res, next) => { try { res.json({ success: true, data: await svc.getTopCustomers(req.query) }); } catch(e){next(e);} };
const purchaseSummary   = async (req, res, next) => { try { res.json({ success: true, data: await svc.getPurchaseSummary(req.query) }); } catch(e){next(e);} };
const purchaseRegister  = async (req, res, next) => { try { res.json({ success: true, data: await svc.getPurchaseRegister(req.query) }); } catch(e){next(e);} };
const supplierSummary   = async (req, res, next) => { try { res.json({ success: true, data: await svc.getSupplierSummary(req.query) }); } catch(e){next(e);} };
const stockSummary      = async (req, res, next) => { try { res.json({ success: true, data: await svc.getStockSummary() }); } catch(e){next(e);} };
const lowStock          = async (req, res, next) => { try { res.json({ success: true, data: await svc.getLowStockItems() }); } catch(e){next(e);} };
const itemMovement      = async (req, res, next) => { try { res.json({ success: true, data: await svc.getItemMovementReport(req.query) }); } catch(e){next(e);} };
const gstSummary        = async (req, res, next) => { try { res.json({ success: true, data: await svc.getGSTSummary(req.query) }); } catch(e){next(e);} };
const gstRegister       = async (req, res, next) => { try { res.json({ success: true, data: await svc.getGSTRegister(req.query) }); } catch(e){next(e);} };
const trialBalance      = async (req, res, next) => { try { res.json({ success: true, data: await svc.getTrialBalance() }); } catch(e){next(e);} };
const profitLoss        = async (req, res, next) => { try { res.json({ success: true, data: await svc.getProfitAndLoss(req.query) }); } catch(e){next(e);} };
const balanceSheet      = async (req, res, next) => { try { res.json({ success: true, data: await svc.getBalanceSheet() }); } catch(e){next(e);} };
const cashFlow          = async (req, res, next) => { try { res.json({ success: true, data: await svc.getCashFlowStatement(req.query) }); } catch(e){next(e);} };

module.exports = {
  dashboard, salesSummary, dailySales, monthlySales, topCustomers,
  purchaseSummary, purchaseRegister, supplierSummary,
  stockSummary, lowStock, itemMovement,
  gstSummary, gstRegister,
  trialBalance, profitLoss, balanceSheet, cashFlow,
};
