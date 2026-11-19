const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param } = require('express-validator');

const ChatbotFaq = require('../models/ChatbotFaq');
const Service = require('../models/Service');
const { resolveQuickAnswer } = require('../services/chatbot/quickAnswer');
const { askModel, detailsMode, DetailUnavailable, unavailableMessage } = require('../services/chatbot/chatDetail');
const ChatbotLog = require('../models/ChatbotLog');
const { verifyToken, verifyRole } = require('../middlewares/auth');
const { stripCrlf, validateRequest } = require('../utils/sanitize');

const router = express.Router();

const chatMessageLimiter = rateLimit({
  windowMs: 3 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'HTTP 429 Too Many Requests: Has enviado demasiados mensajes seguidos. Espera 3 segundos.'
  }
});

const BLOCKED_ADMIN_TERMS = [
  'eliminar',
  'borrar',
  'drop',
  'admin',
  'delete',
  'truncate',
  '$where',
  'db.',
  'shutdown'
];

router.get('/details/status', (_req, res) => {
  const mode = detailsMode();
  if (mode !== 'rules' && (mode !== 'ai' || !process.env.CHAT_AI_URL)) {
    return res.status(503).json({ error: unavailableMessage });
  }
  return res.json({ mode });
});

// GET /api/chatbot/faqs (Público: solo FAQs activas)
router.get('/faqs', async (_req, res, next) => {
  try {
    const faqs = await ChatbotFaq.find({ active: true }).sort({ _id: 1 });
    return res.json(faqs);
  } catch (err) {
    return next(err);
  }
});

// GET /api/chatbot/faqs/admin (Solo Admin: todas las FAQs)
router.get('/faqs/admin', verifyToken, verifyRole(['admin']), async (_req, res, next) => {
  try {
    const faqs = await ChatbotFaq.find().sort({ _id: 1 });
    return res.json(faqs);
  } catch (err) {
    return next(err);
  }
});

// POST /api/chatbot/message (Público con Rate Limit 6 msg / 3s y máx 180 chars)
router.post(
  '/message',
  chatMessageLimiter,
  [
    body('message')
      .trim()
      .notEmpty()
      .withMessage('El mensaje no puede estar vacío.')
      .isLength({ max: 180 })
      .withMessage('El mensaje no puede superar los 180 caracteres.')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const rawQuery = stripCrlf(req.body.message);
      const details = req.body.details === true;
      const mode = details ? detailsMode() : 'rules';
      const normalized = rawQuery.toLowerCase();

      // Bloqueo de intentos de comandos administrativos
      const isAdminAttempt = BLOCKED_ADMIN_TERMS.some((term) => normalized.includes(term));
      if (mode === 'rules' && isAdminAttempt) {
        const log = await ChatbotLog.create({
          query: rawQuery,
          matchedCategory: 'Bloqueo Seguridad'
        });

        return res.json({
          reply:
            'Por políticas de seguridad, el chatbot no ejecuta acciones administrativas ni expone datos internos.',
          matchedCategory: 'Bloqueo Seguridad',
          blocked: true,
          log
        });
      }

      if (mode === 'off' || !['ai', 'rules'].includes(mode)) {
        return res.status(503).json({ error: unavailableMessage });
      }

      const services = await Service.find().sort({ title: 1 });
      const history = Array.isArray(req.body.history) ? req.body.history : [];
      const answer = mode === 'ai'
        ? await askModel(rawQuery, services, history)
        : resolveQuickAnswer(rawQuery, await ChatbotFaq.find({ active: true }), services, req.body.quickPhase);
      const match = mode === 'ai'
        ? { matchedCategory: 'Detalles IA', ...(typeof answer === 'string' ? { reply: answer } : answer) }
        : answer;
      const matchedCategory = match?.matchedCategory || 'Fallback / Ejecutivo';
      const reply = match
        ? match.reply
        : 'No encontré una respuesta exacta para tu consulta. ¿Deseas hablar con un ejecutivo? Puedes escribirnos en la pestaña "Contacto & SMTP" o elegir una opción del menú.';

      const log = await ChatbotLog.create({
        query: rawQuery,
        matchedCategory
      });

      return res.json({
        reply,
        matchedCategory,
        blocked: false,
        ...(mode === 'rules' ? { quickPhase: match?.quickPhase ?? null } : {}),
        ...(match?.recommendations?.length ? { recommendations: match.recommendations } : {}),
        log
      });
    } catch (err) {
      if (err instanceof DetailUnavailable) {
        return res.status(503).json({ error: unavailableMessage });
      }
      return next(err);
    }
  }
);

