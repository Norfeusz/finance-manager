const express = require('express');
const router = express.Router();
const { getShoppingStats } = require('../controllers/statisticsController');

router.get('/shopping', getShoppingStats);

module.exports = router;