const express = require('express');
const router = express.Router();
const { getTransactions } = require('../controllers/transactionController');

router.get('/', getTransactions);

module.exports = router;