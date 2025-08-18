const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'manager_finansow',
  password: process.env.PG_PASSWORD,
  port: 1906,
});

module.exports = pool;
