const pool = require('../config/database');
const safeRollback = require('../utils/safeRollback');
const { decimalToCents, normalizePositiveAmount, subtractAmounts } = require('../utils/money');

async function getActiveSessionAccount({ userId, accountId }) {
  const [rows] = await pool.execute(
    `SELECT c.id, c.usuario_id, c.numero_cuenta, c.tipo_cuenta, c.saldo,
            c.estado AS cuenta_estado, u.estado AS usuario_estado
     FROM cuentas AS c
     INNER JOIN usuarios AS u ON u.id = c.usuario_id
     WHERE c.id = ? AND c.usuario_id = ?
       AND c.estado = 'ACTIVO' AND u.estado = 'ACTIVO'
     LIMIT 1`,
    [accountId, userId],
  );
  return rows[0] || null;
}

async function listRecentMovements({ userId, accountId, limit }) {
  const [rows] = await pool.execute(
    `SELECT m.id, m.fecha, m.tipo_movimiento, m.descripcion, m.valor, m.saldo_resultante
     FROM movimientos AS m
     INNER JOIN cuentas AS c ON c.id = m.cuenta_id
     INNER JOIN usuarios AS u ON u.id = c.usuario_id
     WHERE c.id = ? AND c.usuario_id = ?
       AND c.estado = 'ACTIVO' AND u.estado = 'ACTIVO'
     ORDER BY m.fecha DESC, m.id DESC
     LIMIT ?`,
    [accountId, userId, limit],
  );
  return rows;
}

async function withdraw({ userId, accountId, monto, descripcion }) {
  const normalizedAmount = normalizePositiveAmount(monto);
  if (!normalizedAmount) return { error: 'INVALID_AMOUNT' };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT c.id, c.numero_cuenta, c.saldo,
              c.estado AS cuenta_estado, u.estado AS usuario_estado
       FROM cuentas AS c
       INNER JOIN usuarios AS u ON u.id = c.usuario_id
       WHERE c.id = ? AND c.usuario_id = ?
       LIMIT 1
       FOR UPDATE`,
      [accountId, userId],
    );
    const account = rows[0];
    if (!account) {
      await connection.rollback();
      return { error: 'ACCOUNT_NOT_FOUND' };
    }
    if (account.cuenta_estado !== 'ACTIVO' || account.usuario_estado !== 'ACTIVO') {
      await connection.rollback();
      return { error: 'INACTIVE_ACCOUNT' };
    }
    if (decimalToCents(account.saldo) < decimalToCents(normalizedAmount)) {
      await connection.rollback();
      return { error: 'INSUFFICIENT_FUNDS' };
    }

    const saldoResultante = subtractAmounts(account.saldo, normalizedAmount);
    const [updateResult] = await connection.execute(
      `UPDATE cuentas
       SET saldo = saldo - ?
       WHERE id = ? AND estado = 'ACTIVO' AND saldo >= ?`,
      [normalizedAmount, account.id, normalizedAmount],
    );
    if (updateResult.affectedRows !== 1) {
      await connection.rollback();
      return { error: 'INSUFFICIENT_FUNDS' };
    }

    const [movementResult] = await connection.execute(
      `INSERT INTO movimientos
         (cuenta_id, tipo_movimiento, descripcion, valor, saldo_resultante)
       VALUES (?, 'RETIRO', ?, ?, ?)`,
      [account.id, descripcion, normalizedAmount, saldoResultante],
    );

    await connection.commit();
    return {
      numero_cuenta: account.numero_cuenta,
      monto: normalizedAmount,
      saldo_resultante: saldoResultante,
      movimiento_id: movementResult.insertId,
    };
  } catch (error) {
    await safeRollback(connection);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { getActiveSessionAccount, listRecentMovements, withdraw };
