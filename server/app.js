const express = require('express');
const cors = require('cors');
const path = require('path');
const mailRoutes = require('./routes/mail');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public folder (works for local & traditional servers)
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/mail', mailRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'temp-mail'
  });
});

// Fallback to index.html for SPA
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
  next();
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Terjadi kesalahan internal server' });
});

module.exports = app;
