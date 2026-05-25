const mongoose = require('mongoose');

const tableSessionSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      required: true,
    },
    tableNumber: { type: Number },
    sessionNumber: { type: Number },
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
    },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TableSession', tableSessionSchema);
