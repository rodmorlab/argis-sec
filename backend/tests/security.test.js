process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_security_suite_jwt_secret_key_2026_aegissec';
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

const SECURITY_TEST_DB =
  process.env.MONGO_SECURITY_TEST_URI || 'mongodb://127.0.0.1:27017/aegissec_security_test_db';

describe('Suite de Pruebas de Seguridad e Integración (Certamen DevSecOps)', () => {
  let usuarioToken = '';
  let adminToken = '';

  before(async () => {
    await mongoose.connect(SECURITY_TEST_DB);
    await mongoose.connection.db.dropDatabase();
    await seedDatabase({ reset: true });
  });

  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  });

  it('a) Registro de usuario: hashea contraseña con $argon2id$ en BD y jamás devuelve passwordHash en el JSON', async () => {
    const email = 'auditor.sec@empresa.cl';
    const res = await request(app).post('/api/auth/register').send({
      name: 'Auditor Seguridad',
      email,
      password: 'ClaveFuerteArgon2026!'
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.token, 'Debe emitir un token JWT al registrar');
    assert.ok(res.body.user, 'Debe devolver el objeto público del usuario');
    assert.equal(res.body.user.email, email);
    assert.equal(res.body.user.role, 'usuario');
    assert.equal(
      res.body.user.passwordHash,
      undefined,
      'Jamás debe exponer passwordHash en la respuesta JSON'
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(res.body, 'passwordHash'),
      false,
      'El body raíz tampoco debe incluir passwordHash'
    );

    const dbUser = await User.findOne({ email }).select('+passwordHash');
    assert.ok(dbUser, 'El usuario debe existir en MongoDB');
    assert.ok(
      dbUser.passwordHash.startsWith('$argon2id$'),
      `El hash en BD debe iniciar con $argon2id$, recibido: ${dbUser.passwordHash.slice(0, 15)}`
    );

    usuarioToken = res.body.token;
  });

  it('b) Login exitoso con emisión de JWT válido y rechazo HTTP 401 con credenciales erróneas', async () => {
    // 1. Credenciales erróneas -> HTTP 401
    const badLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@aegissec.cl',
      password: 'PasswordIncorrecta123!'
    });
    assert.equal(badLogin.status, 401);
    assert.equal(badLogin.body.token, undefined);

    // 2. Usuario inexistente -> HTTP 401
    const unknownLogin = await request(app).post('/api/auth/login').send({
      email: 'noexiste@aegissec.cl',
      password: 'AdminSec2026!'
    });
    assert.equal(unknownLogin.status, 401);

    // 3. Credenciales válidas -> HTTP 200 + JWT firmado
    const okLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@aegissec.cl',
      password: 'AdminSec2026!'
    });
    assert.equal(okLogin.status, 200);
    assert.ok(okLogin.body.token);
    assert.equal(okLogin.body.user.role, 'admin');
    assert.equal(okLogin.body.user.passwordHash, undefined);

    const decoded = jwt.verify(okLogin.body.token, process.env.JWT_SECRET);
    assert.equal(decoded.email, 'admin@aegissec.cl');
    assert.equal(decoded.role, 'admin');
    assert.ok(decoded.sub);

    adminToken = okLogin.body.token;
  });

  it('c) Acceso denegado (HTTP 401) a rutas protegidas sin token o con token inválido', async () => {
    const noTokenBookings = await request(app).get('/api/bookings');
    assert.equal(noTokenBookings.status, 401);

    const noTokenAudit = await request(app).get('/api/admin/audit');
    assert.equal(noTokenAudit.status, 401);

    const invalidTokenRes = await request(app)
      .get('/api/bookings')
      .set('Authorization', 'Bearer token.jwt.malformado');
    assert.equal(invalidTokenRes.status, 401);
  });

  it('d) Acceso denegado (HTTP 403) a rutas administrativas usando token de rol usuario (RBAC)', async () => {
    const auditForbidden = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${usuarioToken}`);
    assert.equal(auditForbidden.status, 403);

    const usersForbidden = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${usuarioToken}`);
    assert.equal(usersForbidden.status, 403);

    const backupForbidden = await request(app)
      .get('/api/admin/backup')
      .set('Authorization', `Bearer ${usuarioToken}`);
    assert.equal(backupForbidden.status, 403);

    const createServiceForbidden = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${usuarioToken}`)
      .send({
        title: 'Servicio No Autorizado',
        category: 'Pentesting',
        price: '10 UF',
        description: 'Intento de creación con rol usuario'
      });
    assert.equal(createServiceForbidden.status, 403);
  });

  it('e) Rechazo de inyección NoSQL ({"email": {"$gt": ""}}) y rechazo de URL sin https:// en redes sociales', async () => {
    // 1. Intento de bypass de autenticación mediante operador MongoDB ($gt)
    const nosqlInjectionRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: { $gt: '' },
        password: 'AdminSec2026!'
      });
    assert.ok(
      [400, 401].includes(nosqlInjectionRes.status),
      `Debe rechazar payload con operador NoSQL ($gt) con 400 o 401, recibido: ${nosqlInjectionRes.status}`
    );
    assert.equal(nosqlInjectionRes.body.token, undefined);

    // 2. Rechazo de URL con protocolo inseguro http:// en redes sociales
    const insecureSocialRes = await request(app)
      .post('/api/socials')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        network: 'LinkedIn',
        url: 'http://www.linkedin.com/company/aegissec',
        active: true
      });
    assert.equal(insecureSocialRes.status, 400);

    // 3. Rechazo de esquema peligroso javascript: en redes sociales
    const xssSocialRes = await request(app)
      .post('/api/socials')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        network: 'GitHub',
        url: 'javascript:alert(1)',
        active: true
      });
    assert.equal(xssSocialRes.status, 400);

    // 4. Confirmación de aceptación únicamente con https://
    const validSocialRes = await request(app)
      .post('/api/socials')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        network: 'GitHub',
        url: 'https://github.com/aegissec-official',
        active: true
      });
    assert.equal(validSocialRes.status, 201);
  });
});
