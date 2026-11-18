const pool = require('../config/database');

async function getDashboardMetrics() {
  const [rows] = await pool.execute(
    `SELECT
       (SELECT COUNT(*) FROM usuarios WHERE rol = 'CLIENTE') AS total_clientes,
       (SELECT COUNT(*) FROM cuentas WHERE estado = 'ACTIVO') AS cuentas_activas,
       (SELECT COUNT(*) FROM usuarios WHERE rol = 'CLIENTE' AND estado = 'BLOQUEADO') AS clientes_bloqueados,
       (SELECT COALESCE(SUM(saldo), 0.00) FROM cuentas) AS saldo_total`,
  );
  return rows[0];
}

async function listClients({ search, limit, offset }) {
  const values = [];
  let where = "WHERE u.rol = 'CLIENTE'";
  if (search) {
    where += ` AND (
      u.nombre LIKE ? OR u.apellido LIKE ? OR u.documento LIKE ? OR u.correo LIKE ?
    )`;
    const pattern = `%${search}%`;
    values.push(pattern, pattern, pattern, pattern);
  }

  const [rows] = await pool.execute(
    `SELECT u.id, u.nombre, u.apellido, u.documento, u.correo, u.telefono,
            u.estado, u.fecha_creacion, COUNT(c.id) AS total_cuentas
     FROM usuarios AS u
     LEFT JOIN cuentas AS c ON c.usuario_id = u.id
     ${where}
     GROUP BY u.id
     ORDER BY u.id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset],
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM usuarios AS u
     ${where}`,
    values,
  );

  return { rows, total: Number(countRows[0].total) };
}

async function findClientById(id) {
  const [users] = await pool.execute(
    `SELECT id, nombre, apellido, documento, correo, telefono, estado, fecha_creacion
     FROM usuarios
     WHERE id = ? AND rol = 'CLIENTE'
     LIMIT 1`,
    [id],
  );
  if (users.length === 0) return null;

  const [accounts] = await pool.execute(
    `SELECT id, numero_cuenta, tipo_cuenta, saldo, estado, fecha_creacion
     FROM cuentas
     WHERE usuario_id = ?
     ORDER BY id`,
    [id],
  );
  return { ...users[0], cuentas: accounts };
}

