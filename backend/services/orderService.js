const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const TableSession = require('../models/TableSession');
const MenuItem = require('../models/MenuItem');
const AppError = require('../utils/AppError');

async function getOrderById(orderId) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new AppError('Invalid order id', 400, 'INVALID_ORDER_ID');
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }
  return order;
}

async function placeOrder(sessionId) {
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    throw new AppError('Invalid session id', 400, 'INVALID_SESSION_ID');
  }

  const session = await TableSession.findById(sessionId);
  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }
  if (session.status !== 'active') {
    throw new AppError('Session is no longer active', 400, 'SESSION_CLOSED');
  }

  const cart = await Cart.findOne({ sessionId: session._id });
  if (!cart || cart.items.length === 0) {
    throw new AppError('Cart is empty', 400, 'CART_EMPTY');
  }

  const menuItemIds = cart.items.map((item) => item.menuItemId);
  const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } })
    .select('_id isAvailable restaurantId')
    .lean();
  const menuItemById = new Map(menuItems.map((item) => [String(item._id), item]));
  const unavailableItem = cart.items.find((item) => {
    const menuItem = menuItemById.get(String(item.menuItemId));
    return (
      !menuItem ||
      !menuItem.isAvailable ||
      String(menuItem.restaurantId) !== String(session.restaurantId)
    );
  });

  if (unavailableItem) {
    throw new AppError(
      `${unavailableItem.name} is no longer available. Please remove it from your cart.`,
      400,
      'CART_ITEM_UNAVAILABLE'
    );
  }

  const TAX_RATE = 0.1;
  const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const totalAmount = parseFloat((subtotal + tax).toFixed(2));

  const order = await Order.create({
    restaurantId: session.restaurantId,
    tableId: session.tableId,
    tableNumber: session.tableNumber,
    sessionId: session._id,
    sessionNumber: session.sessionNumber,
    items: cart.items.map((i) => ({
      menuItemId: i.menuItemId,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
    })),
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax,
    totalAmount,
  });

  cart.items = [];
  cart.subtotal = 0;
  await cart.save();

  return order;
}

module.exports = {
  getOrderById,
  placeOrder,
};
