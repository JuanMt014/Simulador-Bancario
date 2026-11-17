const express = require('express');
const cors = require('cors');
const pool = require('./config/database');
const authRoutes = require('./routes/auth.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

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
