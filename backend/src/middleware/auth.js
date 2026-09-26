const jwt = require('jsonwebtoken');
const config = require('../config');
const { HttpError } = require('../http');

function signToken(user) {
  return jwt.sign(
    { sub: user.Id, name: `${user.FirstName} ${user.LastName}` },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

/** Devuelve el id de usuario del token o null si no hay / es inválido. */
function verifyToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return Number(payload.sub) || null;
  } catch {
    return null;
  }
}

function tokenFrom(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

/** Adjunta req.userId si hay un token válido, pero no lo exige (modo lectura). */
function optionalAuth(req, _res, next) {
  req.userId = verifyToken(tokenFrom(req));
  next();
}

/** Exige sesión iniciada. */
function requireAuth(req, _res, next) {
  req.userId = verifyToken(tokenFrom(req));
  if (!req.userId) return next(new HttpError(401, 'Debes iniciar sesión para realizar esta acción.'));
  next();
}

module.exports = { signToken, verifyToken, optionalAuth, requireAuth };
