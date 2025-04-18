// backend/utils/socketManager.js
const socketIo = require('socket.io');

let io;

// Initialize socket server
const initialize = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.CORS_ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);
    
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
  
  return io;
};

// Get io instance
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = {
  initialize,
  getIO
};