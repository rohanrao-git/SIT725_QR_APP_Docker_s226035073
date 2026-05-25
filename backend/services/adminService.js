const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Table = require('../models/Table');
const generateQR = require('../utils/generateQR');
const AppError = require('../utils/AppError');
const mongoose = require('mongoose');

async function getPendingOwners() {
  return User.find({ role: 'owner', status: 'pending' });
}

async function getAllOwners() {
  return User.find({ role: 'owner' })
    .select('-password')
    .populate('restaurantId', 'name address phone email totalTables isActive');
}

async function approveOwner(ownerId) {
  if (!mongoose.Types.ObjectId.isValid(ownerId)) {
    throw new AppError('Invalid owner id', 400, 'INVALID_OWNER_ID');
  }
  const user = await User.findById(ownerId);
  if (!user) {
    throw new AppError('Owner not found', 404, 'OWNER_NOT_FOUND');
  }
  if (user.role !== 'owner') {
    throw new AppError('User is not an owner', 400, 'NOT_OWNER_ROLE');
  }
  if (user.restaurantId) {
    throw new AppError('Owner already has a linked restaurant', 409, 'OWNER_ALREADY_LINKED');
  }

  const restaurantName = user.pendingRestaurantName || user.name;
  const restaurantAddress = user.pendingRestaurantAddress || 'Address pending update';

  user.status = 'approved';

  const restaurant = await Restaurant.create({
    name: restaurantName,
    address: restaurantAddress,
    phone: user.pendingRestaurantPhone || '',
    email: user.pendingRestaurantEmail || '',
    ownerId: user._id,
  });

  user.restaurantId = restaurant._id;
  user.pendingRestaurantName = undefined;
  user.pendingRestaurantAddress = undefined;
  user.pendingRestaurantPhone = undefined;
  user.pendingRestaurantEmail = undefined;
  await user.save();

  return user;
}

async function rejectOwner(ownerId) {
  if (!mongoose.Types.ObjectId.isValid(ownerId)) {
    throw new AppError('Invalid owner id', 400, 'INVALID_OWNER_ID');
  }
  const user = await User.findById(ownerId);
  if (!user) {
    throw new AppError('Owner not found', 404, 'OWNER_NOT_FOUND');
  }

  user.status = 'rejected';
  await user.save();
  return user;
}

async function disableOwner(ownerId) {
  if (!mongoose.Types.ObjectId.isValid(ownerId)) {
    throw new AppError('Invalid owner id', 400, 'INVALID_OWNER_ID');
  }
  const user = await User.findById(ownerId);
  if (!user) {
    throw new AppError('Owner not found', 404, 'OWNER_NOT_FOUND');
  }

  user.status = 'disabled';
  await user.save();
  return user;
}

async function enableOwner(ownerId) {
  if (!mongoose.Types.ObjectId.isValid(ownerId)) {
    throw new AppError('Invalid owner id', 400, 'INVALID_OWNER_ID');
  }
  const user = await User.findById(ownerId);
  if (!user) {
    throw new AppError('Owner not found', 404, 'OWNER_NOT_FOUND');
  }
  if (user.role !== 'owner') {
    throw new AppError('User is not an owner', 400, 'NOT_OWNER_ROLE');
  }
  if (user.status !== 'disabled') {
    throw new AppError('Owner account is not disabled', 400, 'OWNER_NOT_DISABLED');
  }

  user.status = 'approved';
  await user.save();
  return user;
}

async function getAllRestaurants() {
  return Restaurant.find().populate('ownerId', 'name email');
}

async function setTables(restaurantId, totalTables) {
  if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new AppError('Invalid restaurant id', 400, 'INVALID_RESTAURANT_ID');
  }
  if (!Number.isInteger(totalTables) || totalTables < 0) {
    throw new AppError('totalTables must be a non-negative integer', 400, 'INVALID_TOTAL_TABLES');
  }
  const restaurant = await Restaurant.findById(restaurantId).select('_id');
  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, 'RESTAURANT_NOT_FOUND');
  }

  await Table.deleteMany({ restaurantId });

  const tableDocs = [];
  for (let tableNumber = 1; tableNumber <= totalTables; tableNumber += 1) {
    const qrCodeUrl = await generateQR(restaurantId, tableNumber);
    tableDocs.push({
      restaurantId,
      tableNumber,
      qrCodeUrl,
    });
  }

  const createdTables = tableDocs.length ? await Table.insertMany(tableDocs) : [];

  await Restaurant.findByIdAndUpdate(restaurantId, { totalTables });

  return createdTables;
}

async function getTablesByRestaurant(restaurantId) {
  if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new AppError('Invalid restaurant id', 400, 'INVALID_RESTAURANT_ID');
  }
  const restaurant = await Restaurant.findById(restaurantId).select('_id');
  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, 'RESTAURANT_NOT_FOUND');
  }
  return Table.find({ restaurantId });
}

module.exports = {
  getPendingOwners,
  getAllOwners,
  approveOwner,
  rejectOwner,
  disableOwner,
  enableOwner,
  getAllRestaurants,
  setTables,
  getTablesByRestaurant,
};

