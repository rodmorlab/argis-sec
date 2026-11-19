const { resolveFastAnswer, isPriceQuestion, serviceRows } = require('../../utils/fastans');
const { normalize } = require('./nlp/clasificador.cjs');
const { respond } = require('./nlp/bot.cjs');

const trafficCategories = new Set(['Rendimiento web', 'Respuesta a incidentes', 'Defensa Activa']);
const safetyCategories = new Set(['Cambios o accesos no reconocidos', 'Protección de datos']);
const categories = {
  trafico: 'Respuesta a incidentes',
  red: 'Ancho de banda',
  rendimiento: 'Rendimiento web',
  acceso: 'Cambios o accesos no reconocidos',
  datos: 'Protección de datos',
  despliegue: 'Problemas de despliegue',
  mongodb: 'Base de Datos NoSQL',
  auditoria: 'Auditoría Web y API',
  reserva: 'Reservas',
  contacto: 'Contacto y seguimiento',
  ayuda: 'Ayuda',
  fuera: 'Fuera de alcance'
};

function resolveQuickAnswer(message, faqs, services, phase) {
  const quick = resolveFastAnswer(message, faqs, services);
  const query = normalize(message);
  if (isPriceQuestion(message) || faqs.some(faq => normalize(faq.question) === query)) {
    return quick;
  }

  const result = respond(message, { services });
  if (safetyCategories.has(quick?.matchedCategory)) return quick;

  const botTraffic = /\b(?:ddos|bots|robots|trafico automatizado)\b/.test(query)
    || /\b(?:problemas?|ataque|trafico)\b.*\bbot\b/.test(query);
  const followup = phase === 'trafico' && /^(?:(?:y )?(?:dame (?:una |la )?solucion|como (?:lo |se )?(?:arreglo|resuelvo|mitigo)|que (?:servicio me sirve|me recomiendas))|todo el sitio|toda la web|(?:en )?la (?:madrugada|noche))$/.test(query);
  const traffic = followup || ((botTraffic || result.intent === 'trafico')
    && (!quick || trafficCategories.has(quick.matchedCategory)));
  if (traffic) {
    const service = services.find(item => /\bddos\b/.test(normalize(item.title)));
    return {
      reply: followup
        ? 'Aplica un límite de solicitudes en el WAF de la ruta más afectada. Si la saturación alcanza todo el sitio, activa la mitigación DDoS de tu proveedor. Después comprueba si bajan los errores 5xx y se recupera el tiempo de respuesta.'
        : 'Si los bots están saturando tu web, empieza con límites de solicitudes en el WAF para las rutas más afectadas. La mitigación DDoS ayuda a contener el tráfico abusivo y mantener el sitio disponible.',
      matchedCategory: 'Respuesta a incidentes',
      quickPhase: 'trafico',
      recommendations: serviceRows(service ? [service] : [])
    };
  }
  if (quick || !Object.hasOwn(categories, result.intent)) return quick;
  return { reply: result.reply, matchedCategory: categories[result.intent] };
}

module.exports = { resolveQuickAnswer };
