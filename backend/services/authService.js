const bcrypt = require('bcryptjs');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const AppError = require('../utils/AppError');

function stripPassword(doc) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  delete o.password;
  return o;
}

async function registerOwner({
  name,
  email,
  password,
  pendingRestaurantName,
  pendingRestaurantAddress,
  pendingRestaurantPhone,
  pendingRestaurantEmail,
}) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('Email already registered', 409, 'EMAIL_ALREADY_REGISTERED');
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: 'owner',
    status: 'pending',
    pendingRestaurantName,
    pendingRestaurantAddress,
    pendingRestaurantPhone,
    pendingRestaurantEmail,
  });
  return stripPassword(user);
}

async function loginUser({ email, password }) {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  if (user.role === 'owner' && user.status !== 'approved') {
    throw new AppError('Account is not approved', 403, 'OWNER_NOT_APPROVED');
  }
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  const token = generateToken(user._id);
  return { token, user: stripPassword(user) };
}

async function getMe(userId) {
  const user = await User.findById(userId).select('-password');
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return user;
}

async function updateMe(userId, { name, email }) {
  if (!name && !email) throw new AppError('Nothing to update', 400, 'NO_CHANGES');

  if (email) {
    const existing = await User.findOne({ email, _id: { $ne: userId } });
    if (existing) throw new AppError('Email already in use', 409, 'EMAIL_TAKEN');
  }

  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  if (name) user.name = name.trim();
  if (email) user.email = email.trim().toLowerCase();
  await user.save();
  return stripPassword(user);
}

async function updatePassword(userId, { currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) {
    throw new AppError('Current and new password are required', 400, 'MISSING_FIELDS');
  }
  if (newPassword.length < 6) {
    throw new AppError('New password must be at least 6 characters', 400, 'PASSWORD_TOO_SHORT');
  }

  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) throw new AppError('Current password is incorrect', 401, 'WRONG_PASSWORD');

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
}

module.exports = { registerOwner, loginUser, getMe, updateMe, updatePassword };
