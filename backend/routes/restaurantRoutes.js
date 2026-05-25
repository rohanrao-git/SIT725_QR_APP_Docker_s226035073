// Purpose: Define restaurant API endpoints and map them to restaurant controller handlers.
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { getMyRestaurant, updateMyRestaurant } = require('../controllers/restaurantController');

const router = express.Router();

router.get('/my', protect, authorize('owner'), getMyRestaurant);
router.put('/my', protect, authorize('owner'), updateMyRestaurant);

module.exports = router;
