const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  getMySummary,
  getMyPeakHours,
  getMyItemForecast,
} = require('../controllers/analyticsController');

const router = express.Router();

router.get('/my/summary', protect, authorize('owner'), getMySummary);
router.get('/my/peak-hours', protect, authorize('owner'), getMyPeakHours);
router.get('/my/item-forecast', protect, authorize('owner'), getMyItemForecast);

module.exports = router;
