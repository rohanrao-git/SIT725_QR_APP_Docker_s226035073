// Purpose: Define authentication API endpoints and map them to auth controller handlers.
const express = require('express');
const { registerOwner, loginUser, getMe, updateMe, updatePassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', registerOwner);
router.post('/login', loginUser);

router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.put('/me/password', protect, updatePassword);

module.exports = router;
