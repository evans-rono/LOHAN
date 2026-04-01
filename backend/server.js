// backend/server.js
require('dotenv').config();
const express    = require('express');
const path       = require('path');
const http       = require('http');
const { Server } = require('socket.io');
const connectDB  = require('./config/database');

const app    = express();
const server = http.createServer(app);

// ── SOCKET.IO (real-time trade/balance updates) ──
const io = new Server(server, {
  cors: { origin: '*' }
});
global.io = io;

io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    socket.join(userId);
  });
  socket.on('disconnect', () => {});
});

// ── DATABASE ──────────────────────────────────────────────
connectDB();

// ── MIDDLEWARE ────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── STATIC FILES ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API ROUTES ────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/trades',   require('./routes/trades'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/user',     require('./routes/user'));

// ── PAGE ROUTES ───────────────────────────────────────────
app.get('/pages/:page', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages', req.params.page));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/index.html'));
});

// ── 404 FALLBACK ──────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'Route not found' });
  }
  res.sendFile(path.join(__dirname, '../frontend/pages/index.html'));
});

// ── START ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});