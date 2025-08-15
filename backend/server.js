console.log('SERVER działa') 

const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: './.env' });

const expenseRoutes = require('./routes/expenseRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const statisticsRoutes = require('./routes/statisticsRoutes');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Rejestracja tras
app.use('/api/expenses', expenseRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/statistics', statisticsRoutes);


app.listen(port, () => {
  console.log(`🚀 Serwer nasłuchuje na porcie ${port}`);
});


// połączenie z PostgresSQL
const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'manager_finansow',
  password: process.env.PG_PASSWORD,
  port: 1906,
});
module.exports = pool;