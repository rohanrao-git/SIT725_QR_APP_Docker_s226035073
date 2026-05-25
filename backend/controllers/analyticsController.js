const User = require('../models/User');
const analyticsService = require('../services/analyticsService');
const AppError = require('../utils/AppError');

async function getOwnerContext(userId) {
  const owner = await User.findById(userId).select('role status restaurantId');
  if (!owner || owner.role !== 'owner') {
    throw new AppError('Owner account not found', 404);
  }
  if (owner.status !== 'approved') {
    throw new AppError('Account is not approved', 403);
  }
  if (!owner.restaurantId) {
    throw new AppError('Owner has no linked restaurant', 404);
  }
  return owner;
}

async function getMySummary(req, res, next) {
  try {
    const owner = await getOwnerContext(req.user.id);
    const { from, to } = req.query;
    const summary = await analyticsService.getSummaryForRestaurant(
      owner.restaurantId,
      from,
      to
    );
    return res.status(200).json({ success: true, summary });
  } catch (error) {
    return next(error);
  }
}

function resolveDaysFromQuery(from, to) {
  if (!from || !to) return 30;
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 30;
  }
  const diffMs = end.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.min(Math.max(days, 1), 365);
}

async function getMyPeakHours(req, res, next) {
  try {
    const owner = await getOwnerContext(req.user.id);
    const days = resolveDaysFromQuery(req.query.from, req.query.to);
    const peakHours = await analyticsService.getPeakHours(owner.restaurantId, days);
    return res.status(200).json({ success: true, peakHours });
  } catch (error) {
    return next(error);
  }
}

async function getMyItemForecast(req, res, next) {
  try {
    const owner = await getOwnerContext(req.user.id);
    const days = resolveDaysFromQuery(req.query.from, req.query.to);
    const forecast = await analyticsService.getItemSalesForecast(owner.restaurantId, days);
    return res.status(200).json({ success: true, forecast });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getMySummary,
  getMyPeakHours,
  getMyItemForecast,
};
