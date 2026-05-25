const cartService = require('../services/cartService');

async function getCart(req, res, next) {
  try {
    const { sessionId } = req.params;
    const cart = await cartService.getCart(sessionId);
    return res.status(200).json({ success: true, cart });
  } catch (error) {
    return next(error);
  }
}

async function addItem(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { menuItemId, quantity = 1 } = req.body;
    if (!menuItemId) {
      return res.status(400).json({ success: false, message: 'menuItemId is required' });
    }
    const cart = await cartService.addItem(sessionId, menuItemId, Number(quantity));
    return res.status(200).json({ success: true, cart });
  } catch (error) {
    return next(error);
  }
}

async function updateQuantity(req, res, next) {
  try {
    const { sessionId, menuItemId } = req.params;
    const { quantity } = req.body;
    if (quantity === undefined) {
      return res.status(400).json({ success: false, message: 'quantity is required' });
    }
    const cart = await cartService.updateQuantity(sessionId, menuItemId, Number(quantity));
    return res.status(200).json({ success: true, cart });
  } catch (error) {
    return next(error);
  }
}

async function removeItem(req, res, next) {
  try {
    const { sessionId, menuItemId } = req.params;
    const cart = await cartService.removeItem(sessionId, menuItemId);
    return res.status(200).json({ success: true, cart });
  } catch (error) {
    return next(error);
  }
}

async function clearCart(req, res, next) {
  try {
    const { sessionId } = req.params;
    const cart = await cartService.clearCart(sessionId);
    return res.status(200).json({ success: true, cart });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getCart,
  addItem,
  updateQuantity,
  removeItem,
  clearCart,
};
