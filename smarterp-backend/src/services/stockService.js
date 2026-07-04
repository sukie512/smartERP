const pool = require('../config/db');

// ─────────────────────────────────────────────
// STOCK GROUPS
// ─────────────────────────────────────────────

const addStockGroup = async ({ name }) => {
  const result = await pool.query(
    `INSERT INTO stock_groups (name) VALUES ($1) RETURNING *`, [name]
  );
  return result.rows[0];
};

const getAllStockGroups = async () => {
  const result = await pool.query(`SELECT * FROM stock_groups ORDER BY name`);
  return result.rows;
};

const updateStockGroup = async (id, { name }) => {
  const result = await pool.query(
    `UPDATE stock_groups SET name=$1 WHERE id=$2 RETURNING *`, [name, id]
  );
  return result.rows[0];
};

const deleteStockGroup = async (id) => {
  const items = await pool.query(
    `SELECT COUNT(*) FROM stock_items WHERE stock_group_id=$1`, [id]
  );
  if (parseInt(items.rows[0].count) > 0) {
    const err = new Error('Cannot delete group with existing stock items');
    err.status = 400;
    throw err;
  }
  await pool.query(`DELETE FROM stock_groups WHERE id=$1`, [id]);
};

// ─────────────────────────────────────────────
// UNITS
// ─────────────────────────────────────────────

const getAllUnits = async () => {
  const result = await pool.query(`SELECT * FROM units ORDER BY name`);
  return result.rows;
};

const addUnit = async ({ name }) => {
  const result = await pool.query(
    `INSERT INTO units (name) VALUES ($1) RETURNING *`, [name.toUpperCase()]
  );
  return result.rows[0];
};

// ─────────────────────────────────────────────
// STOCK ITEMS
// ─────────────────────────────────────────────

