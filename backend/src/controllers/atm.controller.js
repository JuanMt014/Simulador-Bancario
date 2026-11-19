const atmModel = require('../models/atm.model');
const { normalizePositiveAmount } = require('../utils/money');

function asyncHandler(handler) {
  return (req, res) => handler(req, res).catch((error) => {
    console.error('Error en endpoint de cajero:', error.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  });
}

const getBalance = asyncHandler(async (req, res) => {
  const account = await atmModel.getActiveSessionAccount({
    userId: req.auth.userId,
    accountId: req.auth.accountId,
  });
  if (!account) return res.status(404).json({ message: 'La cuenta activa de la sesión no existe.' });
  return res.json({
    data: {
      numero_cuenta: account.numero_cuenta,
      tipo_cuenta: account.tipo_cuenta,
      saldo: account.saldo,
    },
  });
});

const listRecentMovements = asyncHandler(async (req, res) => {
  const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) {
    return res.status(400).json({ message: 'limit debe estar entre 1 y 20.' });
  }
  const account = await atmModel.getActiveSessionAccount({
    userId: req.auth.userId,
    accountId: req.auth.accountId,
  });
  if (!account) return res.status(404).json({ message: 'La cuenta activa de la sesión no existe.' });
  const movements = await atmModel.listRecentMovements({
    userId: req.auth.userId,
    accountId: req.auth.accountId,
    limit,
  });
  return res.json({ data: movements });
});

const withdraw = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const monto = normalizePositiveAmount(body.monto);
  if (!monto) {
    return res.status(400).json({ message: 'monto debe ser mayor que cero y tener máximo 2 decimales.' });
  }
  const descripcion = body.descripcion === undefined
    ? 'Retiro realizado en cajero automático'
    : (typeof body.descripcion === 'string' ? body.descripcion.trim() : '');
  if (!descripcion || descripcion.length > 255) {
    return res.status(400).json({ message: 'descripcion debe tener entre 1 y 255 caracteres.' });
  }

  const result = await atmModel.withdraw({
    userId: req.auth.userId,
    accountId: req.auth.accountId,
    monto,
    descripcion,
  });
  if (result.error === 'ACCOUNT_NOT_FOUND') {
    return res.status(404).json({ message: 'La cuenta activa de la sesión no existe.' });
  }
  if (result.error === 'INACTIVE_ACCOUNT') {
    return res.status(409).json({ message: 'La cuenta o su titular no están activos.' });
  }
  if (result.error === 'INSUFFICIENT_FUNDS') {
    return res.status(409).json({ message: 'Saldo insuficiente.' });
  }
  return res.status(201).json({ message: 'Retiro realizado correctamente.', data: result });
});

module.exports = { getBalance, listRecentMovements, withdraw };
