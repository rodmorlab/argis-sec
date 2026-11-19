require('dotenv').config();
const mongoose = require('mongoose');
const argon2 = require('argon2');

const User = require('./models/User');
const Service = require('./models/Service');
const Booking = require('./models/Booking');
const Contact = require('./models/Contact');
const Social = require('./models/Social');
const ChatbotFaq = require('./models/ChatbotFaq');
const ChatbotLog = require('./models/ChatbotLog');

async function seedDatabase({ reset = false } = {}) {
  if (reset) {
    await Promise.all([
      User.deleteMany({}),
      Service.deleteMany({}),
      Booking.deleteMany({}),
      Contact.deleteMany({}),
      Social.deleteMany({}),
      ChatbotFaq.deleteMany({}),
      ChatbotLog.deleteMany({})
    ]);
  }

  // 1. Usuarios iniciales (con hash Argon2id real)
  let adminUser = await User.findOne({ email: 'admin@aegissec.cl' });
  if (!adminUser) {
    const adminHash = await argon2.hash('AdminSec2026!', { type: argon2.argon2id });
    adminUser = await User.create({
      name: 'Valentina Soto (CISO Admin)',
      email: 'admin@aegissec.cl',
      role: 'admin',
      passwordHash: adminHash,
      createdAt: new Date('2026-10-15T10:00:00Z')
    });
  }

  let clientUser = await User.findOne({ email: 'cliente@empresa.cl' });
  if (!clientUser) {
    const clientHash = await argon2.hash('Cliente2026!', { type: argon2.argon2id });
    clientUser = await User.create({
      name: 'Matías Alarcón (Cliente Empresa)',
      email: 'cliente@empresa.cl',
      role: 'usuario',
      passwordHash: clientHash,
      createdAt: new Date('2026-10-20T14:30:00Z')
    });
  }

  // 2. Servicios iniciales
  const initialServices = [
    {
      title: 'Pentesting Web & API REST (OWASP Top 10)',
      category: 'Auditoría DAST / SAST',
      price: '45 UF',
      description:
        'Evaluación profunda de controles de acceso (RBAC), tokens JWT, inyección NoSQL/SQL, XSS y cabeceras de seguridad con reporte ejecutivo y técnico.'
    },
    {
      title: 'Implementación de Pipeline DevSecOps CI/CD',
      category: 'DevOps & Automatización',
      price: '55 UF',
      description:
        'Diseño e integración de flujos en GitHub Actions con análisis estático (CodeQL), auditoría de dependencias (Snyk / npm audit) y despliegue continuo seguro.'
    },
    {
      title: 'Hardening y Administración MongoDB Atlas',
      category: 'Base de Datos NoSQL',
      price: '32 UF',
      description:
        'Configuración bajo principio de mínimo privilegio, creación de índices de rendimiento, validación de esquemas Mongoose y plan de respaldos automatizados.'
    },
    {
      title: 'Respuesta a Incidentes y Mitigación DDoS / Spam',
      category: 'Defensa Activa',
      price: '60 UF',
      description:
        'Configuración de Rate Limiting, WAF, protección de formularios SMTP y análisis forense ante intentos de intrusión o secuestro de sesiones.'
    }
  ];

  for (const srv of initialServices) {
    const exists = await Service.findOne({ title: srv.title });
    if (!exists) {
      await Service.create(srv);
    }
  }

  // 3. Reserva inicial
  const existingBooking = await Booking.findOne({
    userId: clientUser._id,
    serviceTitle: 'Pentesting Web & API REST (OWASP Top 10)',
    preferredDate: '2026-11-18'
  });
  if (!existingBooking) {
    await Booking.create({
      userId: clientUser._id,
      userName: clientUser.name,
      userEmail: clientUser.email,
      serviceTitle: 'Pentesting Web & API REST (OWASP Top 10)',
      preferredDate: '2026-11-18',
      priority: 'Alta',
      notes: 'Revisión previa al paso a producción del portal de pagos.',
      status: 'Aprobada',
      createdAt: new Date('2026-11-05T11:20:00Z')
    });
  }

  // 4. Contacto inicial
  const existingContact = await Contact.findOne({ ticketId: 'TCK-501001' });
  if (!existingContact) {
    await Contact.create({
      ticketId: 'TCK-501001',
      name: 'Carolina Méndez',
      email: 'cmendez@fintechsur.cl',
      phone: '+56 9 8765 4321',
      subject: 'Consulta por integración CodeQL en GitHub Actions',
      message:
        'Hola equipo AegisSec, necesitamos asesoría para detener el despliegue cuando existan alertas críticas.',
      smtpInstitutionalSent: true,
      smtpClientCopySent: true,
      createdAt: new Date('2026-11-08T16:45:00Z')
    });
  }

  // 5. Redes sociales iniciales
  const initialSocials = [
    { network: 'LinkedIn', url: 'https://www.linkedin.com/company/aegissec-enterprise', active: true },
    { network: 'GitHub', url: 'https://github.com/aegissec-enterprise', active: true },
    { network: 'Instagram', url: 'https://www.instagram.com/aegissec.cl', active: true },
    { network: 'WhatsApp Business', url: 'https://wa.me/56911223344', active: true },
    { network: 'TikTok', url: 'https://www.tiktok.com/@aegissec', active: false }
  ];

  for (const soc of initialSocials) {
    const exists = await Social.findOne({ network: soc.network, url: soc.url });
    if (!exists) {
      await Social.create(soc);
    }
  }

  // 6. FAQs del Chatbot iniciales
  const initialFaqs = [
    {
      category: 'Servicios y Precios',
      keywords: 'precio, costo, valor, servicios, cotizar, uf, catalogo',
      question: '¿Qué servicios ofrecen y cuáles son sus tarifas?',
      answer:
        'Ofrecemos Pentesting Web OWASP (45 UF), Pipelines DevSecOps CI/CD (55 UF) y Hardening MongoDB Atlas (32 UF). Puedes agendar en la pestaña "Mis Solicitudes".',
      active: true
    },
    {
      category: 'Seguridad JWT y Argon2id',
      keywords: 'jwt, token, contraseña, hash, argon2, argon2id, seguridad, roles, login',
      question: '¿Cómo protegen las credenciales y sesiones de usuario?',
      answer:
        'Utilizamos hashes irreversibles Argon2id para contraseñas y tokens JWT firmados con expiración y control de acceso por roles (RBAC).',
      active: true
    },
    {
      category: 'Contacto Ejecutivo',
      keywords: 'ejecutivo, humano, hablar, correo, telefono, contacto, urgente',
      question: 'Quiero hablar con un ejecutivo comercial',
      answer:
        'Puedes completar el Formulario de Contacto en la pestaña "Contacto & SMTP": recibirás confirmación inmediata en tu correo y un especialista te contactará en menos de 2 horas.',
      active: true
    },
    {
      category: 'DevSecOps y Escaneos',
      keywords: 'zap, owasp, codeql, snyk, vulnerabilidades, ci/cd, pipeline',
      question: '¿Qué herramientas DevSecOps utilizan en las auditorías?',
      answer:
        'Integramos OWASP ZAP (análisis dinámico DAST), GitHub CodeQL (análisis estático SAST) y npm audit / Snyk para dependencias dentro del flujo CI/CD.',
      active: true
    }
  ];

  for (const faq of initialFaqs) {
    const exists = await ChatbotFaq.findOne({ question: faq.question });
    if (!exists) {
      await ChatbotFaq.create(faq);
    }
  }

  return {
    users: await User.countDocuments(),
    services: await Service.countDocuments(),
    bookings: await Booking.countDocuments(),
    contacts: await Contact.countDocuments(),
    socials: await Social.countDocuments(),
    chatbot_faqs: await ChatbotFaq.countDocuments()
  };
}

if (require.main === module) {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/aegissec_db';
  mongoose
    .connect(mongoUri)
    .then(async () => {
      const summary = await seedDatabase({ reset: process.argv.includes('--reset') });
      console.log('[Seed] Base de datos poblada correctamente (idempotente):', summary);
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Error al ejecutar semilla:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
