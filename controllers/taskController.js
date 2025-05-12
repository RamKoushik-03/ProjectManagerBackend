const Task = require('../models/Task');

//@desc Get all tasks (Admin: Get all tasks, User: Get user tasks)
//@route GET /api/tasks
//@access Private
const getTasks = async (req, res) => {
  try {
    const { status } = req.query;
    let filter = {};
    if (status) {
      filter.status = status;
    }

    let tasks;
    if (req.user.role === 'admin') {
      tasks = await Task.find(filter).populate(
        'assignedTo',
        'name email profileImageUrl'
      );
    } else {
      tasks = await Task.find({ ...filter, assignedTo: req.user._id }).populate(
        'assignedTo',
        'name email profileImageUrl'
      );
    }

    // Add completed checklist count and make sure todoChecklists is returned
    tasks = await Promise.all(
      tasks.map(async (task) => {
        const completedCount = (task.todoChecklists || []).filter(
          (item) => item.completed
        ).length;

        return {
          ...task.toObject(),
          completedTodoCount: completedCount,
        };
      })
    );

    // Status summary
    const baseFilter =
      req.user.role === 'admin' ? {} : { assignedTo: req.user._id };

    const [allTasks, pendingTasks, inProgressTasks, completedTasks] =
      await Promise.all([
        Task.countDocuments(baseFilter),
        Task.countDocuments({ ...baseFilter, status: 'Pending' }),
        Task.countDocuments({ ...baseFilter, status: 'In Progress' }),
        Task.countDocuments({ ...baseFilter, status: 'Completed' }),
      ]);

    res.json({
      tasks,
      statusSummary: {
        all: allTasks,
        pendingTasks,
        inProgressTasks,
        completedTasks,
      },
    });
  } catch (err) {
    console.error('Get Tasks Error:', err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

//@desc Get task by ID
//@route GET /api/tasks/:id
//@access Private
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate(
      'assignedTo',
      'name email profileImageUrl'
    );

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

//@desc Create a new task
//@route POST /api/tasks
//@access Private (Admin)
const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      assignedTo,
      todoChecklists,
      attachments,
    } = req.body;

    // Validate assignedTo is an array
    if (!Array.isArray(assignedTo)) {
      return res.status(400).json({
        message: 'assignedTo should be an array of user IDs',
      });
    }

    const task = await Task.create({
      title,
      description,
      status,
      priority,
      dueDate,
      assignedTo,
      createdBy: req.user._id, // assuming authentication middleware adds req.user
      todoChecklists,
      attachments,
    });

    res.status(201).json({
      message: 'Task Created Successfully',
      task,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Server Error',
      error: err.message,
    });
  }
};

//@desc Update a task
//@route PUT /api/tasks/:id
//@access Private
const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    task.title = req.body.title || task.title;
    task.description = req.body.description || task.description;
    task.priority = req.body.priority || task.priority;
    task.dueDate = req.body.dueDate || task.dueDate;
    if (req.body.todoChecklists) {
      task.set('todoChecklists', req.body.todoChecklists);
    }
    task.attachments = req.body.attachments || task.attachments;
   
     
    if (req.body.assignedTo) {
      if (!Array.isArray(req.body.assignedTo)) {
        return res
          .status(400)
          .json({ message: 'assignedTo should be an array of user IDs' });
      }
      task.assignedTo = req.body.assignedTo;
    }

    const updatedTask = await task.save();
    console.log("Updated checklist:", req.body.todoChecklists);

    res.json({
      message: 'Task updated successfully',
      task: updatedTask,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Server Error',
      error: error.message,
    });
  }
};

//@desc Delete a task
//@route DELETE /api/tasks/:id
//@access Private
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await task.deleteOne();
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({
      message: 'Server Error',
      error: error.message,
    });
  }
};

//@desc Update task status
//@route PUT /api/tasks/:id/status
//@access Private
const updateTaskStatus = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const isAssigned = task.assignedTo.some(
      (user) => user._id.toString() === req.user._id.toString()
    );
    if (!isAssigned && req.user.role !== 'admin') {
      // If the user is not assigned to the task and is not an admin, deny access
      return res
        .status(403)
        .json({ message: 'Not authorized to update this task' });
    }

    task.status = req.body.status || task.status;
    if (task.status === 'Completed') {
      task.progress = 100;
    }
    await task.save();
    res.json({
      message: 'Task status updated successfully',
      task,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Server Error',
      error: error.message,
    });
  }
};

