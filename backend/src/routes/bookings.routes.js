const express = require('express');
const { body, param } = require('express-validator');

const Booking = require('../models/Booking');
const { verifyToken, verifyRole } = require('../middlewares/auth');
const { stripCrlf, validateRequest } = require('../utils/sanitize');

const router = express.Router();

// GET /api/bookings (Autenticado: usuario ve solo las suyas; admin ve todas)
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user.sub };
    const bookings = await Booking.find(filter).sort({ createdAt: -1 });
    return res.json(bookings);
  } catch (err) {
    return next(err);
  }
});

// POST /api/bookings (Autenticado)
router.post(
  '/',
  verifyToken,
  [
    body('serviceTitle')
      .trim()
      .notEmpty()
      .withMessage('El servicio solicitado es obligatorio.')
      .isLength({ max: 150 }),
    body('preferredDate')
      .trim()
      .notEmpty()
      .withMessage('La fecha preferida es obligatoria.')
      .isISO8601()
      .withMessage('Formato de fecha inválido (YYYY-MM-DD).'),
    body('priority')
      .isIn(['Normal', 'Alta', 'Crítica'])
      .withMessage('La prioridad debe ser Normal, Alta o Crítica.'),
    body('notes')
      .trim()
      .notEmpty()
      .withMessage('El alcance técnico es obligatorio.')
      .isLength({ max: 300 })
      .withMessage('Las notas no pueden superar 300 caracteres.')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const booking = await Booking.create({
        userId: req.user.sub,
        userName: stripCrlf(req.user.name),
        userEmail: stripCrlf(req.user.email).toLowerCase(),
        serviceTitle: stripCrlf(req.body.serviceTitle),
        preferredDate: stripCrlf(req.body.preferredDate),
        priority: req.body.priority,
        notes: stripCrlf(req.body.notes),
        status: 'Pendiente Revisión'
      });

      return res.status(201).json(booking);
    } catch (err) {
      return next(err);
    }
  }
);

// PATCH /api/bookings/:id/status (Solo Admin)
router.patch(
  '/:id/status',
  verifyToken,
  verifyRole(['admin']),
  [
    param('id').isMongoId().withMessage('ID de reserva inválido.'),
    body('status')
      .optional()
      .isIn(['Pendiente Revisión', 'Aprobada'])
      .withMessage("El estado debe ser 'Pendiente Revisión' o 'Aprobada'.")
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const booking = await Booking.findById(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: 'Reserva no encontrada.' });
      }

      booking.status =
        req.body.status ||
        (booking.status === 'Aprobada' ? 'Pendiente Revisión' : 'Aprobada');

      await booking.save();
      return res.json(booking);
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
