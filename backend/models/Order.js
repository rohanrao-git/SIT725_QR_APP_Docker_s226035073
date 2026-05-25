const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
    },
    name: { type: String },
    price: { type: Number },
    quantity: { type: Number },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
    },
    tableNumber: { type: Number },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TableSession',
    },
    sessionNumber: { type: Number },
    items: { type: [orderItemSchema], default: [] },
    subtotal: { type: Number },
    tax: { type: Number },
    totalAmount: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
