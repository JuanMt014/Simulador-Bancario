const pool = require('../config/database');

async function findUserByEmail(correo) {
  const [rows] = await pool.execute(
    `SELECT id, nombre, apellido, correo, password_hash, rol, estado
     FROM usuarios
     WHERE correo = ?
     LIMIT 1`,
    [correo],
  );
  return rows[0] || null;
}

async function findAccountByNumber(numeroCuenta) {
  const [rows] = await pool.execute(
    `SELECT c.id AS cuenta_id, c.usuario_id, c.numero_cuenta, c.tipo_cuenta,
            c.pin_hash, c.estado AS cuenta_estado,
            u.nombre, u.apellido, u.correo, u.rol, u.estado AS usuario_estado
     FROM cuentas AS c
     INNER JOIN usuarios AS u ON u.id = c.usuario_id
     WHERE c.numero_cuenta = ?
     LIMIT 1`,
    [numeroCuenta],
  );
  return rows[0] || null;
}

async function hasActiveAccountForUser(userId) {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM cuentas
     WHERE usuario_id = ? AND estado = 'ACTIVO'
     LIMIT 1`,
    [userId],
  );
  return rows.length > 0;
}

async function isSessionActive({ userId, accountId, role }) {
  if (accountId) {
    const [rows] = await pool.execute(
      `SELECT u.estado AS usuario_estado, c.estado AS cuenta_estado
       FROM usuarios AS u
       INNER JOIN cuentas AS c ON c.usuario_id = u.id
       WHERE u.id = ? AND c.id = ?
       LIMIT 1`,
      [userId, accountId],
    );
    return rows.length === 1
      && rows[0].usuario_estado === 'ACTIVO'
      && rows[0].cuenta_estado === 'ACTIVO';
  }

  if (role === 'CLIENTE') {
    const [rows] = await pool.execute(
      `SELECT 1
       FROM usuarios AS u
       INNER JOIN cuentas AS c ON c.usuario_id = u.id
       WHERE u.id = ? AND u.estado = 'ACTIVO' AND c.estado = 'ACTIVO'
       LIMIT 1`,
      [userId],
    );
    return rows.length > 0;
  }

  const [rows] = await pool.execute(
    'SELECT estado FROM usuarios WHERE id = ? LIMIT 1',
    [userId],
  );
  return rows.length === 1 && rows[0].estado === 'ACTIVO';
}

module.exports = {
  findUserByEmail,
  findAccountByNumber,
  hasActiveAccountForUser,
  isSessionActive,
};
