const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/env');

function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

function verifyToken(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'No se envió cabecera Authorization Bearer válida (HTTP 401).'
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = {
      sub: decoded.sub,
      _id: decoded.sub,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role
    };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado (HTTP 401 TokenExpiredError).'
      });
    }
    return res.status(401).json({
      error: 'Token JWT inválido (HTTP 401).'
    });
  }
}

function optionalAuth(req, _res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = {
      sub: decoded.sub,
      _id: decoded.sub,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role
    };
  } catch (_err) {
    req.user = null;
  }
  return next();
}

function verifyRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Autenticación requerida (HTTP 401).'
      });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Acceso denegado: el rol '${req.user.role}' no tiene permisos suficientes (HTTP 403).`
      });
    }
    return next();
  };
}

module.exports = {
  verifyToken,
  optionalAuth,
  verifyRole
};
