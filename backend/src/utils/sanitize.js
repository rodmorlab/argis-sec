const { validationResult } = require('express-validator');
const AppError = require('./AppError');

/**
 * Elimina caracteres CR/LF para prevenir inyección de cabeceras (CRLF Header Injection).
 */
function stripCrlf(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Middleware reutilizable que evalúa los resultados de express-validator.
 */
function validateRequest(req, _res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg
    }));
    return next(new AppError(formatted[0].message, 400, formatted));
  }
  return next();
}

module.exports = {
  stripCrlf,
  validateRequest
};
