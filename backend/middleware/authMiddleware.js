
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

async function protect(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Not authorized', 401, 'UNAUTHORIZED'));
  }
  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return next(new AppError('Not authorized', 401, 'UNAUTHORIZED'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('_id role email name');
    if (!user) {
      return next(new AppError('Not authorized', 401, 'UNAUTHORIZED'));
    }
    req.user = {
      id: String(user._id),
      role: user.role,
      email: user.email,
      name: user.name,
    };
    return next();
  } catch {
    return next(new AppError('Not authorized', 401, 'UNAUTHORIZED'));
  }
}

module.exports = { protect };
