const express = require('express');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');

const User = require('../models/User');
const { verifyToken } = require('../middlewares/auth');
const { stripCrlf, validateRequest } = require('../utils/sanitize');
const { getJwtSecret, getJwtExpiresIn } = require('../config/env');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'HTTP 429 Too Many Requests: Máximo 5 intentos de login cada 15 minutos.'
  }
});

function signUserToken(user) {
  const payload = {
    sub: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role
  };
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getJwtExpiresIn()
  });
}

function toPublicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

// POST /api/auth/register
router.post(
  '/register',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('El nombre completo es obligatorio.')
      .isLength({ min: 2, max: 100 })
      .withMessage('El nombre debe tener entre 2 y 100 caracteres.'),
    body('email')
      .trim()
      .notEmpty()
      .withMessage('El correo electrónico es obligatorio.')
      .isEmail()
      .withMessage('Formato de correo electrónico inválido.')
      .normalizeEmail({ gmail_remove_dots: false }),
    body('password')
      .isString()
      .isLength({ min: 8, max: 128 })
      .withMessage('La contraseña debe tener al menos 8 caracteres.')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const name = stripCrlf(req.body.name);
      const email = stripCrlf(req.body.email).toLowerCase();
      const { password } = req.body;

      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({
          error: 'Error 409: El correo electrónico ya se encuentra registrado.'
        });
      }

      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id
      });

      // Por principio de mínimo privilegio (OWASP A01), el registro público siempre asigna rol 'usuario'
      const user = await User.create({
        name,
        email,
        passwordHash,
        role: 'usuario'
      });

      const token = signUserToken(user);

      return res.status(201).json({
        token,
        user: toPublicUser(user)
      });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  loginLimiter,
  [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('El correo electrónico es obligatorio.')
      .isEmail()
      .withMessage('Correo electrónico inválido.')
      .normalizeEmail({ gmail_remove_dots: false }),
    body('password').isString().notEmpty().withMessage('La contraseña es obligatoria.')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const email = stripCrlf(req.body.email).toLowerCase();
      const { password } = req.body;

      const user = await User.findOne({ email }).select('+passwordHash');
      if (!user) {
        return res.status(401).json({
          error: 'Credenciales inválidas. Verifica tu correo o contraseña.'
        });
      }

      const isValid = await argon2.verify(user.passwordHash, password);
      if (!isValid) {
        return res.status(401).json({
          error: 'Credenciales inválidas. Verifica tu correo o contraseña.'
        });
      }

      const token = signUserToken(user);

      return res.status(200).json({
        token,
        user: toPublicUser(user)
      });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/auth/refresh
router.post('/refresh', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(401).json({
        error: 'El usuario asociado al token ya no existe (HTTP 401).'
      });
    }

    const token = signUserToken(user);

    return res.status(200).json({
      token,
      user: toPublicUser(user)
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
