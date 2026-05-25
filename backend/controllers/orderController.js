const orderService = require('../services/orderService');

async function getOrder(req, res, next) {
  try {
    const { orderId } = req.params;
    const order = await orderService.getOrderById(orderId);
    return res.status(200).json({ success: true, order });
  } catch (error) {
    return next(error);
  }
}

async function placeOrder(req, res, next) {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required' });
    }
    const order = await orderService.placeOrder(sessionId);
    return res.status(201).json({ success: true, order });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getOrder,
  placeOrder,
};
