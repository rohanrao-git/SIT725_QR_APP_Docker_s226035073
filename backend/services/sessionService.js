const mongoose = require('mongoose');
const TableSession = require('../models/TableSession');
const Restaurant = require('../models/Restaurant');
const Table = require('../models/Table');
const AppError = require('../utils/AppError');

async function resolveTable(restaurantId, tableNumber) {
  if (!Number.isInteger(tableNumber) || tableNumber < 1) {
    throw new AppError('tableNumber must be a positive integer', 400, 'INVALID_TABLE_NUMBER');
  }

  const table = await Table.findOne({ restaurantId, tableNumber });
  if (!table) {
    throw new AppError('Table not found', 404, 'TABLE_NOT_FOUND');
  }
  if (!table.isActive) {
    throw new AppError('Table is not available', 403, 'TABLE_INACTIVE');
  }
  return table;
}

async function assertActiveRestaurant(restaurantId) {
  if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new AppError('Invalid restaurant id', 400, 'INVALID_RESTAURANT_ID');
  }

  const restaurant = await Restaurant.findById(restaurantId).select('isActive');
  if (!restaurant || !restaurant.isActive) {
    throw new AppError('Restaurant not found', 404, 'RESTAURANT_NOT_FOUND');
  }
}

async function getNextSessionNumber(restaurantId) {
  const latest = await TableSession.findOne({ restaurantId })
    .sort({ sessionNumber: -1 })
    .select('sessionNumber');
  return (latest?.sessionNumber ?? 0) + 1;
}

async function startOrGetActiveSession(restaurantId, tableNumber) {
  await assertActiveRestaurant(restaurantId);
  const table = await resolveTable(restaurantId, tableNumber);

  const existing = await TableSession.findOne({
    restaurantId,
    tableId: table._id,
    status: 'active',
  });

  if (existing) {
    return { session: existing, created: false };
  }

  const sessionNumber = await getNextSessionNumber(restaurantId);
  const session = await TableSession.create({
    restaurantId,
    tableId: table._id,
    tableNumber: table.tableNumber,
    sessionNumber,
    status: 'active',
    openedAt: new Date(),
  });

  return { session, created: true };
}

async function getActiveSession(restaurantId, tableNumber) {
  await assertActiveRestaurant(restaurantId);
  const table = await resolveTable(restaurantId, tableNumber);

  const session = await TableSession.findOne({
    restaurantId,
    tableId: table._id,
    status: 'active',
  });

  if (!session) {
    throw new AppError('No active session for this table', 404, 'SESSION_NOT_FOUND');
  }

  return session;
}

async function getSessionById(sessionId) {
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    throw new AppError('Invalid session id', 400, 'INVALID_SESSION_ID');
  }

  const session = await TableSession.findById(sessionId);
  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  return session;
}

async function closeSession(sessionId, restaurantId) {
  const session = await getSessionById(sessionId);

  if (String(session.restaurantId) !== String(restaurantId)) {
    throw new AppError('Session does not belong to this restaurant', 403, 'SESSION_FORBIDDEN');
  }

  if (session.status === 'closed') {
    throw new AppError('Session is already closed', 400, 'SESSION_ALREADY_CLOSED');
  }

  session.status = 'closed';
  session.closedAt = new Date();
  await session.save();

  return session;
}

module.exports = {
  startOrGetActiveSession,
  getActiveSession,
  getSessionById,
  closeSession,
};
