const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

// test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('DB connection failed:', err.message);
  } else {
    console.log('PostgreSQL connected successfully');
    release();
  }
});

module.exports = pool;
