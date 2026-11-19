const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');

const Contact = require('../models/Contact');
const { verifyToken, verifyRole } = require('../middlewares/auth');
const { stripCrlf, validateRequest } = require('../utils/sanitize');
const { sendContactEmails } = require('../services/mailer');
const { getJwtSecret } = require('../config/env');

const router = express.Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'HTTP 429 Too Many Requests: Límite antispam alcanzado (máx. 3 envíos por minuto).'
  }
});

// GET /api/contacts/captcha (Público)
router.get('/captcha', (_req, res) => {
  const a = Math.floor(Math.random() * 8) + 2;
  const b = Math.floor(Math.random() * 8) + 1;
  const nonce = crypto.randomBytes(8).toString('hex');

  const captchaToken = jwt.sign(
    {
      expected: a + b,
      nonce,
      purpose: 'contact-captcha'
    },
    getJwtSecret(),
    { expiresIn: '10m' }
  );

  return res.json({
    question: `¿Cuánto es ${a} + ${b}?`,
    captchaToken
  });
});

// POST /api/contacts (Público, con Rate Limit, Validación, Anti-CRLF, CAPTCHA y Doble SMTP)
router.post(
  '/',
  contactLimiter,
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('El nombre completo es obligatorio.')
      .isLength({ max: 80 }),
    body('email')
      .trim()
      .notEmpty()
      .withMessage('El correo electrónico es obligatorio.')
      .isEmail()
      .withMessage('Correo electrónico inválido.')
      .isLength({ max: 100 }),
    body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
    body('subject')
      .trim()
      .notEmpty()
      .withMessage('El asunto es obligatorio.')
      .isLength({ max: 120 }),
    body('message')
      .trim()
      .isLength({ min: 15, max: 500 })
      .withMessage('El mensaje debe tener entre 15 y 500 caracteres.'),
    body('captchaToken').notEmpty().withMessage('Token CAPTCHA requerido.'),
    body('captchaAnswer').isNumeric().withMessage('Respuesta CAPTCHA numérica requerida.')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      // 1. Verificar token y respuesta CAPTCHA
      let decodedCaptcha;
      try {
        decodedCaptcha = jwt.verify(req.body.captchaToken, getJwtSecret());
      } catch (_err) {
        return res.status(400).json({
          error: 'El desafío CAPTCHA expiró o es inválido. Solicita uno nuevo.'
        });
      }

      if (
        decodedCaptcha.purpose !== 'contact-captcha' ||
        Number(req.body.captchaAnswer) !== Number(decodedCaptcha.expected)
      ) {
        return res.status(400).json({
          error: 'Verificación CAPTCHA incorrecta. Intenta nuevamente.'
        });
      }

      // 2. Sanitización anti-CRLF (elimina \r y \n en cabeceras de correo)
      const name = stripCrlf(req.body.name);
      const email = stripCrlf(req.body.email).toLowerCase();
      const phone = stripCrlf(req.body.phone || 'No indicado');
      const subject = stripCrlf(req.body.subject);
      const message = String(req.body.message).replace(/\r\n/g, '\n').trim();
      const ticketId = `TCK-${Math.floor(100000 + Math.random() * 900000)}`;

      // 3. Doble envío SMTP con Nodemailer
      const mailResult = await sendContactEmails({
        ticketId,
        name,
        email,
        phone,
        subject,
        message
      });

      // 4. Guardar en colección contacts
      const contact = await Contact.create({
        ticketId,
        name,
        email,
        phone,
        subject,
        message,
        smtpInstitutionalSent: mailResult.smtpInstitutionalSent,
        smtpClientCopySent: mailResult.smtpClientCopySent
      });

      return res.status(201).json({
        contact,
        smtp: mailResult
      });
    } catch (err) {
      return next(err);
    }
  }
);

// GET /api/contacts (Solo Admin)
router.get('/', verifyToken, verifyRole(['admin']), async (_req, res, next) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    return res.json(contacts);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
