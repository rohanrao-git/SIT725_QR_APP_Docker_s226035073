// Purpose: Implement menu item business logic (create, read, update, delete, availability).
const mongoose = require('mongoose');
const User = require('../models/User');
const menuService = require('../services/menuService');
const AppError = require('../utils/AppError');

const IMAGE_BUCKET_NAME = 'menu_images';

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

function emitMenuUpdated(req, restaurantId) {
  const io = req.app.get('io');
  if (!io) return;

  io.to(`restaurant:${restaurantId}`).emit('menuUpdated', {
    restaurantId: String(restaurantId),
  });
}

function getImageBucket() {
  if (!mongoose.connection.db) {
    throw new AppError('Database connection is not ready', 503);
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: IMAGE_BUCKET_NAME,
  });
}

function uploadBufferToGridFS(file, owner) {
  const bucket = getImageBucket();
  const filename = `${owner.restaurantId}-${Date.now()}-${file.originalname}`;

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: file.mimetype,
      metadata: {
        restaurantId: String(owner.restaurantId),
        ownerId: String(owner._id),
        originalName: file.originalname,
      },
    });

    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve({ _id: uploadStream.id }));
    uploadStream.end(file.buffer);
  });
}

async function getOwnerMenu(req, res, next) {
  try {
    const owner = await getOwnerContext(req.user.id);
    const menu = await menuService.getMenuByOwner(owner.restaurantId);
    return res.status(200).json({ success: true, menu });
  } catch (error) {
    return next(error);
  }
}

async function getOwnerTables(req, res, next) {
  try {
    const owner = await getOwnerContext(req.user.id);
    const tables = await menuService.getTablesByOwner(owner.restaurantId);
    return res.status(200).json({ success: true, tables });
  } catch (error) {
    return next(error);
  }
}

async function getMenuByRestaurant(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const menu = await menuService.getMenuByRestaurantId(restaurantId);
    return res.status(200).json({ success: true, menu });
  } catch (error) {
    return next(error);
  }
}

async function getPublicMenu(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const menu = await menuService.getPublicMenuByRestaurantId(restaurantId);
    return res.status(200).json({ success: true, menu });
  } catch (error) {
    return next(error);
  }
}

async function uploadMenuImage(req, res, next) {
  try {
    const owner = await getOwnerContext(req.user.id);
    if (!req.file) {
      throw new AppError('Image file is required', 400);
    }
    if (!req.file.mimetype.startsWith('image/')) {
      throw new AppError('Only image files are allowed', 400);
    }

    const storedFile = await uploadBufferToGridFS(req.file, owner);
    const imageFileId = String(storedFile._id);

    return res.status(201).json({
      success: true,
      imageFileId,
      imageUrl: `/api/menu/images/${imageFileId}`,
    });
  } catch (error) {
    return next(error);
  }
}

async function getMenuImage(req, res, next) {
  try {
    const { imageFileId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(imageFileId)) {
      throw new AppError('Invalid image id', 400);
    }

    const bucket = getImageBucket();
    const objectId = new mongoose.Types.ObjectId(imageFileId);
    const files = await bucket.find({ _id: objectId }).toArray();
    const file = files[0];
    if (!file) {
      throw new AppError('Image not found', 404);
    }

    res.set('Content-Type', file.contentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');

    return bucket.openDownloadStream(objectId)
      .on('error', next)
      .pipe(res);
  } catch (error) {
    return next(error);
  }
}

async function createMenuItem(req, res, next) {
  try {
    const owner = await getOwnerContext(req.user.id);
    const {
      name,
      category,
      dietaryType,
      description,
      price,
      image,
      imageFileId,
      isAvailable,
    } = req.body;
    if (!name || price === undefined) {
      throw new AppError('Name and price are required', 400);
    }
    const item = await menuService.createMenuItem(owner.restaurantId, {
      name,
      category,
      dietaryType,
      description,
      price,
      image,
      imageFileId,
      isAvailable,
    });
    emitMenuUpdated(req, owner.restaurantId);
    return res.status(201).json({ success: true, item });
  } catch (error) {
    return next(error);
  }
}

async function updateMenuItem(req, res, next) {
  try {
    const owner = await getOwnerContext(req.user.id);
    const { itemId } = req.params;
    const item = await menuService.updateMenuItem(owner.restaurantId, itemId, req.body);
    emitMenuUpdated(req, owner.restaurantId);
    return res.status(200).json({ success: true, item });
  } catch (error) {
    return next(error);
  }
}

async function deleteMenuItem(req, res, next) {
  try {
    const owner = await getOwnerContext(req.user.id);
    const { itemId } = req.params;
    await menuService.deleteMenuItem(owner.restaurantId, itemId);
    emitMenuUpdated(req, owner.restaurantId);
    return res.status(200).json({ success: true, message: 'Menu item deleted' });
  } catch (error) {
    return next(error);
  }
}

async function toggleAvailability(req, res, next) {
  try {
    const owner = await getOwnerContext(req.user.id);
    const { itemId } = req.params;
    const { isAvailable } = req.body;
    if (typeof isAvailable !== 'boolean') {
      throw new AppError('isAvailable must be a boolean', 400);
    }
    const item = await menuService.setAvailability(owner.restaurantId, itemId, isAvailable);
    emitMenuUpdated(req, owner.restaurantId);
    return res.status(200).json({ success: true, item });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getOwnerMenu,
  getOwnerTables,
  getMenuByRestaurant,
  getPublicMenu,
  uploadMenuImage,
  getMenuImage,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
};
