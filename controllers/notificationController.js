// notificationController.js
const mongoose = require('mongoose');
const Task = require('../models/Task'); // This registers the model with Mongoose

const Notice = require('../models/Notifications');

// Create a new notification (for admin to send)
const createNotification = async (req, res) => {
  try {
    const { team, text, task, notiType } = req.body;

    // Validate required fields
    if (!team || !team.length || !text) {
      return res.status(400).json({
        message: 'Team members and notification text are required',
      });
    }

    // Create notification object
    const newNotice = new Notice({
      team,
      text,
      task: task ? new mongoose.Types.ObjectId(task) : null,
      notiType: notiType || 'alert',
      isRead: [],
      createdAt: new Date(),
    });

    // Save to database
    const savedNotice = await newNotice.save();

    console.log('Saved Notification:', savedNotice);

    // Emit real-time notifications
    const io = req.app.get('io');
    if (io) {
      // Get list of currently connected users
      const connectedUsers = Array.from(io.sockets.adapter.rooms.keys()).filter(
        (key) => !key.startsWith('room-') && key !== io.sockets.adapter.sids
      );

      // Send to both connected and disconnected users (will see when they reconnect)
      team.forEach((userId) => {
        const userIdStr = userId.toString();

        // For connected users - send immediately
        if (io.sockets.adapter.rooms.has(userIdStr)) {
          io.to(userIdStr).emit('new-notification', {
            ...savedNotice.toObject(),
            isRealTime: true,
          });
        }

        // Optional: Store pending notifications for offline users
        // await User.updateOne(
        //   { _id: userId },
        //   { $push: { pendingNotifications: savedNotice._id } }
        // );
      });
    }

    // Update related task if exists
    if (task) {
      await Task.findByIdAndUpdate(
        task,
        { $push: { notifications: savedNotice._id } },
        { new: true }
      );
    }

    res.status(201).json({
      ...savedNotice.toObject(),
      message: 'Notification created and sent successfully',
    });
  } catch (error) {
    console.error('Notification creation error:', error);
    res.status(500).json({
      message: 'Failed to create notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get notifications for a specific user
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id; // Already an ObjectId from auth middleware

    const notifications = await Notice.find({
      team: userId,
    })
      .populate({
        path: 'team',
        select: 'name email',
        match: { _id: userId }, // Only populate the requesting user
      })
      .populate({
        path: 'task',
        select: 'title status dueDate',
      })
      .sort({ createdAt: -1 })
      .lean(); // Convert to plain JS objects

    console.log('Found notifications:', notifications);

    // Filter out notifications where population failed
    const validNotifications = notifications.filter(
      (notice) => notice.team && notice.team.length > 0
    );

    res.status(200).json(validNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};
// Mark notification as read for a specific user
const markAsRead = async (req, res) => {
  try {
    const { notificationId, userId } = req.body;

    if (!notificationId || !userId) {
      return res
        .status(400)
        .json({ message: 'notificationId and userId are required' });
    }

    if (typeof userId !== 'string') {
      return res.status(400).json({ message: 'Invalid userId format' });
    }

    const notification = await Notice.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Add user to isRead array if not already there
    if (!notification.isRead.includes(userId)) {
      notification.isRead.push(userId);
      await notification.save();
    }

    res.status(200).json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
};
