const User = require('../models/User');
const sessionService = require('../services/sessionService');
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

async function startSession(req, res, next) {
  try {
    const { restaurantId, tableNumber } = req.body;
    if (!restaurantId || tableNumber === undefined) {
      throw new AppError('restaurantId and tableNumber are required', 400);
    }

    const parsedTableNumber = Number(tableNumber);
    const { session, created } = await sessionService.startOrGetActiveSession(
      restaurantId,
      parsedTableNumber
    );

    return res.status(created ? 201 : 200).json({
      success: true,
      session,
      created,
    });
  } catch (error) {
    return next(error);
  }
}

async function getActiveSession(req, res, next) {
  try {
    const { restaurantId, tableNumber } = req.query;
    if (!restaurantId || tableNumber === undefined) {
      throw new AppError('restaurantId and tableNumber query params are required', 400);
    }

    const session = await sessionService.getActiveSession(restaurantId, Number(tableNumber));
    return res.status(200).json({ success: true, session });
  } catch (error) {
    return next(error);
  }
}

async function getSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    const session = await sessionService.getSessionById(sessionId);
    return res.status(200).json({ success: true, session });
  } catch (error) {
    return next(error);
  }
}

async function closeSession(req, res, next) {
  try {
    const owner = await getOwnerContext(req.user.id);
    const { sessionId } = req.params;
    const session = await sessionService.closeSession(sessionId, owner.restaurantId);
    return res.status(200).json({ success: true, session });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  startSession,
  getActiveSession,
  getSession,
  closeSession,
};
