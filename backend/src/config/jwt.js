const jwt = require('jsonwebtoken');

const JWT_ISSUER = 'simulador-bancario';
const JWT_AUDIENCE = 'simulador-bancario';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET debe estar definido y tener al menos 32 caracteres.');
  }
  return secret;
}

function signToken(payload) {
  const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
  return jwt.sign(payload, getSecret(), {
    algorithm: 'HS256',
    expiresIn,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

function verifyToken(token) {
  return jwt.verify(token, getSecret(), {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

module.exports = { signToken, verifyToken };
