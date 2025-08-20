const express = require('express');
const router = express.Router();
const { getTransactions } = require('../controllers/transactionController');

router.get('/', getTransactions);
router.get('/account/:accountName', getTransactions);

module.exports = router;