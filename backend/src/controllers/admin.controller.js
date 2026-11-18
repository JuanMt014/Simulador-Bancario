const bcrypt = require('bcrypt');
const { randomInt } = require('crypto');
const adminModel = require('../models/admin.model');

const VALID_STATES = ['ACTIVO', 'INACTIVO', 'BLOQUEADO'];
const VALID_ACCOUNT_TYPES = ['AHORROS', 'CORRIENTE'];
const VALID_MOVEMENT_TYPES = [
  'CONSIGNACION',
  'RETIRO',
  'TRANSFERENCIA_ENVIADA',
  'TRANSFERENCIA_RECIBIDA',
];
const DUPLICATE_KEY = 'ER_DUP_ENTRY';

function parsePositiveId(value) {
  if (!/^\d+$/.test(String(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parsePagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 50 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1
    || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return null;
  }
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(offset)) return null;
  return { page, limit, offset };
}

function isValidText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isValidEmail(value) {
  return typeof value === 'string'
    && value.length <= 160
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidAmount(value) {
  const amount = typeof value === 'number' ? String(value) : value;
  if (typeof amount !== 'string' || !/^\d{1,13}(?:\.\d{1,2})?$/.test(amount)) return false;
  const [whole, fraction = ''] = amount.split('.');
  const cents = BigInt(`${whole}${fraction.padEnd(2, '0')}`);
  return cents > 0n;
}

function isDuplicateError(error) {
  return error.code === DUPLICATE_KEY;
}

function asyncHandler(handler) {
  return (req, res) => handler(req, res).catch((error) => {
    console.error('Error en endpoint administrativo:', error.message);
    if (isDuplicateError(error)) {
      return res.status(409).json({ message: 'El documento, correo o número de cuenta ya está registrado.' });
    }
    return res.status(500).json({ message: 'Error interno del servidor.' });
  });
}

const dashboard = asyncHandler(async (_req, res) => {
  const metrics = await adminModel.getDashboardMetrics();
  return res.json({
    total_clientes: Number(metrics.total_clientes),
    cuentas_activas: Number(metrics.cuentas_activas),
    clientes_bloqueados: Number(metrics.clientes_bloqueados),
    saldo_total: metrics.saldo_total,
  });
});

const listClients = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  if (!pagination) {
    return res.status(400).json({ message: 'page debe ser >= 1 y limit debe estar entre 1 y 100.' });
  }
  const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 160) : '';
  const result = await adminModel.listClients({ search, ...pagination });
  return res.json({
    data: result.rows,
    pagination: { page: pagination.page, limit: pagination.limit, total: result.total },
  });
});

const getClient = asyncHandler(async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ message: 'El id del cliente no es válido.' });
  const client = await adminModel.findClientById(id);
  if (!client) return res.status(404).json({ message: 'Cliente no encontrado.' });
  return res.json({ data: client });
});

const createClient = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const apellido = typeof body.apellido === 'string' ? body.apellido.trim() : '';
  const documento = typeof body.documento === 'string' ? body.documento.trim() : '';
  const correo = typeof body.correo === 'string' ? body.correo.trim().toLowerCase() : '';
  const telefono = typeof body.telefono === 'string' ? body.telefono.trim() : '';
  const password = body.password;
  const pin = body.pin;
  const tipoCuenta = body.tipo_cuenta === undefined ? 'AHORROS' : body.tipo_cuenta;

  if (!isValidText(nombre, 80) || !isValidText(apellido, 80)
    || !isValidText(documento, 30) || !isValidEmail(correo)
    || !isValidText(telefono, 30)) {
    return res.status(400).json({
      message: 'nombre, apellido, documento, correo y telefono son obligatorios y deben tener un formato válido.',
    });
  }
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'password debe tener al menos 8 caracteres y máximo 72 bytes UTF-8.' });
  }
  if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({ message: 'pin debe ser una cadena numérica de 4 a 6 dígitos.' });
  }
  if (!VALID_ACCOUNT_TYPES.includes(tipoCuenta)) {
    return res.status(400).json({ message: 'tipo_cuenta debe ser AHORROS o CORRIENTE.' });
  }

  const numeroCuenta = body.numero_cuenta === undefined
    ? String(randomInt(1000000000, 9999999999))
    : (typeof body.numero_cuenta === 'string' ? body.numero_cuenta.trim() : '');
  if (!/^\d{6,20}$/.test(numeroCuenta)) {
    return res.status(400).json({ message: 'numero_cuenta debe contener entre 6 y 20 dígitos.' });
  }

  const [passwordHash, pinHash] = await Promise.all([
    bcrypt.hash(password, 10),
    bcrypt.hash(pin, 10),
  ]);
  const result = await adminModel.createClient({
    client: { nombre, apellido, documento, correo, telefono, passwordHash },
    account: { numeroCuenta, tipoCuenta, pinHash },
  });

  return res.status(201).json({
    message: 'Cliente y cuenta creados correctamente.',
    data: result,
  });
});

