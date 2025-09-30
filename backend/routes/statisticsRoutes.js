const express = require('express')
const router = express.Router()
const {
	getShoppingStats,
	getCategoryAverages,
	getAverageMonthlyExpenses,
} = require('../controllers/statisticsController')

router.get('/shopping', getShoppingStats)
router.get('/shopping/averages', getCategoryAverages)
router.get('/average-expenses', getAverageMonthlyExpenses)

module.exports = router
