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
const {
  initializeDatabaseWithRetry,
  isDatabaseReady,
  getLastDbInitError,
} = require('./config/database');

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

function logStartupInfo() {
  const hasDbUrl = Boolean(process.env.DATABASE_URL?.trim());
  console.log('========================================');
  console.log('[startup] Health Monitoring Hub API');
  console.log('[startup] NODE_ENV =', process.env.NODE_ENV || '(unset)');
  console.log('[startup] PORT =', PORT);
  console.log('[startup] DATABASE_URL set =', hasDbUrl);
  console.log('[startup] FRONTEND_URL =', process.env.FRONTEND_URL || '(unset, using CORS default)');
  console.log('[startup] Time =', new Date().toISOString());
  console.log('========================================');
}

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});
app.set('io', io);

io.on('connection', (socket) => {
  console.log('[socket] Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('[socket] Client disconnected:', socket.id);
  });
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  const dbOk = isDatabaseReady();
  // Always 200 if process is up — Azure load balancer stays happy; use `database` / `status` for truth.
  const body = {
    status: dbOk ? 'OK' : 'DEGRADED',
    message: dbOk
      ? 'Health Monitoring Hub API is running'
      : 'API is running but database is not initialized — check logs and DATABASE_URL',
    database: dbOk ? 'connected' : 'unavailable',
    timestamp: new Date().toISOString(),
  };
  if (!dbOk && getLastDbInitError()) {
    body.dbError =
      process.env.NODE_ENV === 'development'
        ? getLastDbInitError().message
        : 'Database connection failed (see server logs)';
  }
  res.status(200).json(body);
});

app.get('/', (req, res) => {
  res.json({
    message: 'Health Monitoring Hub API',
    version: '1.0.0',
    database: isDatabaseReady() ? 'connected' : 'unavailable',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      upload: '/api/upload',
      reports: '/api/reports',
      analyze: '/api/analyze',
      history: '/api/history',
      admin: '/api/admin',
    },
  });
});

app.use((err, req, res, next) => {
  console.error('[express] Error:', err.stack || err);
  res.status(err.status || 500).json({
    error: 'Something went wrong!',
    message:
      process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

async function startServer() {
  logStartupInfo();

  console.log('[startup] Waiting for database initialization (up to 60s retries)...');
  const dbResult = await initializeDatabaseWithRetry({
    maxWaitMs: 60_000,
    intervalMs: 5_000,
  });

  if (dbResult.ok) {
    console.log('[startup] Database OK:', dbResult);
  } else {
    console.error('[startup] Database not ready after retries:', dbResult);
    console.error(
      '[startup] Starting HTTP server anyway so Azure health probes / logs work. Fix DATABASE_URL / Neon / firewall.'
    );
  }

  await new Promise((resolve, reject) => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[startup] Listening on 0.0.0.0:${PORT}`);
      console.log(`[startup] Health: http://127.0.0.1:${PORT}/health`);
      resolve();
    });
    server.on('error', (err) => {
      console.error('[startup] server.listen error:', err);
      reject(err);
    });
  });
}

startServer().catch((err) => {
  console.error('[startup] Fatal: could not bind HTTP server:', err);
  process.exit(1);
});

module.exports = app;
