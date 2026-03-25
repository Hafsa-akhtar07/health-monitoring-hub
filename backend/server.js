const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const uploadRoutes = require('./routes/upload');
const reportRoutes = require('./routes/reports');
const analyzeRoutes = require('./routes/analyze');
const historyRoutes = require('./routes/history');
const proxyRoutes = require('./routes/proxy');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const { initializeDatabase } = require('./config/database');

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Socket.IO - real-time updates (SignalR equivalent in MERN)
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});
app.set('io', io);

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes); // Authentication routes (register, login, me)
app.use('/api/upload', uploadRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Health Monitoring Hub API is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Health Monitoring Hub API',
    version: '1.0.0',
      endpoints: {
        health: '/health',
        auth: '/api/auth',
        upload: '/api/upload',
        reports: '/api/reports',
        analyze: '/api/analyze',
        history: '/api/history',
        admin: '/api/admin'
      }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize database tables
    await initializeDatabase();
    
    // Bind 0.0.0.0 so Azure App Service (and other containers) can route traffic.
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
      console.log('🔌 Socket.IO real-time updates enabled');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;

