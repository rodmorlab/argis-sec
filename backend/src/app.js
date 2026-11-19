const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');

const authRoutes = require('./routes/auth.routes');
const servicesRoutes = require('./routes/services.routes');
const bookingsRoutes = require('./routes/bookings.routes');
const contactsRoutes = require('./routes/contacts.routes');
const socialsRoutes = require('./routes/socials.routes');
const chatbotRoutes = require('./routes/chatbot.routes');
const adminRoutes = require('./routes/admin.routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Necesario detrás de proxies inversos (Render, Railway, Cloudflare) para que express-rate-limit identifique la IP real del cliente
app.set('trust proxy', 1);

// Hardening de cabeceras HTTP y ocultamiento de firma Express
app.disable('x-powered-by');
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:', 'http://localhost:4000', 'http://127.0.0.1:4000'],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"]
      }
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  })
);
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  next();
});

// CORS estricto hacia FRONTEND_URL (soporta múltiples orígenes separados por coma)
const allowedOrigins = (process.env.FRONTEND_URL || 'http://127.0.0.1:5500,http://localhost:5500')
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Límite de payload JSON y sanitización anti-inyección NoSQL ($gt, $ne, etc.)
app.use(express.json({ limit: '50kb' }));
app.use(mongoSanitize());

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'aegissec-api', timestamp: new Date().toISOString() });
});

// Rutas de la API REST
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/socials', socialsRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/admin', adminRoutes);

// Servir archivos estáticos del frontend (index.html, styles.css, app.js) para despliegues unificados o pruebas DAST
const frontendRoot = path.resolve(__dirname, '../..');
app.get('/', (_req, res) => {
  res.sendFile(path.join(frontendRoot, 'index.html'));
});
app.get('/index.html', (_req, res) => {
  res.sendFile(path.join(frontendRoot, 'index.html'));
});
app.get('/styles.css', (_req, res) => {
  res.sendFile(path.join(frontendRoot, 'styles.css'));
});
app.get('/runtime-config.js', (_req, res) => {
  res.sendFile(path.join(frontendRoot, 'runtime-config.js'));
});
app.get('/app.js', (_req, res) => {
  res.sendFile(path.join(frontendRoot, 'app.js'));
});

// 404 controlado para rutas inexistentes
app.use((_req, res) => {
  res.status(404).json({ error: 'Recurso o endpoint no encontrado.' });
});

// Middleware global de errores
app.use(errorHandler);

module.exports = app;
