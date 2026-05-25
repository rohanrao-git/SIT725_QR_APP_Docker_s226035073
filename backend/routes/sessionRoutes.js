const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  startSession,
  getActiveSession,
  getSession,
  closeSession,
} = require('../controllers/sessionController');

const router = express.Router();

// Guest: start or resume dining session for a table (no auth)
router.post('/start', startSession);
router.get('/active', getActiveSession);
router.get('/:sessionId', getSession);

// Owner: close a table session
router.patch('/:sessionId/close', protect, authorize('owner'), closeSession);

module.exports = router;