async function createClient({ client, account }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [userResult] = await connection.execute(
      `INSERT INTO usuarios
         (nombre, apellido, documento, correo, telefono, password_hash, rol, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'CLIENTE', 'ACTIVO')`,
      [
        client.nombre,
        client.apellido,
        client.documento,
        client.correo,
        client.telefono,
        client.passwordHash,
      ],
    );

    const [accountResult] = await connection.execute(
      `INSERT INTO cuentas
         (usuario_id, numero_cuenta, tipo_cuenta, saldo, pin_hash, estado)
       VALUES (?, ?, ?, 0.00, ?, 'ACTIVO')`,
      [userResult.insertId, account.numeroCuenta, account.tipoCuenta, account.pinHash],
    );

    await connection.commit();
    return {
      userId: userResult.insertId,
      accountId: accountResult.insertId,
      numeroCuenta: account.numeroCuenta,
      tipoCuenta: account.tipoCuenta,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateClient(id, fields) {
  const columns = {
    nombre: 'nombre',
    apellido: 'apellido',
    documento: 'documento',
    correo: 'correo',
    telefono: 'telefono',
  };
  const entries = Object.entries(fields).filter(([key]) => columns[key]);
  if (entries.length === 0) return false;

  const [existingClients] = await pool.execute(
    "SELECT id FROM usuarios WHERE id = ? AND rol = 'CLIENTE' LIMIT 1",
    [id],
  );
  if (existingClients.length === 0) return false;

  const assignments = entries.map(([key]) => `${columns[key]} = ?`).join(', ');
  const values = entries.map(([, value]) => value);
  await pool.execute(
    `UPDATE usuarios SET ${assignments} WHERE id = ? AND rol = 'CLIENTE'`,
    [...values, id],
  );
  return true;
}

async function changeClientStatus(id, estado) {
  const [existingClients] = await pool.execute(
    "SELECT id FROM usuarios WHERE id = ? AND rol = 'CLIENTE' LIMIT 1",
    [id],
  );
  if (existingClients.length === 0) return false;

  await pool.execute(
    `UPDATE usuarios SET estado = ? WHERE id = ? AND rol = 'CLIENTE'`,
    [estado, id],
  );
  return true;
}

async function listAccounts({ limit, offset }) {
  const [rows] = await pool.execute(
    `SELECT c.id, c.numero_cuenta, c.tipo_cuenta, c.saldo, c.estado,
            c.fecha_creacion, u.id AS usuario_id, u.nombre, u.apellido,
            u.documento, u.correo, u.estado AS usuario_estado
     FROM cuentas AS c
     INNER JOIN usuarios AS u ON u.id = c.usuario_id
     ORDER BY c.id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  const [[count]] = await pool.execute('SELECT COUNT(*) AS total FROM cuentas');
  return { rows, total: Number(count.total) };
}

async function listMovements({ limit, offset, numeroCuenta, tipoMovimiento }) {
  const filters = [];
  const values = [];
  if (numeroCuenta) {
    filters.push('c.numero_cuenta = ?');
    values.push(numeroCuenta);
  }
  if (tipoMovimiento) {
    filters.push('m.tipo_movimiento = ?');
    values.push(tipoMovimiento);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await pool.execute(
    `SELECT m.id, m.cuenta_id, c.numero_cuenta, u.id AS usuario_id,
            u.nombre, u.apellido, m.tipo_movimiento, m.descripcion,
            m.valor, m.saldo_resultante, m.fecha
     FROM movimientos AS m
     INNER JOIN cuentas AS c ON c.id = m.cuenta_id
     INNER JOIN usuarios AS u ON u.id = c.usuario_id
     ${where}
     ORDER BY m.fecha DESC, m.id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset],
  );
  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM movimientos AS m
     INNER JOIN cuentas AS c ON c.id = m.cuenta_id
     ${where}`,
    values,
  );
  return { rows, total: Number(countRows[0].total) };
}

async function deposit({ numeroCuenta, monto, descripcion }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [accounts] = await connection.execute(
      `SELECT c.id, c.saldo, c.estado AS cuenta_estado,
              u.estado AS usuario_estado
       FROM cuentas AS c
       INNER JOIN usuarios AS u ON u.id = c.usuario_id
       WHERE c.numero_cuenta = ?
       LIMIT 1
       FOR UPDATE`,
      [numeroCuenta],
    );

    const account = accounts[0];
    if (!account) {
      await connection.rollback();
      return { error: 'NOT_FOUND' };
    }
    if (account.cuenta_estado !== 'ACTIVO' || account.usuario_estado !== 'ACTIVO') {
      await connection.rollback();
      return { error: 'INACTIVE' };
    }

    await connection.execute(
      'UPDATE cuentas SET saldo = saldo + ? WHERE id = ?',
      [monto, account.id],
    );
    const [updatedAccounts] = await connection.execute(
      'SELECT saldo FROM cuentas WHERE id = ? LIMIT 1',
      [account.id],
    );
    const saldoResultante = updatedAccounts[0].saldo;

    const [movementResult] = await connection.execute(
      `INSERT INTO movimientos
         (cuenta_id, tipo_movimiento, descripcion, valor, saldo_resultante)
       VALUES (?, 'CONSIGNACION', ?, ?, ?)`,
      [account.id, descripcion, monto, saldoResultante],
    );

    await connection.commit();
    return {
      movementId: movementResult.insertId,
      cuentaId: account.id,
      saldoAnterior: account.saldo,
      saldoResultante,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getDashboardMetrics,
  listClients,
  findClientById,
  createClient,
  updateClient,
  changeClientStatus,
  listAccounts,
  listMovements,
  deposit,
};