const updateClient = asyncHandler(async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json({ message: 'El id del cliente no es válido.' });

  const body = req.body || {};
  const fields = {};
  for (const field of ['nombre', 'apellido', 'documento', 'telefono']) {
    if (body[field] !== undefined) {
      if (!isValidText(body[field], field === 'documento' || field === 'telefono' ? 30 : 80)) {
        return res.status(400).json({ message: `${field} debe ser texto no vacío y tener una longitud válida.` });
      }
      fields[field] = body[field].trim();
    }
  }
  if (body.correo !== undefined) {
    if (!isValidEmail(body.correo)) {
      return res.status(400).json({ message: 'correo debe tener un formato válido.' });
    }
    fields.correo = body.correo.trim().toLowerCase();
  }
  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ message: 'Envía al menos un campo permitido para actualizar.' });
  }

  const updated = await adminModel.updateClient(id, fields);
  if (!updated) return res.status(404).json({ message: 'Cliente no encontrado.' });
  return res.json({ message: 'Datos del cliente actualizados correctamente.' });
});

const changeClientStatus = asyncHandler(async (req, res) => {
  const id = parsePositiveId(req.params.id);
  const { estado } = req.body || {};
  if (!id) return res.status(400).json({ message: 'El id del cliente no es válido.' });
  if (!VALID_STATES.includes(estado)) {
    return res.status(400).json({ message: 'estado debe ser ACTIVO, INACTIVO o BLOQUEADO.' });
  }
  const updated = await adminModel.changeClientStatus(id, estado);
  if (!updated) return res.status(404).json({ message: 'Cliente no encontrado.' });
  return res.json({ message: 'Estado del cliente actualizado.', estado });
});

const listAccounts = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  if (!pagination) {
    return res.status(400).json({ message: 'page debe ser >= 1 y limit debe estar entre 1 y 100.' });
  }
  const result = await adminModel.listAccounts(pagination);
  return res.json({
    data: result.rows,
    pagination: { page: pagination.page, limit: pagination.limit, total: result.total },
  });
});

const listMovements = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  if (!pagination) {
    return res.status(400).json({ message: 'page debe ser >= 1 y limit debe estar entre 1 y 100.' });
  }
  const numeroCuenta = typeof req.query.numero_cuenta === 'string'
    ? req.query.numero_cuenta.trim()
    : '';
  const tipoMovimiento = typeof req.query.tipo_movimiento === 'string'
    ? req.query.tipo_movimiento.trim()
    : '';
  if (tipoMovimiento && !VALID_MOVEMENT_TYPES.includes(tipoMovimiento)) {
    return res.status(400).json({ message: 'tipo_movimiento no es válido.' });
  }
  const result = await adminModel.listMovements({
    ...pagination,
    numeroCuenta,
    tipoMovimiento,
  });
  return res.json({
    data: result.rows,
    pagination: { page: pagination.page, limit: pagination.limit, total: result.total },
  });
});

const createDeposit = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const numeroCuenta = typeof body.numero_cuenta === 'string' ? body.numero_cuenta.trim() : '';
  const monto = typeof body.monto === 'number' ? String(body.monto) : body.monto;
  const descripcion = body.descripcion === undefined
    ? 'Consignación realizada por administración'
    : (typeof body.descripcion === 'string' ? body.descripcion.trim() : '');

  if (!/^\d{6,20}$/.test(numeroCuenta)) {
    return res.status(400).json({ message: 'numero_cuenta debe contener entre 6 y 20 dígitos.' });
  }
  if (!isValidAmount(monto)) {
    return res.status(400).json({ message: 'monto debe ser mayor que cero y tener máximo 2 decimales.' });
  }
  if (!descripcion || descripcion.length > 255) {
    return res.status(400).json({ message: 'descripcion debe tener entre 1 y 255 caracteres.' });
  }

  const result = await adminModel.deposit({ numeroCuenta, monto, descripcion });
  if (result.error === 'NOT_FOUND') {
    return res.status(404).json({ message: 'La cuenta no existe.' });
  }
  if (result.error === 'INACTIVE') {
    return res.status(409).json({ message: 'La cuenta o su titular no están activos.' });
  }
  return res.status(201).json({
    message: 'Consignación registrada correctamente.',
    data: result,
  });
});

module.exports = {
  dashboard,
  listClients,
  getClient,
  createClient,
  updateClient,
  changeClientStatus,
  listAccounts,
  listMovements,
  createDeposit,
};
