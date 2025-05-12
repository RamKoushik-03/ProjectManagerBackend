const express = require('express');
const {protect, adminOnly } = require('../middlewares/authMiddleware');
const router = express.Router();

const{
    exportTasksReport,
    exportUsersReport,
} = require('../controllers/reportController');

router.get("/export/tasks",protect,adminOnly,exportTasksReport);//Export all tasks as Excel/PDF
router.get("/export/users",protect,adminOnly,exportUsersReport);//Export user-task report

module.exports = router;