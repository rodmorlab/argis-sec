const { test } = require('node:test');
const assert = require('node:assert/strict');

const Service = require('../src/models/Service');
const Faq = require('../src/models/ChatbotFaq');
const Log = require('../src/models/ChatbotLog');
const router = require('../src/routes/chatbot.routes');

test('el controlador sigue el caso rápido, cambia de tema y conserva precios y FAQ', async (t) => {
  t.mock.method(Service, 'find', () => ({ sort: async () => [
    { title: 'Hardening MongoDB Atlas', price: '77 UF', description: 'Permisos mínimos', category: 'Base de Datos NoSQL' },
    { title: 'Respuesta a Incidentes y Mitigación DDoS / Spam', price: '61 UF', description: 'Controles de tráfico', category: 'Defensa Activa' }
  ] }));
  t.mock.method(Faq, 'find', async () => [
    { question: '¿Hay asistencia personalizada?', category: 'FAQ de equipo', keywords: 'asistencia', answer: 'Puedes solicitar asistencia en Contacto.' }
  ]);
  t.mock.method(Log, 'create', async entry => entry);
  const original = process.env.CHAT_AI_ENABLED;
  delete process.env.CHAT_AI_ENABLED;
  t.after(() => {
    if (original === undefined) delete process.env.CHAT_AI_ENABLED;
    else process.env.CHAT_AI_ENABLED = original;
  });

  const route = router.stack.find(layer => layer.route?.path === '/message' && layer.route.methods.post).route;
  const handler = route.stack.at(-1).handle;
  async function send(message, quickPhase, details = false) {
    let status = 200;
    let body;
    const response = {
      status(code) { status = code; return this; },
      json(value) { body = value; }
    };
    await handler({ body: { message, quickPhase, details } }, response, error => { throw error; });
    return { status, body };
  }

  const servicesTitle = 'Respuesta a Incidentes y Mitigación DDoS / Spam';
  let phase;
  for (const [message, nextPhase, expected] of [
    ['oleadas de peticiones tumban la web', 'trafico', /WAF/],
    ['tengo porblemas de bots', 'trafico', /mitigación DDoS/],
    ['dame una solucion', 'trafico', /activa la mitigación DDoS/],
    ['veo una cuenta que no conozco en el historial de sesiones', null, /conserva los registros/i],
    ['terceros se llevaron informacion de mis clientes', null, /exportar/i],
    ['¿Hay asistencia personalizada?', null, /solicitar asistencia/],
    ['¿Cuánto vale MongoDB Atlas?', null, /Permisos mínimos/],
    ['cual es el precio en uf?', null, /tarifas vigentes/]
  ]) {
    const { status, body } = await send(message, phase);
    assert.equal(status, 200, message);
    assert.equal(body.quickPhase, nextPhase, message);
    assert.match(body.reply, expected, message);
    if (nextPhase === 'trafico') {
      assert.deepEqual(body.recommendations, [{ title: servicesTitle, price: '61 UF' }]);
      assert.doesNotMatch(body.reply, /61 UF|¿/);
    }
    phase = body.quickPhase;
  }

  const catalog = await send('¿Qué servicios ofrecen y cuáles son sus tarifas?');
  assert.deepEqual(catalog.body.recommendations, [
    { title: 'Hardening MongoDB Atlas', price: '77 UF' },
    { title: servicesTitle, price: '61 UF' }
  ]);
  assert.doesNotMatch(catalog.body.reply, /77 UF|61 UF/);
  const single = await send('¿Cuánto vale MongoDB Atlas?');
  assert.deepEqual(single.body.recommendations, [{ title: 'Hardening MongoDB Atlas', price: '77 UF' }]);
  const custom = await send('¿Hay asistencia personalizada?');
  assert.equal(custom.body.recommendations, undefined);
  for (const [question, category, expected] of [
    ['¿Qué es el pentesting?', 'Pentesting', /prueba de seguridad autorizada/],
    ['que significa pentest', 'Pentesting', /prueba de seguridad autorizada/],
    ['¿Qué son las pruebas de penetración?', 'Pentesting', /prueba de seguridad autorizada/],
    ['para que sirve un pen-testing', 'Pentesting', /prueba de seguridad autorizada/],
    ['que es jwt', 'JWT', /firma y vigencia/],
    ['que es argon', 'Argon2id', /hash con sal/],
    ['que es argon2id', 'Argon2id', /hash con sal/],
    ['que es pipeline', 'Pipeline CI/CD', /automatiza/],
    ['que es mongodb', 'MongoDB', /documentos/],
    ['que es ddos', 'DDoS', /denegación de servicio/]
  ]) {
    const { body } = await send(question, 'trafico');
    assert.equal(body.matchedCategory, category, question);
    assert.match(body.reply, expected, question);
    assert.equal(body.recommendations, undefined);
  }
  const switched = await send('me preocupan las filtraciones de datos', 'trafico');
  assert.equal(switched.body.quickPhase, null);
  assert.equal(switched.body.matchedCategory, 'Protección de datos');
  const invalidPhase = await send('dame una solucion', { pending: 'trafico' });
  assert.equal(invalidPhase.body.quickPhase, null);
  assert.equal((await send('hola', null, true)).status, 503);
});
