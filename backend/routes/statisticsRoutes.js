const express = require('express');
const router = express.Router();
const { getShoppingStats, getCategoryAverages } = require('../controllers/statisticsController');

router.get('/shopping', getShoppingStats);
router.get('/shopping/averages', getCategoryAverages);

module.exports = router;