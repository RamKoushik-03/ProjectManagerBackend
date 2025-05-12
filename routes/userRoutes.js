const express = require('express');
const { protect, adminOnly } = require('../middlewares/authMiddleware'); 
const {
  getAllUsers,
  getUserById,
  deleteUser,
  
} = require('../controllers/userController'); // assuming these are defined

const router = express.Router();

// user management routes
router.get("/", protect, adminOnly, getAllUsers);
router.get("/:id", protect, adminOnly, getUserById);
router.delete("/:id", protect, adminOnly, deleteUser);
router.put("/:id", protect, adminOnly,);

module.exports = router;
