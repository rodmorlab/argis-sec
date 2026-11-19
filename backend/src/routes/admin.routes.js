const express = require('express');
const { body, param } = require('express-validator');

const User = require('../models/User');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const Contact = require('../models/Contact');
const Social = require('../models/Social');
const ChatbotFaq = require('../models/ChatbotFaq');
const ChatbotLog = require('../models/ChatbotLog');

const { verifyToken, verifyRole } = require('../middlewares/auth');
const { validateRequest } = require('../utils/sanitize');
const { seedDatabase } = require('../seed');

const router = express.Router();

// Todas las rutas administrativas requieren JWT válido + rol 'admin'
router.use(verifyToken, verifyRole(['admin']));

// GET /api/admin/audit
router.get('/audit', (req, res) => {
  return res.json({
    ok: true,
    message: 'Acceso concedido al endpoint privado. Firma JWT y rol admin verificados.',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// GET /api/admin/users
router.get('/users', async (_req, res, next) => {
  try {
    const users = await User.find().select('+passwordHash').sort({ createdAt: 1 });
    const sanitized = users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      passwordHashPreview: u.passwordHash ? `${u.passwordHash.slice(0, 28)}...` : 'Argon2id',
      createdAt: u.createdAt
    }));
    return res.json(sanitized);
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/admin/users/:id/role
router.patch(
  '/users/:id/role',
  [
    param('id').isMongoId().withMessage('ID de usuario inválido.'),
    body('role')
      .optional()
      .isIn(['admin', 'usuario'])
      .withMessage("El rol debe ser 'admin' o 'usuario'.")
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      user.role = req.body.role || (user.role === 'admin' ? 'usuario' : 'admin');
      await user.save();

      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      });
    } catch (err) {
      return next(err);
    }
  }
);

const COLLECTION_MAP = {
  users: () => User.find().select('-passwordHash').sort({ createdAt: 1 }).lean(),
  services: () => Service.find().sort({ _id: 1 }).lean(),
  bookings: () => Booking.find().sort({ createdAt: -1 }).lean(),
  contacts: () => Contact.find().sort({ createdAt: -1 }).lean(),
  socials: () => Social.find().sort({ _id: 1 }).lean(),
  chatbot_faqs: () => ChatbotFaq.find().sort({ _id: 1 }).lean(),
  chatbot_logs: () => ChatbotLog.find().sort({ timestamp: -1 }).limit(100).lean()
};

// GET /api/admin/collections/:name
router.get('/collections/:name', async (req, res, next) => {
  try {
    const loader = COLLECTION_MAP[req.params.name];
    if (!loader) {
      return res.status(400).json({ error: 'Colección solicitada no permitida.' });
    }
    const docs = await loader();
    return res.json(docs);
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/backup
router.get('/backup', async (_req, res, next) => {
  try {
    const [users, services, bookings, contacts, socials, chatbot_faqs, chatbot_logs] =
      await Promise.all([
        COLLECTION_MAP.users(),
        COLLECTION_MAP.services(),
        COLLECTION_MAP.bookings(),
        COLLECTION_MAP.contacts(),
        COLLECTION_MAP.socials(),
        COLLECTION_MAP.chatbot_faqs(),
        ChatbotLog.find().sort({ timestamp: -1 }).lean()
      ]);

    return res.json({
      exportedAt: new Date().toISOString(),
      users,
      services,
      bookings,
      contacts,
      socials,
      chatbot_faqs,
      chatbot_logs
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/seed (Restaurar semilla idempotente)
router.post('/seed', async (req, res, next) => {
  try {
    const reset = Boolean(req.body?.reset);
    const summary = await seedDatabase({ reset });
    return res.json({
      message: 'Semilla NoSQL restaurada correctamente.',
      summary
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
