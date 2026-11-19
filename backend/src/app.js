const express = require('express');
const cors = require('cors');
const pool = require('./config/database');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const clientRoutes = require('./routes/client.routes');
const atmRoutes = require('./routes/atm.routes');

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : undefined;
app.use(cors(allowedOrigins ? { origin: allowedOrigins } : {}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cliente', clientRoutes);
app.use('/api/cajero', atmRoutes);

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({
      status: 'ok',
      database: 'connected',
    });
  } catch (error) {
    console.error('Health check: no fue posible conectar con MySQL:', error.message);
    return res.status(503).json({
      status: 'error',
      database: 'disconnected',
    });
  }
});

module.exports = app;
