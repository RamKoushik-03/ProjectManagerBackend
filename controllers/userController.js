const Task = require('../models/Task');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

//@desc Get all users
//@route GET /api/users
//@access Private/Admin
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');

    const usersWithTaskCounts = await Promise.all(
      users.map(async (user) => {
        // Fetch tasks where the user is either the creator or assigned
        const tasks = await Task.find({
          $or: [
            { createdBy: user._id }, // Tasks created by the user
            { assignedTo: user._id }  // Tasks assigned to the user
          ]
        });

        // Calculate counts for each status
        const pendingTasksCount = tasks.filter((task) => task.status === 'Pending').length;
        const inProgressTasksCount = tasks.filter((task) => task.status === 'In Progress').length;
        const completedTasksCount = tasks.filter((task) => task.status === 'Completed').length;

        return {
          ...user._doc,
          pendingTasksCount,
          inProgressTasksCount,
          completedTasksCount,
        };
      })
    );

    res.json(usersWithTaskCounts);
  } catch (error) {
    console.error('❌ Error in getAllUsers:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};


//@desc Get user by ID
//@route GET /api/users/:id
//@access Private/Admin
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
//@desc Delete user
//@route DELETE /api/users/:id
//@access Private/Admin
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    await user.remove();
    res.status(200).json({ message: 'User removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getAllUsers, getUserById, deleteUser };
