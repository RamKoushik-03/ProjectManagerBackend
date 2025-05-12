const express = require('express');
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  updateTaskChecklist,
  getDashboardData,
  getUserDashboardData,
} = require('../controllers/taskController');

const router = express.Router();

// Dashboard Routes (place these before parameterized routes)
router.get('/dashboard', protect, getDashboardData);
router.get('/user-dashboard', protect, getUserDashboardData);

// Task CRUD Routes
router.route('/').get(protect, getTasks).post(protect, createTask);

router
  .route('/:id')
  .get(protect, getTaskById)
  .put(protect, updateTask)
  .delete(protect, deleteTask);

// Task Sub-Resource Routes
router.put('/:id/status', protect, updateTaskStatus);
router.put('/:id/checklist', protect, updateTaskChecklist);

module.exports = router;
