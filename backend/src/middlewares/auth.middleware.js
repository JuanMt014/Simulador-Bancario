const { verifyToken } = require('../config/jwt');
const { isSessionActive } = require('../models/auth.model');

async function authenticateToken(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ message: 'Se requiere un token Bearer.' });
  }

  try {
    const claims = verifyToken(match[1]);
    const userId = Number(claims.sub);
    const accountId = claims.accountId ? Number(claims.accountId) : null;
    const validRole = ['ADMIN', 'CLIENTE'].includes(claims.role);
    const validMethod = ['password', 'atm'].includes(claims.authMethod);
    const validScope = claims.authMethod === 'atm'
      ? claims.role === 'CLIENTE' && accountId !== null
      : accountId === null;

    if (!Number.isSafeInteger(userId) || userId <= 0
      || (accountId !== null && (!Number.isSafeInteger(accountId) || accountId <= 0))
      || !validRole || !validMethod || !validScope) {
      return res.status(401).json({ message: 'El token no es válido.' });
    }

    if (!await isSessionActive({ userId, accountId, role: claims.role })) {
      return res.status(401).json({ message: 'El usuario o la cuenta ya no están activos.' });
    }

    req.auth = {
      userId,
      role: claims.role,
      authMethod: claims.authMethod,
      accountId,
    };
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'El token no es válido o ha expirado.' });
    }
    console.error('Error al validar sesión:', error.message);
    return res.status(500).json({ message: 'No fue posible validar la sesión.' });
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ message: 'Se requiere autenticación.' });
    }
    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({ message: 'No tienes permiso para acceder a este recurso.' });
    }
    return next();
  };
}

function authorizeAuthMethod(...allowedMethods) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ message: 'Se requiere autenticación.' });
    }
    if (!allowedMethods.includes(req.auth.authMethod)) {
      return res.status(403).json({ message: 'El método de autenticación no permite este acceso.' });
    }
    return next();
  };
}

module.exports = { authenticateToken, authorizeRoles, authorizeAuthMethod };
