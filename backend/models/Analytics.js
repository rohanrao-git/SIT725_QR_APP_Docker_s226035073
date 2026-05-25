const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    date: { type: Date, required: true },
    totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    topItem: { type: String },
    busiestTable: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Analytics', analyticsSchema);
