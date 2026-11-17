require('dotenv').config();

const app = require('./app');
const pool = require('./config/database');

const port = Number(process.env.PORT || 3000);

const server = app.listen(port, () => {
  console.log(`Servidor Express escuchando en http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
