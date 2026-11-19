const express = require('express');
const { body, param } = require('express-validator');

const Social = require('../models/Social');
const { verifyToken, optionalAuth, verifyRole } = require('../middlewares/auth');
const { stripCrlf, validateRequest } = require('../utils/sanitize');

const router = express.Router();

// GET /api/socials (Público: solo activas; Admin con token válido: todas)
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    const filter = isAdmin ? {} : { active: true };
    const socials = await Social.find(filter).sort({ _id: 1 });
    return res.json(socials);
  } catch (err) {
    return next(err);
  }
});

// POST /api/socials (Solo Admin, validando https://)
router.post(
  '/',
  verifyToken,
  verifyRole(['admin']),
  [
    body('network').trim().notEmpty().withMessage('La plataforma es obligatoria.').isLength({ max: 50 }),
    body('url')
      .trim()
      .notEmpty()
      .withMessage('La URL es obligatoria.')
      .custom((val) => val.startsWith('https://'))
      .withMessage('Por seguridad, la URL debe iniciar con https://')
      .isURL({ protocols: ['https'], require_protocol: true })
      .withMessage('URL inválida.'),
    body('active').optional().isBoolean().withMessage('El campo active debe ser booleano.')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const social = await Social.create({
        network: stripCrlf(req.body.network),
        url: stripCrlf(req.body.url),
        active: req.body.active !== undefined ? Boolean(req.body.active) : true
      });
      return res.status(201).json(social);
    } catch (err) {
      return next(err);
    }
  }
);

// PATCH /api/socials/:id (Solo Admin)
router.patch(
  '/:id',
  verifyToken,
  verifyRole(['admin']),
  [
    param('id').isMongoId().withMessage('ID de red social inválido.'),
    body('network').optional().trim().notEmpty().isLength({ max: 50 }),
    body('url')
      .optional()
      .trim()
      .custom((val) => val.startsWith('https://'))
      .withMessage('Por seguridad, la URL debe iniciar con https://')
      .isURL({ protocols: ['https'], require_protocol: true })
      .withMessage('URL inválida.'),
    body('active').optional().isBoolean().withMessage('El campo active debe ser booleano.')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const social = await Social.findById(req.params.id);
      if (!social) {
        return res.status(404).json({ error: 'Enlace social no encontrado.' });
      }

      if (req.body.network !== undefined) social.network = stripCrlf(req.body.network);
      if (req.body.url !== undefined) social.url = stripCrlf(req.body.url);
      if (req.body.active !== undefined) {
        social.active = Boolean(req.body.active);
      } else if (
        req.body.network === undefined &&
        req.body.url === undefined
      ) {
        social.active = !social.active;
      }

      await social.save();
      return res.json(social);
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /api/socials/:id (Solo Admin)
router.delete(
  '/:id',
  verifyToken,
  verifyRole(['admin']),
  [param('id').isMongoId().withMessage('ID de red social inválido.')],
  validateRequest,
  async (req, res, next) => {
    try {
      const deleted = await Social.findByIdAndDelete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Enlace social no encontrado.' });
      }
      return res.json({ message: 'Enlace social eliminado.', _id: deleted._id });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
