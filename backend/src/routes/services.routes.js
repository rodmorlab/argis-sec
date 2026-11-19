const express = require('express');
const { body, param } = require('express-validator');

const Service = require('../models/Service');
const { verifyToken, verifyRole } = require('../middlewares/auth');
const { stripCrlf, validateRequest } = require('../utils/sanitize');

const router = express.Router();

// GET /api/services (Público)
router.get('/', async (_req, res, next) => {
  try {
    const services = await Service.find().sort({ _id: 1 });
    return res.json(services);
  } catch (err) {
    return next(err);
  }
});

// POST /api/services (Solo Admin)
router.post(
  '/',
  verifyToken,
  verifyRole(['admin']),
  [
    body('title').trim().notEmpty().withMessage('El título es obligatorio.').isLength({ max: 150 }),
    body('category').trim().notEmpty().withMessage('La categoría es obligatoria.').isLength({ max: 80 }),
    body('price').trim().notEmpty().withMessage('El precio es obligatorio.').isLength({ max: 50 }),
    body('description').trim().notEmpty().withMessage('La descripción es obligatoria.').isLength({ max: 600 })
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const service = await Service.create({
        title: stripCrlf(req.body.title),
        category: stripCrlf(req.body.category),
        price: stripCrlf(req.body.price),
        description: String(req.body.description).trim()
      });
      return res.status(201).json(service);
    } catch (err) {
      return next(err);
    }
  }
);

// PUT /api/services/:id (Solo Admin)
router.put(
  '/:id',
  verifyToken,
  verifyRole(['admin']),
  [
    param('id').isMongoId().withMessage('ID de servicio inválido.'),
    body('title').trim().notEmpty().withMessage('El título es obligatorio.').isLength({ max: 150 }),
    body('category').trim().notEmpty().withMessage('La categoría es obligatoria.').isLength({ max: 80 }),
    body('price').trim().notEmpty().withMessage('El precio es obligatorio.').isLength({ max: 50 }),
    body('description').trim().notEmpty().withMessage('La descripción es obligatoria.').isLength({ max: 600 })
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const updated = await Service.findByIdAndUpdate(
        req.params.id,
        {
          title: stripCrlf(req.body.title),
          category: stripCrlf(req.body.category),
          price: stripCrlf(req.body.price),
          description: String(req.body.description).trim()
        },
        { new: true, runValidators: true }
      );

      if (!updated) {
        return res.status(404).json({ error: 'Servicio no encontrado.' });
      }
      return res.json(updated);
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /api/services/:id (Solo Admin)
router.delete(
  '/:id',
  verifyToken,
  verifyRole(['admin']),
  [param('id').isMongoId().withMessage('ID de servicio inválido.')],
  validateRequest,
  async (req, res, next) => {
    try {
      const deleted = await Service.findByIdAndDelete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Servicio no encontrado.' });
      }
      return res.json({ message: 'Servicio eliminado correctamente.', _id: deleted._id });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
