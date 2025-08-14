const express = require('express');
const router = express.Router();
const { addTransaction, deleteTransaction, updateTransaction } = require('../controllers/expenseController');

router.post('/', addTransaction);
router.delete('/', deleteTransaction);
router.put('/', updateTransaction); // Nowa trasa PUT

module.exports = router;