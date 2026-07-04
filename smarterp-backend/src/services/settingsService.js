const pool = require('../config/db');

const getSettings = async () => {
  const result = await pool.query(`SELECT * FROM company_settings LIMIT 1`);
  return result.rows[0] || null;
};

const updateSettings = async ({ company_name, address, mobile, email, gstin, state, logo_url }) => {
  // upsert — if row exists update it, else insert
  const existing = await pool.query(`SELECT id FROM company_settings LIMIT 1`);

  if (existing.rows.length) {
    const result = await pool.query(
      `UPDATE company_settings
       SET company_name=$1, address=$2, mobile=$3, email=$4,
           gstin=$5, state=$6, logo_url=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [company_name, address || null, mobile || null, email || null,
       gstin || null, state || null, logo_url || null, existing.rows[0].id]
    );
    return result.rows[0];
  } else {
    const result = await pool.query(
      `INSERT INTO company_settings (company_name, address, mobile, email, gstin, state, logo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [company_name, address || null, mobile || null, email || null,
       gstin || null, state || null, logo_url || null]
    );
    return result.rows[0];
  }
};

module.exports = { getSettings, updateSettings };
