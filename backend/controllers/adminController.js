const adminService = require('../services/adminService');

async function getPendingOwners(req, res, next) {
  try {
    const owners = await adminService.getPendingOwners();
    return res.status(200).json({ success: true, owners });
  } catch (error) {
    return next(error);
  }
}

async function getAllOwners(req, res, next) {
  try {
    const owners = await adminService.getAllOwners();
    return res.status(200).json({ success: true, owners });
  } catch (error) {
    return next(error);
  }
}

async function approveOwner(req, res, next) {
  try {
    const { id } = req.params;
    const user = await adminService.approveOwner(id);
    return res.status(200).json({ success: true, user });
  } catch (error) {
    return next(error);
  }
}

async function rejectOwner(req, res, next) {
  try {
    const { id } = req.params;
    const user = await adminService.rejectOwner(id);
    return res.status(200).json({ success: true, user });
  } catch (error) {
    return next(error);
  }
}

async function disableOwner(req, res, next) {
  try {
    const { id } = req.params;
    const user = await adminService.disableOwner(id);
    return res.status(200).json({ success: true, user });
  } catch (error) {
    return next(error);
  }
}

async function enableOwner(req, res, next) {
  try {
    const { id } = req.params;
    const user = await adminService.enableOwner(id);
    return res.status(200).json({ success: true, user });
  } catch (error) {
    return next(error);
  }
}

async function getAllRestaurants(req, res, next) {
  try {
    const restaurants = await adminService.getAllRestaurants();
    return res.status(200).json({ success: true, restaurants });
  } catch (error) {
    return next(error);
  }
}

async function setTables(req, res, next) {
  try {
    const { id } = req.params;
    const { totalTables } = req.body;
    const tables = await adminService.setTables(id, totalTables);
    return res.status(201).json({ success: true, tables });
  } catch (error) {
    return next(error);
  }
}

async function getTablesByRestaurant(req, res, next) {
  try {
    const { id } = req.params;
    const tables = await adminService.getTablesByRestaurant(id);
    return res.status(200).json({ success: true, tables });
  } catch (error) {
    return next(error);
  }
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
