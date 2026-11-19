const pool = require('../config/database');
const safeRollback = require('../utils/safeRollback');
const {
  decimalToCents,
  normalizePositiveAmount,
  addAmounts,
  subtractAmounts,
} = require('../utils/money');

async function getProfile(userId) {
  const [rows] = await pool.execute(
    `SELECT id, nombre, apellido, documento, correo, telefono, rol, estado, fecha_creacion
     FROM usuarios
     WHERE id = ? AND rol = 'CLIENTE' AND estado = 'ACTIVO'
     LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

async function updateProfile(userId, fields) {
  const allowedColumns = {
    nombre: 'nombre',
    apellido: 'apellido',
    correo: 'correo',
    telefono: 'telefono',
  };
  const entries = Object.entries(fields).filter(([field]) => allowedColumns[field]);
  if (entries.length === 0) return false;

  const assignments = entries.map(([field]) => `${allowedColumns[field]} = ?`).join(', ');
  await pool.execute(
    `UPDATE usuarios SET ${assignments}
     WHERE id = ? AND rol = 'CLIENTE' AND estado = 'ACTIVO'`,
    [...entries.map(([, value]) => value), userId],
  );
  return true;
}

async function getPasswordHash(userId) {
  const [rows] = await pool.execute(
    `SELECT password_hash
     FROM usuarios
     WHERE id = ? AND rol = 'CLIENTE' AND estado = 'ACTIVO'
     LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

async function updatePassword(userId, passwordHash) {
  const [result] = await pool.execute(
    `UPDATE usuarios SET password_hash = ?
     WHERE id = ? AND rol = 'CLIENTE' AND estado = 'ACTIVO'`,
    [passwordHash, userId],
  );
  return result.affectedRows > 0;
}

async function getAccounts(userId) {
  const [rows] = await pool.execute(
    `SELECT id, numero_cuenta, tipo_cuenta, saldo, estado, fecha_creacion
     FROM cuentas
     WHERE usuario_id = ?
     ORDER BY (estado = 'ACTIVO') DESC, id`,
    [userId],
  );
  return rows;
}

async function listMovements({ userId, limit, offset }) {
  const [rows] = await pool.execute(
    `SELECT m.id, c.id AS cuenta_id, c.numero_cuenta,
            m.fecha, m.tipo_movimiento, m.descripcion, m.valor, m.saldo_resultante
     FROM movimientos AS m
     INNER JOIN cuentas AS c ON c.id = m.cuenta_id
     WHERE c.usuario_id = ?
     ORDER BY m.fecha DESC, m.id DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset],
  );
  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM movimientos AS m
     INNER JOIN cuentas AS c ON c.id = m.cuenta_id
     WHERE c.usuario_id = ?`,
    [userId],
  );
  return { rows, total: Number(countRows[0].total) };
}

async function transfer({ userId, numeroCuentaOrigen, numeroCuentaDestino, monto, descripcion }) {
  const normalizedAmount = normalizePositiveAmount(monto);
  if (!normalizedAmount) return { error: 'INVALID_AMOUNT' };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Acción 1: verificar titularidad, existencia, estados y saldo bloqueando ambas cuentas.
    const [rows] = await connection.execute(
      `SELECT c.id, c.usuario_id, c.numero_cuenta, c.saldo,
              c.estado AS cuenta_estado, u.estado AS usuario_estado
       FROM cuentas AS c
       INNER JOIN usuarios AS u ON u.id = c.usuario_id
       WHERE c.numero_cuenta IN (?, ?)
       ORDER BY c.id
       FOR UPDATE`,
      [numeroCuentaOrigen, numeroCuentaDestino],
    );
    const origen = rows.find((account) => account.numero_cuenta === numeroCuentaOrigen);
    const destino = rows.find((account) => account.numero_cuenta === numeroCuentaDestino);

    if (!origen || !destino) {
      await connection.rollback();
      return { error: 'ACCOUNT_NOT_FOUND' };
    }
    if (origen.id === destino.id) {
      await connection.rollback();
      return { error: 'SAME_ACCOUNT' };
    }
    if (Number(origen.usuario_id) !== userId) {
      await connection.rollback();
      return { error: 'NOT_OWNER' };
    }
    if (origen.cuenta_estado !== 'ACTIVO' || origen.usuario_estado !== 'ACTIVO'
      || destino.cuenta_estado !== 'ACTIVO' || destino.usuario_estado !== 'ACTIVO') {
      await connection.rollback();
      return { error: 'INACTIVE_ACCOUNT' };
    }

    const amountCents = decimalToCents(normalizedAmount);
    const sourceBalanceCents = decimalToCents(origen.saldo);
    if (sourceBalanceCents < amountCents) {
      await connection.rollback();
      return { error: 'INSUFFICIENT_FUNDS' };
    }

    const saldoOrigen = subtractAmounts(origen.saldo, normalizedAmount);
    const saldoDestino = addAmounts(destino.saldo, normalizedAmount);

    // Acción 2: descontar de la cuenta origen.
    await connection.execute(
      `UPDATE cuentas
       SET saldo = saldo - ?
       WHERE id = ? AND estado = 'ACTIVO' AND saldo >= ?`,
      [normalizedAmount, origen.id, normalizedAmount],
    );

    // Acción 3: incrementar la cuenta destino.
    await connection.execute(
      `UPDATE cuentas
       SET saldo = saldo + ?
       WHERE id = ? AND estado = 'ACTIVO'`,
      [normalizedAmount, destino.id],
    );

    // Acción 4: registrar débito y crédito en una sentencia de dos filas.
    const descripcionSalida = `Transferencia enviada a ${destino.numero_cuenta}: ${descripcion}`.slice(0, 255);
    const descripcionEntrada = `Transferencia recibida de ${origen.numero_cuenta}: ${descripcion}`.slice(0, 255);
    await connection.execute(
      `INSERT INTO movimientos
         (cuenta_id, tipo_movimiento, descripcion, valor, saldo_resultante)
       VALUES (?, 'TRANSFERENCIA_ENVIADA', ?, ?, ?),
              (?, 'TRANSFERENCIA_RECIBIDA', ?, ?, ?)`,
      [
        origen.id, descripcionSalida, normalizedAmount, saldoOrigen,
        destino.id, descripcionEntrada, normalizedAmount, saldoDestino,
      ],
    );

    await connection.commit();
    return {
      numero_cuenta_origen: origen.numero_cuenta,
      numero_cuenta_destino: destino.numero_cuenta,
      monto: normalizedAmount,
      saldo_origen_resultante: saldoOrigen,
      saldo_destino_resultante: saldoDestino,
    };
  } catch (error) {
    await safeRollback(connection);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getProfile,
  updateProfile,
  getPasswordHash,
  updatePassword,
  getAccounts,
  listMovements,
  transfer,
};
