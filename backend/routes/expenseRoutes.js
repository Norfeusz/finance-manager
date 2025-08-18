const express = require('express');
const router = express.Router();
const { addTransaction, deleteTransaction, updateTransaction, deleteTransfer } = require('../controllers/expenseController');

router.post('/', addTransaction);
router.delete('/', deleteTransaction);
router.put('/', updateTransaction); // Nowa trasa PUT
router.delete('/transfer', deleteTransfer); // Trasa do usuwania transferów

module.exports = router;