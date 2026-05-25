const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  getPendingOwners,
  getAllOwners,
  approveOwner,
  rejectOwner,
  disableOwner,
  enableOwner,
  getAllRestaurants,
  setTables,
  getTablesByRestaurant,
} = require('../controllers/adminController');

const router = express.Router();

router.use(protect, authorize('super_admin'));

router.get('/owners/pending', getPendingOwners);
router.get('/owners', getAllOwners);
router.patch('/owners/:id/approve', approveOwner);
router.patch('/owners/:id/reject', rejectOwner);
router.patch('/owners/:id/disable', disableOwner);
router.patch('/owners/:id/enable', enableOwner);
router.get('/restaurants', getAllRestaurants);
router.post('/restaurants/:id/tables', setTables);
router.get('/restaurants/:id/tables', getTablesByRestaurant);

module.exports = router;
