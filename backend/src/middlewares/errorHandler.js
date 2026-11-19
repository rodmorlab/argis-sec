function errorHandler(err, _req, res, _next) {
  const isProd = process.env.NODE_ENV === 'production';

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor.';

  // Errores de JSON malformado en el body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Payload JSON inválido.';
  }

  // Errores de validación / casteo de Mongoose
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const firstMsg = Object.values(err.errors || {})[0]?.message;
    message = firstMsg || 'Error de validación en los datos enviados.';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Identificador de recurso inválido.';
  } else if (err.code === 11000) {
    statusCode = 409;
    message = 'El registro ya existe (conflicto de índice único).';
  }

  // En producción jamás exponer detalles ni stacktraces de errores internos 5xx
  if (isProd && statusCode >= 500) {
    return res.status(500).json({
      error: 'Error interno del servidor.'
    });
  }

  const payload = {
    error: message
  };

  if (!isProd && err.details) {
    payload.details = err.details;
  }

  if (!isProd && statusCode >= 500) {
    payload.stack = err.stack;
  }

  return res.status(statusCode).json(payload);
}

module.exports = errorHandler;
