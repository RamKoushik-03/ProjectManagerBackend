const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to protect routes
const protect = async (req, res, next) => {
  try {
    let token = req.headers.authorization;

    if (token && token.startsWith('Bearer')) {
      token = token.split(' ')[1]; // Extract the actual token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Ensure the user exists
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Convert to object and remove password manually
      const { password, ...userWithoutPassword } = user.toObject();
      req.user = userWithoutPassword;

      next();
    } else {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }
  } catch (error) {
    return res
      .status(401)
      .json({ message: 'Token failed', error: error.message });
  }
};

// Middleware for Admin-only access
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ message: 'Admin access denied' });
  }
};

module.exports = { protect, adminOnly };
