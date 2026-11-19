const { normalize, predict } = require('./clasificador.cjs');
const model = require('./modelo.json');

const answers = {
  red: 'Compara los Mbps de entrada y salida durante la lentitud con la cuota del plan. Si se acerca al límite, identifica qué ruta o archivo transfiere más datos. Si queda por debajo, revisa CPU y latencia de las consultas en ese mismo minuto.',
  rendimiento: 'Compara el tiempo de respuesta, las solicitudes por minuto y el uso de recursos entre el momento lento y una hora normal. Si la espera se concentra en una ruta, empieza por revisar esa petición.',
  acceso: 'Anota la hora y conserva los registros. Revisa qué cuenta abrió la sesión o cambió el dato y si reconoces el dispositivo. ¿Lo viste en tu PC, en el panel web o en los registros del servidor?',
  datos: 'Revisa qué cuentas pueden leer o exportar datos y conserva los registros de acceso. Si sospechas una exposición, identifica qué información pudo quedar accesible y qué cuenta intervino.',
  despliegue: 'Compara la última versión estable con la recién publicada. Busca el error de la ruta que falla y revisa cambios de configuración o dependencias. CI/CD puede ejecutar estas comprobaciones antes de publicar.',
  mongodb: 'El hardening de MongoDB Atlas ayuda a limitar permisos, revisar índices y validaciones, y planificar respaldos.',
  auditoria: 'La auditoría de seguridad web y API revisa controles de acceso, manejo de sesiones y debilidades de la aplicación. El alcance se confirma con el equipo.',
  reserva: 'Inicia sesión y abre «Mis Solicitudes». Ahí puedes reservar indicando una fecha preferida o consultar si tu solicitud fue aprobada.',
  contacto: 'Usa «Contacto & SMTP» para escribir al equipo. Si ya enviaste el formulario, revisa la dirección y la carpeta de spam.',
  ayuda: 'Soy AegisBot. Puedes preguntarme por servicios, tarifas, reservas, contacto o por un problema técnico en tu sitio.',
  fuera: 'Puedo orientarte sobre los servicios de AegisSec y problemas de seguridad o rendimiento web.',
  desconocido: '¿Te refieres a un problema técnico, a un servicio del catálogo o a una reserva? Cuéntame un poco más.'
};

function trafficFollowup(text, state) {
  const query = normalize(text);
  if (state.pending === 'alcance' && /^(?:se cae )?(?:todo el sitio|toda la web|solo (?:una |la )?(?:ruta|pagina|portada))$/.test(query)) {
    return {
      reply: 'Anotado. ¿A qué hora suele ocurrir? Eso permite comparar los registros del servidor con el pico.',
      state: { ...state, scope: text, pending: 'horario' }
    };
  }
  if (state.pending === 'horario' && /\b(?:madrugada|noche|manana|tarde|mediodia|\d{1,2}\s\d{2})\b/.test(query)) {
    return {
      reply: 'Revisa los registros de acceso y los errores 5xx en esa franja. ¿En los registros suben las solicitudes o el salto aparece solo en el gráfico de visitas?',
      state: { ...state, time: text, pending: 'evidencia' }
    };
  }
  if (state.pending === 'evidencia' && /\b(?:grafico|grafica|analitica|registros|solicitudes)\b/.test(query)) {
    return {
      reply: 'Ya tenemos una señal para comparar. Si aumentan las solicitudes del servidor, identifica qué rutas concentran el tráfico. Si solo sube el gráfico, revisa cómo la analítica contabiliza visitas antes de atribuirlo a un ataque.',
      state: { ...state, evidence: text, pending: null }
    };
  }
  return null;
}

function startTraffic() {
  return {
    intent: 'trafico',
    reply: 'Muchas solicitudes junto con una caída pueden indicar saturación. Compara solicitudes por minuto y errores 5xx durante el episodio. ¿Se cae todo el sitio o una sola página?',
    state: { intent: 'trafico', pending: 'alcance' }
  };
}

function respond(text, { state = {}, services = [] } = {}) {
  const classification = predict(text, model);
  const intent = classification.intent;
  const canContinue = intent === state.intent || ['desconocido', 'ayuda'].includes(intent);
  if (state.intent === 'trafico' && state.pending && canContinue) {
    const followup = trafficFollowup(text, state);
    if (followup) return { ...followup, intent: 'trafico' };
  }

  if (intent === 'trafico') return startTraffic();
  if (intent === 'precios') {
    const reply = services.length
      ? services.map(({ title, price }) => `${title}: ${price}`).join(' · ')
      : 'Consulta el catálogo de AegisSec para ver las tarifas vigentes. Este prototipo necesita que le pases el catálogo para mostrar precios.';
    return { intent, reply, state: { intent } };
  }
  return { intent, reply: answers[intent], state: { intent } };
}

module.exports = { respond, startTraffic };
