const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const notificationController = require('../controllers/notificationController');

// Admin routes - requires both authentication and admin role
router.post('/', protect, adminOnly, notificationController.createNotification);

// User routes - requires authentication but not admin role
router.get('/user', protect, notificationController.getUserNotifications);
router.post('/read', protect, notificationController.markAsRead);

module.exports = router;