//@desc Update task checklist
//@route PUT /api/tasks/:id/todo
//@access Private
const updateTaskChecklist = async (req, res) => {
  try {
    const { todoChecklists = [] } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Authorization check (improved for populated assignedTo)
    const isAssigned = task.assignedTo.some(
      (user) => user._id.toString() === req.user._id.toString()
    );
    if (!isAssigned && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Normalize checklist items first
    const normalizedNewItems = todoChecklists.map((item) => ({
      ...item,
      text: item.text.trim(), // Ensure consistent comparison
    }));

    // Handle updates/additions
    normalizedNewItems.forEach((newItem) => {
      const existingIndex = task.todoChecklists.findIndex(
        (existing) => existing.text.trim() === newItem.text
      );

      if (existingIndex > -1) {
        // Update existing (preserve _id if not provided)
        task.todoChecklists[existingIndex] = {
          ...task.todoChecklists[existingIndex],
          ...newItem,
        };
      } else {
        // Add new item (Mongoose will auto-generate _id)
        task.todoChecklists.push(newItem);
      }
    });

    // Progress calculation
    const completedCount = task.todoChecklists.filter(
      (i) => i.completed
    ).length;
    const totalCount = task.todoChecklists.length;
    task.progress = totalCount
      ? Math.round((completedCount / totalCount) * 100)
      : 0;

    // Status update logic
    task.status =
      task.progress === 100
        ? 'Completed'
        : task.progress > 0
        ? 'In Progress'
        : 'Pending';

    await task.save();

    const updatedTask = await Task.findById(req.params.id).populate(
      'assignedTo',
      'name email profileImageUrl'
    );

    res.json({
      message: 'Checklist updated successfully',
      task: updatedTask,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Server Error',
      error: error.message,
    });
  }
};

//@desc Dashboard data (Admin: Get all tasks, User: Get user tasks)
//@route GET /api/tasks/dashboard
//@access Private
const getDashboardData = async (req, res) => {
  try {
    // 1. Fetch statistics in parallel for better performance
    const [totalTasks, pendingTasks, completedTasks, overdueTasks] =
      await Promise.all([
        Task.countDocuments({}),
        Task.countDocuments({ status: 'Pending' }),
        Task.countDocuments({ status: 'Completed' }),
        Task.countDocuments({
          status: { $ne: 'Completed' },
          dueDate: { $lt: new Date() },
        }),
      ]);

    // 2. Define constants at the top for better organization
    const STATUSES = ['Pending', 'In Progress', 'Completed'];
    const PRIORITIES = ['Low', 'Medium', 'High'];

    // 3. Fetch and process distributions in parallel
    const [taskDistributionRaw, taskPriorityDistributionRaw] =
      await Promise.all([
        Task.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Task.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
      ]);

    // 4. Improved data processing with helper functions
    const createDistribution = (items, rawData) =>
      items.reduce((acc, item) => {
        const key = item.replace(/\s+/g, '');
        acc[key] = rawData.find((d) => d._id === item)?.count || 0;
        return acc;
      }, {});

    // 5. Fetch recent tasks
    const recentTasks = await Task.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title status priority dueDate createdAt');

    // 6. Structured response
    res.status(200).json({
      statistics: {
        totalTasks,
        pendingTasks,
        completedTasks,
        overdueTasks,
      },
      charts: {
        taskDistribution: createDistribution(STATUSES, taskDistributionRaw),
        taskPriorityLevels: createDistribution(
          PRIORITIES,
          taskPriorityDistributionRaw
        ),
      },
      recentTasks,
    });
  } catch (error) {
    console.error('Dashboard Error:', error); // Log the full error
    res.status(500).json({
      message: 'Failed to load dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

//@desc Dashboard data (User-Specific)
//@route GET /api/tasks/user-dashboard-data
//@access Private
const getUserDashboardData = async (req, res) => {
  try {
    const userId = req.user._id; // only fetch data for logged-in user
    //fetch statistics in parallel for user-specific tasks
    const totalTasks = await Task.countDocuments({ assignedTo: userId });
    const pendingTasks = await Task.countDocuments({
      assignedTo: userId,
      status: 'Pending',
    });
    const completedTasks = await Task.countDocuments({
      assignedTo: userId,
      status: 'Completed',
    });
    const overdueTasks = await Task.countDocuments({
      assignedTo: userId,
      status: { $ne: 'Completed' },
      dueDate: { $lt: new Date() },
    });

    //Task distribution by status
    const taskStatuses = ['Pending', 'In Progress', 'Completed'];
    const taskDistributionRaw = await Task.aggregate([
      { $match: { assignedTo: userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const taskDistribution = taskStatuses.reduce((acc, status) => {
      const key = status.replace(/\s+/g, '');
      acc[key] = taskDistributionRaw.find((d) => d._id === status)?.count || 0;
      return acc;
    }, {});
    taskDistribution['All'] = totalTasks;

    //Task distribution by priority
    const taskPriorities = ['Low', 'Medium', 'High'];
    const taskPriorityDistributionRaw = await Task.aggregate([
      { $match: { assignedTo: userId } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);

    const taskPriorityLevels = taskPriorities.reduce((acc, priority) => {
      acc[priority] =
        taskPriorityDistributionRaw.find((d) => d._id === priority)?.count || 0;
      return acc;
    }, {});

    //Fetch recent tasks for the user
    const recentTasks = await Task.find({ assignedTo: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title status priority dueDate createdAt');

    res.status(200).json({
      statistics: {
        totalTasks,
        pendingTasks,
        completedTasks,
        overdueTasks,
      },
      charts: {
        taskDistribution,
        taskPriorityLevels,
      },
      recentTasks,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to load user dashboard data',
      error: error.message,
    });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  updateTaskChecklist,
  getDashboardData,
  getUserDashboardData,
};