// POST /api/chatbot/faqs (Solo Admin)
router.post(
  '/faqs',
  verifyToken,
  verifyRole(['admin']),
  [
    body('category').trim().notEmpty().withMessage('La categoría es obligatoria.').isLength({ max: 80 }),
    body('keywords').trim().notEmpty().withMessage('Las palabras clave son obligatorias.').isLength({ max: 250 }),
    body('question').trim().notEmpty().withMessage('La pregunta es obligatoria.').isLength({ max: 200 }),
    body('answer').trim().notEmpty().withMessage('La respuesta es obligatoria.').isLength({ max: 600 }),
    body('active').optional().isBoolean()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const faq = await ChatbotFaq.create({
        category: stripCrlf(req.body.category),
        keywords: stripCrlf(req.body.keywords),
        question: stripCrlf(req.body.question),
        answer: String(req.body.answer).trim(),
        active: req.body.active !== undefined ? Boolean(req.body.active) : true
      });
      return res.status(201).json(faq);
    } catch (err) {
      return next(err);
    }
  }
);

// PATCH /api/chatbot/faqs/:id (Solo Admin)
router.patch(
  '/faqs/:id',
  verifyToken,
  verifyRole(['admin']),
  [
    param('id').isMongoId().withMessage('ID de FAQ inválido.'),
    body('category').optional().trim().notEmpty().isLength({ max: 80 }),
    body('keywords').optional().trim().notEmpty().isLength({ max: 250 }),
    body('question').optional().trim().notEmpty().isLength({ max: 200 }),
    body('answer').optional().trim().notEmpty().isLength({ max: 600 }),
    body('active').optional().isBoolean()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const faq = await ChatbotFaq.findById(req.params.id);
      if (!faq) {
        return res.status(404).json({ error: 'Regla FAQ no encontrada.' });
      }

      if (req.body.category !== undefined) faq.category = stripCrlf(req.body.category);
      if (req.body.keywords !== undefined) faq.keywords = stripCrlf(req.body.keywords);
      if (req.body.question !== undefined) faq.question = stripCrlf(req.body.question);
      if (req.body.answer !== undefined) faq.answer = String(req.body.answer).trim();
      if (req.body.active !== undefined) {
        faq.active = Boolean(req.body.active);
      } else if (
        req.body.category === undefined &&
        req.body.keywords === undefined &&
        req.body.question === undefined &&
        req.body.answer === undefined
      ) {
        faq.active = !faq.active;
      }

      await faq.save();
      return res.json(faq);
    } catch (err) {
      return next(err);
    }
  }
);

// PUT /api/chatbot/faqs/:id (Solo Admin)
router.put(
  '/faqs/:id',
  verifyToken,
  verifyRole(['admin']),
  [
    param('id').isMongoId().withMessage('ID de FAQ inválido.'),
    body('category').trim().notEmpty().isLength({ max: 80 }),
    body('keywords').trim().notEmpty().isLength({ max: 250 }),
    body('question').trim().notEmpty().isLength({ max: 200 }),
    body('answer').trim().notEmpty().isLength({ max: 600 }),
    body('active').optional().isBoolean()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const updated = await ChatbotFaq.findByIdAndUpdate(
        req.params.id,
        {
          category: stripCrlf(req.body.category),
          keywords: stripCrlf(req.body.keywords),
          question: stripCrlf(req.body.question),
          answer: String(req.body.answer).trim(),
          ...(req.body.active !== undefined ? { active: Boolean(req.body.active) } : {})
        },
        { new: true, runValidators: true }
      );
      if (!updated) {
        return res.status(404).json({ error: 'Regla FAQ no encontrada.' });
      }
      return res.json(updated);
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /api/chatbot/faqs/:id (Solo Admin)
router.delete(
  '/faqs/:id',
  verifyToken,
  verifyRole(['admin']),
  [param('id').isMongoId().withMessage('ID de FAQ inválido.')],
  validateRequest,
  async (req, res, next) => {
    try {
      const deleted = await ChatbotFaq.findByIdAndDelete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Regla FAQ no encontrada.' });
      }
      return res.json({ message: 'Regla eliminada del Chatbot.', _id: deleted._id });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
