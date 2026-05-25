// Purpose: Define menu-related API endpoints and map them to menu controller handlers.
const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const AppError = require('../utils/AppError');
const {
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
} = require('../controllers/menuController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new AppError('Only image files are allowed', 400));
    }
    return cb(null, true);
  },
});

// Guest: public menu for QR scan (no auth)
router.get('/public/:restaurantId', getPublicMenu);
router.get('/images/:imageFileId', getMenuImage);

// Owner: read own menu and tables
router.get('/my', protect, authorize('owner'), getOwnerMenu);
router.get('/my/tables', protect, authorize('owner'), getOwnerTables);
router.post('/my/images', protect, authorize('owner'), upload.single('image'), uploadMenuImage);

// Owner: create a new menu item
router.post('/my', protect, authorize('owner'), createMenuItem);

// Owner: update or delete a specific menu item
router.put('/my/:itemId', protect, authorize('owner'), updateMenuItem);
router.delete('/my/:itemId', protect, authorize('owner'), deleteMenuItem);

// Owner: toggle availability of a menu item
router.patch('/my/:itemId/availability', protect, authorize('owner'), toggleAvailability);

// Super-admin: view any restaurant's full menu
router.get('/:restaurantId', protect, authorize('super_admin'), getMenuByRestaurant);

module.exports = router;
