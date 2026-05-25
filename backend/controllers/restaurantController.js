const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const AppError = require('../utils/AppError');

async function getOwnerRestaurant(userId) {
  const owner = await User.findById(userId).select('restaurantId status role');
  if (!owner || owner.role !== 'owner') throw new AppError('Owner not found', 404);
  if (owner.status !== 'approved') throw new AppError('Account is not approved', 403);
  if (!owner.restaurantId) throw new AppError('No restaurant linked to this account', 404);

  const restaurant = await Restaurant.findById(owner.restaurantId);
  if (!restaurant) throw new AppError('Restaurant not found', 404);
  return restaurant;
}

async function getMyRestaurant(req, res, next) {
  try {
    const restaurant = await getOwnerRestaurant(req.user.id);
    return res.status(200).json({ success: true, restaurant });
  } catch (err) {
    return next(err);
  }
}

async function updateMyRestaurant(req, res, next) {
  try {
    const { name, address, phone, email } = req.body;
    if (!name && !address && !phone && !email) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    const restaurant = await getOwnerRestaurant(req.user.id);

    if (name) restaurant.name = name.trim();
    if (address) restaurant.address = address.trim();
    if (phone !== undefined) restaurant.phone = phone.trim();
    if (email !== undefined) restaurant.email = email.trim().toLowerCase();
    await restaurant.save();

    return res.status(200).json({ success: true, restaurant });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getMyRestaurant, updateMyRestaurant };
