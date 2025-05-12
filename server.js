require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const taskRoutes = require('./routes/taskRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Initialize app and server
const app = express();
const httpServer = createServer(app);

// Database connection
connectDB();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Store socket instances per user
const userSockets = new Map();

// Socket.io connection handler
io.on('connection', (socket) => {
  // Handle user joining their room
  socket.on('join-user-room', (userId) => {
    socket.join(userId);
    userSockets.set(userId, socket.id);
    console.log("User ${userId} joined their room");
  });

  // Handle admin notifications
  socket.on('send-notification', ({ userId, message }) => {
    io.to(userId).emit('new-notification', {
      message,
      timestamp: new Date(),
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    // Clean up userSockets map
    for (let [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        break;
      }
    }
  });
});

// Make io accessible in routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Error handling middleware (add this if not existing)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, () => {
  console.log("Server running on port ${PORT}");
  console.log("Socket.io listening for connections");
});

module.exports = { app, io };