const addStockItem = async ({ name, sku, stock_group_id, unit_id, purchase_price, selling_price, gst_percentage, low_stock_threshold }) => {
  const result = await pool.query(
    `INSERT INTO stock_items
     (name, sku, stock_group_id, unit_id, purchase_price, selling_price, gst_percentage, low_stock_threshold)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [name, sku, stock_group_id || null, unit_id || null, purchase_price, selling_price, gst_percentage || 0, low_stock_threshold || 10]
  );
  return result.rows[0];
};

const getAllStockItems = async ({ search, group_id, low_stock } = {}) => {
  let query = `
    SELECT si.*,
           sg.name AS group_name,
           u.name  AS unit_name,
           (si.current_stock - si.reserved_stock - si.damaged_stock) AS available_stock,
           (si.current_stock * si.purchase_price) AS stock_value,
           CASE WHEN si.current_stock <= si.low_stock_threshold THEN true ELSE false END AS is_low_stock
    FROM stock_items si
    LEFT JOIN stock_groups sg ON sg.id = si.stock_group_id
    LEFT JOIN units u ON u.id = si.unit_id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (si.name ILIKE $${params.length} OR si.sku ILIKE $${params.length})`;
  }
  if (group_id) {
    params.push(group_id);
    query += ` AND si.stock_group_id = $${params.length}`;
  }
  if (low_stock === 'true') {
    query += ` AND si.current_stock <= si.low_stock_threshold`;
  }

  query += ` ORDER BY si.name`;
  const result = await pool.query(query, params);
  return result.rows;
};

const getStockItemById = async (id) => {
  const result = await pool.query(
    `SELECT si.*,
            sg.name AS group_name,
            u.name  AS unit_name,
            (si.current_stock - si.reserved_stock - si.damaged_stock) AS available_stock,
            (si.current_stock * si.purchase_price) AS stock_value
     FROM stock_items si
     LEFT JOIN stock_groups sg ON sg.id = si.stock_group_id
     LEFT JOIN units u ON u.id = si.unit_id
     WHERE si.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const updateStockItem = async (id, { name, stock_group_id, unit_id, purchase_price, selling_price, gst_percentage, low_stock_threshold }) => {
  const result = await pool.query(
    `UPDATE stock_items SET
       name=$1, stock_group_id=$2, unit_id=$3,
       purchase_price=$4, selling_price=$5,
       gst_percentage=$6, low_stock_threshold=$7,
       updated_at=NOW()
     WHERE id=$8 RETURNING *`,
    [name, stock_group_id || null, unit_id || null, purchase_price, selling_price, gst_percentage, low_stock_threshold, id]
  );
  return result.rows[0];
};

const deleteStockItem = async (id) => {
  const item = await getStockItemById(id);
  if (!item) { const e = new Error('Item not found'); e.status = 404; throw e; }
  if (item.current_stock > 0) {
    const e = new Error('Cannot delete item with stock on hand');
    e.status = 400; throw e;
  }
  await pool.query(`DELETE FROM stock_items WHERE id=$1`, [id]);
};

// ─────────────────────────────────────────────
// STOCK MOVEMENT (internal — called by invoice/purchase services)
// ─────────────────────────────────────────────

const adjustStock = async (client, stockItemId, quantity, movementType, referenceId, referenceType, note) => {
  // check available stock before reducing
  if (movementType === 'stock_out') {
    const item = await client.query(
      `SELECT current_stock, reserved_stock, damaged_stock FROM stock_items WHERE id=$1 FOR UPDATE`,
      [stockItemId]
    );
    const r = item.rows[0];
    const available = Number(r.current_stock) - Number(r.reserved_stock) - Number(r.damaged_stock);
    if (available < quantity) {
      const err = new Error(`Insufficient stock. Available: ${available}`);
      err.status = 400;
      throw err;
    }
    await client.query(
      `UPDATE stock_items SET current_stock = current_stock - $1, updated_at=NOW() WHERE id=$2`,
      [quantity, stockItemId]
    );
  } else if (movementType === 'stock_in') {
    await client.query(
      `UPDATE stock_items SET current_stock = current_stock + $1, updated_at=NOW() WHERE id=$2`,
      [quantity, stockItemId]
    );
  } else if (movementType === 'adjustment_add') {
    await client.query(
      `UPDATE stock_items SET current_stock = current_stock + $1, updated_at=NOW() WHERE id=$2`,
      [quantity, stockItemId]
    );
  } else if (movementType === 'adjustment_remove') {
    await client.query(
      `UPDATE stock_items SET current_stock = current_stock - $1, updated_at=NOW() WHERE id=$2`,
      [quantity, stockItemId]
    );
  } else if (movementType === 'damaged') {
    await client.query(
      `UPDATE stock_items SET damaged_stock = damaged_stock + $1, updated_at=NOW() WHERE id=$2`,
      [quantity, stockItemId]
    );
  } else if (movementType === 'transfer_out') {
    await client.query(
      `UPDATE stock_items SET current_stock = current_stock - $1, updated_at=NOW() WHERE id=$2`,
      [quantity, stockItemId]
    );
  } else if (movementType === 'transfer_in') {
    await client.query(
      `UPDATE stock_items SET current_stock = current_stock + $1, updated_at=NOW() WHERE id=$2`,
      [quantity, stockItemId]
    );
  }

  // log movement audit record
  await client.query(
    `INSERT INTO stock_movements (stock_item_id, movement_type, quantity, reference_id, reference_type, note)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [stockItemId, movementType, quantity, referenceId || null, referenceType || null, note || null]
  );
};

// ─── manual adjustment by user ────────────────────────────────────────────
const manualAdjustment = async ({ stock_item_id, adjustment_type, quantity, note }) => {
  if (!['adjustment_add', 'adjustment_remove', 'damaged'].includes(adjustment_type)) {
    const e = new Error('Invalid adjustment type'); e.status = 400; throw e;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await adjustStock(client, stock_item_id, quantity, adjustment_type, null, 'manual_adjustment', note);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── get movement history for an item ────────────────────────────────────
const getStockMovements = async (stockItemId) => {
  const result = await pool.query(
    `SELECT sm.*,
            TO_CHAR(sm.created_at, 'DD Mon YYYY HH24:MI') AS date
     FROM stock_movements sm
     WHERE sm.stock_item_id = $1
     ORDER BY sm.created_at DESC`,
    [stockItemId]
  );
  return result.rows;
};

module.exports = {
  addStockGroup, getAllStockGroups, updateStockGroup, deleteStockGroup,
  getAllUnits, addUnit,
  addStockItem, getAllStockItems, getStockItemById, updateStockItem, deleteStockItem,
  adjustStock, manualAdjustment, getStockMovements,
};
