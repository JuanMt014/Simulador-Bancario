const bcrypt = require('bcrypt');
const clientModel = require('../models/client.model');
const { normalizePositiveAmount } = require('../utils/money');

function isValidEmail(value) {
  return typeof value === 'string'
    && value.length <= 160
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function parsePagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 50 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1
    || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) return null;
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(offset)) return null;
  return { page, limit, offset };
}

function asyncHandler(handler) {
  return (req, res) => handler(req, res).catch((error) => {
    console.error('Error en endpoint de banca virtual:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'El correo ya está registrado.' });
    }
    return res.status(500).json({ message: 'Error interno del servidor.' });
  });
}

const getProfile = asyncHandler(async (req, res) => {
  const profile = await clientModel.getProfile(req.auth.userId);
  if (!profile) return res.status(404).json({ message: 'Perfil no encontrado.' });
  return res.json({ data: profile });
});

const updateProfile = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const fields = {};
  for (const field of ['nombre', 'apellido', 'telefono']) {
    if (body[field] !== undefined) {
      const maxLength = field === 'telefono' ? 30 : 80;
      if (!isValidText(body[field], maxLength)) {
        return res.status(400).json({ message: `${field} debe ser texto no vacío y tener una longitud válida.` });
      }
      fields[field] = body[field].trim();
    }
  }
  if (body.correo !== undefined) {
    if (typeof body.correo !== 'string' || !isValidEmail(body.correo.trim())) {
      return res.status(400).json({ message: 'correo debe tener un formato válido.' });
    }
    fields.correo = body.correo.trim().toLowerCase();
  }
  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ message: 'Envía al menos un dato permitido para actualizar.' });
  }

  await clientModel.updateProfile(req.auth.userId, fields);
  return res.json({ message: 'Perfil actualizado correctamente.' });
});

const changePassword = asyncHandler(async (req, res) => {
  const { password_actual: currentPassword, password_nueva: newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !currentPassword
    || typeof newPassword !== 'string' || newPassword.length < 8
    || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return res.status(400).json({
      message: 'Envía password_actual y una password_nueva de al menos 8 caracteres y máximo 72 bytes UTF-8.',
    });
  }

  const profileWithHash = await clientModel.getPasswordHash(req.auth.userId);
  if (!profileWithHash) return res.status(404).json({ message: 'Perfil no encontrado.' });
  if (!await bcrypt.compare(currentPassword, profileWithHash.password_hash)) {
    return res.status(401).json({ message: 'La contraseña actual no es correcta.' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  if (!await clientModel.updatePassword(req.auth.userId, passwordHash)) {
    return res.status(404).json({ message: 'Perfil no encontrado.' });
  }
  return res.json({ message: 'Contraseña actualizada correctamente.' });
});

const getAccounts = asyncHandler(async (req, res) => {
  const accounts = await clientModel.getAccounts(req.auth.userId);
  return res.json({ data: accounts });
});

const getPrimaryAccount = asyncHandler(async (req, res) => {
  const accounts = await clientModel.getAccounts(req.auth.userId);
  if (accounts.length === 0) return res.status(404).json({ message: 'No hay cuentas asociadas al cliente.' });
  return res.json({ data: accounts[0] });
});

const listMovements = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  if (!pagination) {
    return res.status(400).json({ message: 'page debe ser >= 1 y limit debe estar entre 1 y 100.' });
  }
  const result = await clientModel.listMovements({ userId: req.auth.userId, ...pagination });
  return res.json({
    data: result.rows,
    pagination: { page: pagination.page, limit: pagination.limit, total: result.total },
  });
});

const transfer = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const numeroCuentaOrigen = typeof body.numero_cuenta_origen === 'string'
    ? body.numero_cuenta_origen.trim()
    : '';
  const numeroCuentaDestino = typeof body.numero_cuenta_destino === 'string'
    ? body.numero_cuenta_destino.trim()
    : '';
  const monto = normalizePositiveAmount(body.monto);
  const descripcion = body.descripcion === undefined
    ? 'Transferencia entre cuentas'
    : (typeof body.descripcion === 'string' ? body.descripcion.trim() : '');

  if (!/^\d{6,20}$/.test(numeroCuentaOrigen) || !/^\d{6,20}$/.test(numeroCuentaDestino)) {
    return res.status(400).json({ message: 'Envía numero_cuenta_origen y numero_cuenta_destino válidos.' });
  }
  if (!monto) {
    return res.status(400).json({ message: 'monto debe ser mayor que cero y tener máximo 2 decimales.' });
  }
  if (!descripcion || descripcion.length > 200) {
    return res.status(400).json({ message: 'descripcion debe tener entre 1 y 200 caracteres.' });
  }

  const result = await clientModel.transfer({
    userId: req.auth.userId,
    numeroCuentaOrigen,
    numeroCuentaDestino,
    monto,
    descripcion,
  });
  if (result.error === 'ACCOUNT_NOT_FOUND') {
    return res.status(404).json({ message: 'La cuenta origen o destino no existe.' });
  }
  if (result.error === 'SAME_ACCOUNT') {
    return res.status(400).json({ message: 'La cuenta origen y destino deben ser diferentes.' });
  }
  if (result.error === 'NOT_OWNER') {
    return res.status(403).json({ message: 'La cuenta origen no pertenece al cliente autenticado.' });
  }
  if (result.error === 'INACTIVE_ACCOUNT') {
    return res.status(409).json({ message: 'La cuenta origen, destino o uno de sus titulares no está activo.' });
  }
  if (result.error === 'INSUFFICIENT_FUNDS') {
    return res.status(409).json({ message: 'Saldo insuficiente en la cuenta origen.' });
  }
  return res.status(201).json({ message: 'Transferencia realizada correctamente.', data: result });
});

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getAccounts,
  getPrimaryAccount,
  listMovements,
  transfer,
};
