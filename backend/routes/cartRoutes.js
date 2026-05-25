const express = require('express');
const {
  getCart,
  addItem,
  updateQuantity,
  removeItem,
  clearCart,
} = require('../controllers/cartController');

const router = express.Router();

// Guest: get cart for a session (no auth)
router.get('/:sessionId', getCart);

// Guest: add item to cart
router.post('/:sessionId/items', addItem);

// Guest: update item quantity (set to 0 to remove)
router.put('/:sessionId/items/:menuItemId', updateQuantity);

// Guest: remove a specific item from cart
router.delete('/:sessionId/items/:menuItemId', removeItem);

// Guest: clear entire cart
router.delete('/:sessionId', clearCart);

module.exports = router;
