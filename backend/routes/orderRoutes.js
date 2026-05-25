const express = require('express');
const { getOrder, placeOrder } = require('../controllers/orderController');

const router = express.Router();

// Guest: place an order from the current cart (no auth)
router.post('/', placeOrder);

// Guest: get order by id (no auth)
router.get('/:orderId', getOrder);

module.exports = router;
