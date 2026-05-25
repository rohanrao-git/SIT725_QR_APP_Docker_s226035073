const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['super_admin', 'owner'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'disabled'],
      default: 'pending',
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
    },
    pendingRestaurantName: { type: String },
    pendingRestaurantAddress: { type: String },
    pendingRestaurantPhone: { type: String },
    pendingRestaurantEmail: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
