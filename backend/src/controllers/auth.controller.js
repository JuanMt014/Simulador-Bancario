const bcrypt = require('bcrypt');
const {
  findUserByEmail,
  findAccountByNumber,
  hasActiveAccountForUser,
} = require('../models/auth.model');
const { signToken } = require('../config/jwt');

const INVALID_CREDENTIALS = 'Credenciales inválidas o acceso inactivo.';

function issueToken(res, payload, sessionData) {
  try {
    const token = signToken(payload);
    return res.status(200).json({
      message: 'Autenticación exitosa.',
      token,
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      ...sessionData,
    });
  } catch (error) {
    console.error('No fue posible emitir el token JWT:', error.message);
    return res.status(500).json({ message: 'No fue posible iniciar sesión.' });
  }
}

async function login(req, res) {
  const correo = typeof req.body?.correo === 'string'
    ? req.body.correo.trim().toLowerCase()
    : '';
  const { password } = req.body || {};

  if (!correo || typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'Envía correo y password.' });
  }

  try {
    const user = await findUserByEmail(correo);
    if (!user || user.estado !== 'ACTIVO') {
      return res.status(401).json({ message: INVALID_CREDENTIALS });
    }
    if (user.rol === 'CLIENTE' && !await hasActiveAccountForUser(user.id)) {
      return res.status(401).json({ message: INVALID_CREDENTIALS });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: INVALID_CREDENTIALS });
    }

    return issueToken(res, {
      sub: String(user.id),
      role: user.rol,
      authMethod: 'password',
    }, {
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        correo: user.correo,
        rol: user.rol,
      },
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error.message);
    return res.status(500).json({ message: 'Error interno al iniciar sesión.' });
  }
}

async function cajeroLogin(req, res) {
  const numeroCuenta = typeof req.body?.numero_cuenta === 'string'
    ? req.body.numero_cuenta.trim()
    : '';
  const { pin } = req.body || {};

  if (!numeroCuenta || typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({
      message: 'Envía numero_cuenta y un PIN numérico de 4 a 6 dígitos.',
    });
  }

  try {
    const account = await findAccountByNumber(numeroCuenta);
    if (!account
      || account.rol !== 'CLIENTE'
      || account.cuenta_estado !== 'ACTIVO'
      || account.usuario_estado !== 'ACTIVO') {
      return res.status(401).json({ message: INVALID_CREDENTIALS });
    }

    const pinMatches = await bcrypt.compare(pin, account.pin_hash);
    if (!pinMatches) {
      return res.status(401).json({ message: INVALID_CREDENTIALS });
    }

    return issueToken(res, {
      sub: String(account.usuario_id),
      role: 'CLIENTE',
      authMethod: 'atm',
      accountId: String(account.cuenta_id),
    }, {
      user: {
        id: account.usuario_id,
        nombre: account.nombre,
        apellido: account.apellido,
        correo: account.correo,
        rol: account.rol,
      },
      account: {
        numero_cuenta: account.numero_cuenta,
        tipo_cuenta: account.tipo_cuenta,
      },
    });
  } catch (error) {
    console.error('Error al iniciar sesión en el cajero:', error.message);
    return res.status(500).json({ message: 'Error interno al iniciar sesión.' });
  }
}

module.exports = { login, cajeroLogin };
