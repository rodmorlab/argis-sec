process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_super_secret_key_for_aegissec_testing_2026';
process.env.FRONTEND_URL = 'http://localhost:5500';
process.env.INSTITUTIONAL_INBOX = 'contacto@aegissec.cl';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const { seedDatabase } = require('../src/seed');
const User = require('../src/models/User');
const ChatbotLog = require('../src/models/ChatbotLog');

const TEST_MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/aegissec_test_db';

describe('AegisSec Backend API & Security Suite', () => {
  let adminToken;
  let userToken;
  let registeredUserId;
  let createdServiceId;
  let createdBookingId;
  let createdSocialId;
  let createdFaqId;

  before(async () => {
    await mongoose.connect(TEST_MONGO_URI);
    await mongoose.connection.db.dropDatabase();
    await seedDatabase({ reset: true });
  });

  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  });

  describe('1. Hardening Express, Cabeceras y Seed Idempotente', () => {
    it('desactiva X-Powered-By, aplica Helmet y CORS', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:5500');

      assert.equal(res.status, 200);
      assert.equal(res.headers['x-powered-by'], undefined);
      assert.ok(res.headers['x-content-type-options']);
      assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5500');
    });

    it('rechaza payloads JSON mayores a 50kb', async () => {
      const largePayload = { message: 'a'.repeat(60 * 1024) };
      const res = await request(app).post('/api/chatbot/message').send(largePayload);
      assert.equal(res.status, 413);
    });

    it('ejecuta seedDatabase de forma idempotente y con Argon2id', async () => {
      const first = await seedDatabase();
      const second = await seedDatabase();
      assert.deepEqual(first, second);

      const adminInDb = await User.findOne({ email: 'admin@aegissec.cl' }).select('+passwordHash');
      assert.ok(adminInDb);
      assert.ok(adminInDb.passwordHash.startsWith('$argon2id$'));
    });
  });

  describe('2. Autenticación Argon2id, JWT y RBAC', () => {
    it('registra un usuario con Argon2id, fuerza rol usuario y no expone passwordHash', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Camila Rojas',
        email: 'camila@organizacion.cl',
        password: 'PasswordSegura2026!',
        role: 'admin' // intento de escalación que debe ser ignorado
      });

      assert.equal(res.status, 201);
      assert.ok(res.body.token);
      assert.equal(res.body.user.role, 'usuario');
      assert.equal(res.body.user.passwordHash, undefined);
      userToken = res.body.token;
      registeredUserId = res.body.user._id;
    });

    it('retorna 409 al registrar un correo duplicado', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Camila Duplicada',
        email: 'camila@organizacion.cl',
        password: 'PasswordSegura2026!'
      });

      assert.equal(res.status, 409);
    });

    it('bloquea inyección NoSQL en login y autentica admin correctamente', async () => {
      const sqliRes = await request(app)
        .post('/api/auth/login')
        .send({ email: { $gt: '' }, password: { $gt: '' } });
      assert.ok([400, 401].includes(sqliRes.status));

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@aegissec.cl', password: 'AdminSec2026!' });

      assert.equal(loginRes.status, 200);
      assert.ok(loginRes.body.token);
      assert.equal(loginRes.body.user.role, 'admin');
      assert.equal(loginRes.body.user.passwordHash, undefined);
      adminToken = loginRes.body.token;

      const decoded = jwt.decode(adminToken);
      assert.equal(decoded.role, 'admin');
      assert.equal(decoded.email, 'admin@aegissec.cl');
      assert.ok(decoded.exp - decoded.iat <= 3600);
    });

    it('renueva el token JWT en POST /api/auth/refresh', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${userToken}`);
      assert.equal(res.status, 200);
      assert.ok(res.body.token);
    });

    it('protege /api/admin/audit con 401 sin token, 403 con usuario y 200 con admin', async () => {
      const noToken = await request(app).get('/api/admin/audit');
      assert.equal(noToken.status, 401);

      const asUser = await request(app)
        .get('/api/admin/audit')
        .set('Authorization', `Bearer ${userToken}`);
      assert.equal(asUser.status, 403);

      const asAdmin = await request(app)
        .get('/api/admin/audit')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(asAdmin.status, 200);
      assert.equal(asAdmin.body.ok, true);
    });
  });

  describe('3. Servicios y Reservas (RBAC + Aislamiento de usuario)', () => {
    it('permite GET /api/services público y restringe POST/PUT/DELETE a admin', async () => {
      const pub = await request(app).get('/api/services');
      assert.equal(pub.status, 200);
      assert.ok(pub.body.length >= 4);

      const forbidden = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'X', category: 'Y', price: '10 UF', description: 'Desc' });
      assert.equal(forbidden.status, 403);

      const created = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Auditoría Kubernetes',
          category: 'Cloud Security',
          price: '50 UF',
          description: 'Revisión de clústeres y RBAC en Kubernetes.'
        });
      assert.equal(created.status, 201);
      createdServiceId = created.body._id;

      const updated = await request(app)
        .put(`/api/services/${createdServiceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Auditoría Kubernetes Pro',
          category: 'Cloud Security',
          price: '52 UF',
          description: 'Revisión avanzada de clústeres.'
        });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.price, '52 UF');
    });

    it('aísla reservas por usuario y permite cambio de estado solo a admin', async () => {
      const unauth = await request(app).get('/api/bookings');
      assert.equal(unauth.status, 401);

      const createRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          serviceTitle: 'Auditoría Kubernetes Pro',
          preferredDate: '2026-12-01',
          priority: 'Alta',
          notes: 'Revisar clúster EKS productivo.'
        });
      assert.equal(createRes.status, 201);
      assert.equal(createRes.body.status, 'Pendiente Revisión');
      createdBookingId = createRes.body._id;

      const userList = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`);
      assert.equal(userList.status, 200);
      assert.equal(userList.body.length, 1);

      const adminList = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(adminList.status, 200);
      assert.ok(adminList.body.length >= 2);

      const userPatch = await request(app)
        .patch(`/api/bookings/${createdBookingId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'Aprobada' });
      assert.equal(userPatch.status, 403);

      const adminPatch = await request(app)
        .patch(`/api/bookings/${createdBookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Aprobada' });
      assert.equal(adminPatch.status, 200);
      assert.equal(adminPatch.body.status, 'Aprobada');
    });
  });

  describe('4. Contacto + CAPTCHA + Anti-CRLF + Doble Correo + Rate Limit', () => {
    it('valida CAPTCHA, limpia CRLF, guarda contacto y despacha doble correo', async () => {
      const capRes = await request(app).get('/api/contacts/captcha');
      assert.equal(capRes.status, 200);
      assert.ok(capRes.body.captchaToken);

      const decodedCap = jwt.decode(capRes.body.captchaToken);

      const badCap = await request(app).post('/api/contacts').send({
        name: 'Visitante',
        email: 'visitante@empresa.cl',
        subject: 'Prueba',
        message: 'Mensaje de prueba con longitud válida.',
        captchaToken: capRes.body.captchaToken,
        captchaAnswer: decodedCap.expected + 1
      });
      assert.equal(badCap.status, 400);

      const goodRes = await request(app).post('/api/contacts').send({
        name: 'Visitante\r\nX-Evil: 1',
        email: 'visitante@empresa.cl',
        phone: '+56 9 5555 4444',
        subject: 'Cotización\r\nBcc: attacker@evil.com',
        message: 'Solicitamos evaluación de seguridad para nuestra API REST.',
        captchaToken: capRes.body.captchaToken,
        captchaAnswer: decodedCap.expected
      });

      assert.equal(goodRes.status, 201);
      assert.ok(!goodRes.body.contact.subject.includes('\r'));
      assert.ok(!goodRes.body.contact.subject.includes('\n'));
      assert.equal(goodRes.body.smtp.institutionalInbox, 'contacto@aegissec.cl');
      assert.equal(goodRes.body.smtp.smtpInstitutionalSent, true);
      assert.equal(goodRes.body.smtp.smtpClientCopySent, true);

      // Rate limit: max 3 req/min (ya hicimos 2 POSTs: badCap y goodRes)
      const thirdRes = await request(app).post('/api/contacts').send({
        name: 'Visitante 3',
        email: 'v3@empresa.cl',
        subject: 'Consulta 3',
        message: 'Mensaje de prueba suficientemente largo.',
        captchaToken: capRes.body.captchaToken,
        captchaAnswer: decodedCap.expected
      });
      assert.equal(thirdRes.status, 201);

      const fourthRes = await request(app).post('/api/contacts').send({
        name: 'Visitante 4',
        email: 'v4@empresa.cl',
        subject: 'Consulta 4',
        message: 'Mensaje de prueba suficientemente largo.',
        captchaToken: capRes.body.captchaToken,
        captchaAnswer: decodedCap.expected
      });
      assert.equal(fourthRes.status, 429);
    });
  });

  describe('5. Redes Sociales y Chatbot', () => {
    it('filtra redes activas para público, muestra todas a admin y valida https://', async () => {
      const pubSocials = await request(app).get('/api/socials');
      assert.equal(pubSocials.status, 200);
      assert.ok(pubSocials.body.every((s) => s.active === true));

      const admSocials = await request(app)
        .get('/api/socials')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(admSocials.status, 200);
      assert.ok(admSocials.body.some((s) => s.active === false));

      const insecureUrl = await request(app)
        .post('/api/socials')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ network: 'Facebook', url: 'http://facebook.com/aegissec', active: true });
      assert.equal(insecureUrl.status, 400);

      const validSocial = await request(app)
        .post('/api/socials')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ network: 'Facebook', url: 'https://facebook.com/aegissec', active: true });
      assert.equal(validSocial.status, 201);
      createdSocialId = validSocial.body._id;

      const patchedSocial = await request(app)
        .patch(`/api/socials/${createdSocialId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false });
      assert.equal(patchedSocial.status, 200);
      assert.equal(patchedSocial.body.active, false);
    });

    it('atiende chatbot, bloquea comandos admin, valida longitud y guarda logs', async () => {
      const tooLong = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'x'.repeat(181) });
      assert.equal(tooLong.status, 400);

      const blocked = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'quiero eliminar base de datos como admin' });
      assert.equal(blocked.status, 200);
      assert.equal(blocked.body.blocked, true);

      const matched = await request(app)
        .post('/api/chatbot/message')
        .send({ message: 'cual es el precio en uf?' });
      assert.equal(matched.status, 200);
      assert.equal(matched.body.blocked, false);
      assert.ok(matched.body.reply.includes('UF'));

      const logsCount = await ChatbotLog.countDocuments();
      assert.ok(logsCount >= 2);

      // CRUD FAQ admin
      const faqCreated = await request(app)
        .post('/api/chatbot/faqs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'Horarios',
          keywords: 'horario, atencion',
          question: '¿Cuál es el horario?',
          answer: 'Lunes a viernes de 09:00 a 18:00 hrs.'
        });
      assert.equal(faqCreated.status, 201);
      createdFaqId = faqCreated.body._id;
    });
  });

  describe('6. Administración NoSQL, Rate Limit Login y Manejo de Errores en Producción', () => {
    it('expone colecciones, backup y gestión de usuarios sin passwordHash completo', async () => {
      const usersRes = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(usersRes.status, 200);
      assert.ok(usersRes.body.every((u) => u.passwordHash === undefined && u.passwordHashPreview));

      const roleRes = await request(app)
        .patch(`/api/admin/users/${registeredUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' });
      assert.equal(roleRes.status, 200);
      assert.equal(roleRes.body.role, 'admin');

      const badCol = await request(app)
        .get('/api/admin/collections/secreta')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(badCol.status, 400);

      const backup = await request(app)
        .get('/api/admin/backup')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(backup.status, 200);
      assert.ok(Array.isArray(backup.body.users));
      assert.ok(Array.isArray(backup.body.services));
      assert.ok(Array.isArray(backup.body.chatbot_logs));
      assert.ok(backup.body.users.every((u) => u.passwordHash === undefined));
    });

    it('aplica rate limit de 5 intentos en /api/auth/login', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'admin@aegissec.cl', password: 'WrongPassword!' });
      }
      const blocked = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@aegissec.cl', password: 'WrongPassword!' });
      assert.equal(blocked.status, 429);
    });

    it('no expone stacktraces en NODE_ENV=production', async () => {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const res = await request(app)
          .post('/api/auth/login')
          .set('Content-Type', 'application/json')
          .send('{"malformed": ');
        assert.equal(res.status, 400);
        assert.equal(res.body.stack, undefined);
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });

    it('limpia recursos creados en CRUD admin', async () => {
      const delFaq = await request(app)
        .delete(`/api/chatbot/faqs/${createdFaqId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(delFaq.status, 200);

      const delSoc = await request(app)
        .delete(`/api/socials/${createdSocialId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(delSoc.status, 200);

      const delSrv = await request(app)
        .delete(`/api/services/${createdServiceId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(delSrv.status, 200);
    });
  });
});
