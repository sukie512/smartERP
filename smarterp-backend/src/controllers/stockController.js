const svc = require('../services/stockService');

// groups
const addGroup    = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.addStockGroup(req.body) }); } catch(e){next(e);} };
const getGroups   = async (req, res, next) => { try { res.json({ success: true, data: await svc.getAllStockGroups() }); } catch(e){next(e);} };
const updateGroup = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateStockGroup(req.params.id, req.body) }); } catch(e){next(e);} };
const deleteGroup = async (req, res, next) => { try { await svc.deleteStockGroup(req.params.id); res.json({success:true,message:'Deleted'}); } catch(e){next(e);} };

// units
const getUnits = async (req, res, next) => { try { res.json({ success: true, data: await svc.getAllUnits() }); } catch(e){next(e);} };
const addUnit  = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.addUnit(req.body) }); } catch(e){next(e);} };

// items
const addItem      = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.addStockItem(req.body) }); } catch(e){next(e);} };
const getItems     = async (req, res, next) => { try { res.json({ success: true, data: await svc.getAllStockItems(req.query) }); } catch(e){next(e);} };
const getItem      = async (req, res, next) => { try { const d = await svc.getStockItemById(req.params.id); if(!d){return res.status(404).json({success:false,message:'Not found'});} res.json({success:true,data:d}); } catch(e){next(e);} };
const updateItem   = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateStockItem(req.params.id, req.body) }); } catch(e){next(e);} };
const deleteItem   = async (req, res, next) => { try { await svc.deleteStockItem(req.params.id); res.json({success:true,message:'Deleted'}); } catch(e){next(e);} };
const adjust       = async (req, res, next) => { try { await svc.manualAdjustment(req.body); res.json({success:true,message:'Stock adjusted'}); } catch(e){next(e);} };
const movements    = async (req, res, next) => { try { res.json({ success: true, data: await svc.getStockMovements(req.params.id) }); } catch(e){next(e);} };

module.exports = { addGroup, getGroups, updateGroup, deleteGroup, getUnits, addUnit, addItem, getItems, getItem, updateItem, deleteItem, adjust, movements };
