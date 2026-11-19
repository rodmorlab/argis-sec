const synonymGroups = [
  ['precio', 'cuanto cuesta', 'cuanto sale', 'tarifa', 'que cobran', 'cotizacion', 'cotizar', 'uf'],
  ['servicios', 'catalogo', 'que ofrecen'],
  ['ejecutivo', 'persona', 'asesor', 'humano', 'hablar con alguien', 'hablar con una persona', 'contactar al equipo'],
  ['contrasena', 'credenciales', 'clave', 'argon2', 'argon2id'],
  ['jwt', 'token', 'sesion', 'sesiones', 'login'],
  ['pipeline', 'automatizacion', 'github actions', 'ci cd'],
  ['codeql', 'zap', 'snyk', 'escaneo', 'auditoria'],
  ['ddos', 'spam', 'incidente', 'incidentes', 'waf', 'mitigacion', 'respuesta a incidentes'],
  ['mongodb', 'atlas', 'nosql', 'hardening'],
  ['pentesting', 'pentest', 'owasp', 'api rest', 'auditoria de api', 'pentesting de api']
];

const glossary = [
  {
    aliases: [
      'pentesting', 'pentest', 'pen testing', 'pentesting web', 'pentest web',
      'prueba de penetracion', 'pruebas de penetracion', 'test de penetracion'
    ],
    title: 'Pentesting',
    reply: 'El pentesting es una prueba de seguridad autorizada que simula ataques controlados para identificar debilidades y evaluar su impacto. En AegisSec puede cubrir sitios web y API, y concluye con un informe de hallazgos y recomendaciones.'
  },
  {
    aliases: ['jwt', 'json web token'],
    title: 'JWT',
    reply: 'Un JWT es un token que la aplicación emite al iniciar sesión. El navegador lo envía al solicitar acceso y el servidor verifica su firma y vigencia. La firma protege contra cambios, pero el contenido normalmente se puede leer.'
  },
  {
    aliases: ['argon', 'argon2', 'argon2id', 'argon 2 id'],
    title: 'Argon2id',
    reply: 'Argon2id convierte una contraseña en un hash con sal. Al iniciar sesión, el servidor comprueba la contraseña introducida contra ese hash. El costo de memoria y cálculo dificulta probar muchas contraseñas.'
  },
  {
    aliases: ['pipeline', 'pipeline ci cd', 'ci cd', 'pipeline devsecops'],
    title: 'Pipeline CI/CD',
    reply: 'Un pipeline de CI/CD automatiza pasos como instalar dependencias, ejecutar pruebas y publicar una versión. En este proyecto, GitHub Actions también revisa el código y sus dependencias antes del despliegue.'
  },
  {
    aliases: ['mongodb', 'mongo db', 'mongodb atlas', 'mongo'],
    title: 'MongoDB',
    reply: 'MongoDB es una base de datos que guarda documentos agrupados en colecciones. AegisSec la usa para el catálogo, las reservas y las preguntas frecuentes. MongoDB Atlas es el servicio administrado para alojarla.'
  },
  {
    aliases: ['ddos', 'ataque ddos', 'denegacion de servicio distribuida'],
    title: 'DDoS',
    reply: 'DDoS significa denegación de servicio distribuida. Muchas fuentes envían tráfico a la vez para agotar los recursos de un sitio y dificultar el acceso legítimo. Si sospechas uno, compara el aumento de solicitudes con los errores y las caídas del servidor.'
  },
  {
    aliases: ['waf', 'firewall web'],
    title: 'WAF',
    reply: 'Un WAF filtra las solicitudes HTTP antes de que lleguen a la aplicación. Puede bloquear patrones abusivos o limitar muchas solicitudes seguidas a una ruta. Su configuración depende del tráfico normal de tu sitio.'
  },
  {
    aliases: ['rbac', 'roles', 'control de acceso por roles'],
    title: 'RBAC',
    reply: 'RBAC asigna permisos según roles. Por ejemplo, en AegisSec un usuario registrado puede consultar sus propias reservas, mientras que la gestión del catálogo requiere permisos de administración.'
  }
];

function glossaryAnswer(query) {
  const definition = /^(?:que (?:es|son|significa)|como funciona|para que sirve) (?:(?:un|una|el|la|los|las) )?(.+)$/.exec(query);
  const topic = glossary.find(({ aliases }) => aliases.includes(definition?.[1] || query));
  // «DDoS» a secas sigue siendo un acceso rápido al servicio de mitigación.
  if (!topic || (!definition && topic.title === 'DDoS')) return null;
  return { matchedCategory: topic.title, reply: topic.reply };
}

const generalAnswers = [
  {
    category: 'Cambios o accesos no reconocidos',
    examples: /\b(?:accesos? (?:sospechosos?|no reconocidos?|no autorizados?)|sesion (?:desconocida|que no reconozco)|(?:alguien|gente|extranos?) (?:mas )?(?:entro|entrando|accede|accedio|se metio)|cambios? (?:no reconocidos?|sin permiso)|modifica (?:los )?datos de contacto)\b/,
    reply: 'Si ves un acceso o cambio que no reconoces, conserva los registros y anota la hora. En el panel, revisa qué cuenta inició sesión o guardó el cambio. Si detectas una sesión o credencial comprometida, revócala. Si te preocupa el acceso a un equipo en lugar del panel, contacta a quien administra ese equipo.'
  },
  {
    category: 'Protección de datos',
    examples: /\b(?:filtraciones? de datos|robo de datos|datos (?:filtrados|expuestos)|(?:robar|roban) (?:esos |los )?datos|(?:proteger|asegurar|mantener seguros) (?:los |mis )?datos|(?:datos de (?:clientes|usuarios)|datos personales).{0,45}(?:segur[oa]s?|filtracion|robo))\b/,
    reply: 'Empieza por revisar quién puede leer o exportar datos y limita esos permisos. Si sospechas una filtración, conserva los registros de acceso y exportación y revisa qué cuenta intervino. El formulario de contacto permite solicitar una revisión del caso sin adjuntar datos de clientes.'
  },
  {
    category: 'Ancho de banda',
    examples: /\b(?:ancho de banda|cuota de red|limite de red|mbps)\b/,
    reply: 'Durante la lentitud, compara los Mbps de entrada y salida con el límite del hosting. Si llegas al límite, revisa qué rutas o archivos transfieren más datos. Si el uso queda por debajo, mira el tiempo de respuesta, la CPU y las consultas a la base en el mismo minuto.'
  },
  {
    category: 'Rendimiento web',
    examples: /\b(?:lent[oa]|lentitud|demora|tarda|se cae|crashea|no responde)\b.*\b(?:mucha gente|muchos usuarios|muchas conexiones|al mismo tiempo|pico de trafico)\b|\b(?:mucha gente|muchos usuarios|muchas conexiones|al mismo tiempo|pico de trafico)\b.*\b(?:lent[oa]|lentitud|demora|tarda|se cae|crashea|no responde)\b/,
    reply: 'Compara una hora normal con el momento del problema: tiempo de respuesta, solicitudes por minuto y errores 5xx. Si una ruta concentra la lentitud, empieza por esa petición. Un pico de usuarios por sí solo no confirma actividad de bots.'
  },
  {
    category: 'Problemas de despliegue',
    examples: /\b(?:despues de (?:publicar|actualizar|desplegar)|tras (?:una actualizacion|publicar|desplegar)|desde la ultima version)\b.*\b(?:falla|error|rompe|deja de funcionar|no funciona|se cae)\b|\b(?:falla|error|rompe|deja de funcionar|no funciona|se cae)\b.*\b(?:despues de (?:publicar|actualizar|desplegar)|tras (?:una actualizacion|publicar|desplegar)|desde la ultima version)\b/,
    reply: 'Compara el último despliegue que funcionó con el actual. Empieza por los registros de la ruta que falla y revisa si cambió la configuración o una dependencia. AegisSec ofrece implementación de CI/CD para automatizar pruebas antes de publicar.'
  },
  {
    category: 'Contacto y seguimiento',
    examples: /\b(?:formulario de contacto|contactar (?:al|con el) equipo|no (?:me )?llega (?:el correo|la confirmacion)|con quien hablo|hablar con (?:una persona|un ejecutivo|alguien))\b/,
    reply: 'Ve a «Contacto & SMTP» y envía tu consulta al equipo. Si ya enviaste el formulario y no ves el correo de confirmación, comprueba la dirección y la carpeta de spam. No incluyas contraseñas ni datos de clientes.'
  },
  {
    category: 'Estado de la reserva',
    examples: /\b(?:estado de (?:mi|la) (?:reserva|solicitud)|(?:aprobaron|aceptaron) mi (?:reserva|solicitud)|ver mis (?:reservas|solicitudes)|mi reserva esta pendiente)\b/,
    reply: 'Inicia sesión y abre «Mis Solicitudes» para consultar el estado de tu reserva. Una fecha solicitada sigue sujeta a revisión hasta que el equipo la apruebe.'
  },
  {
    category: 'API REST',
    examples: /^(?:(?:que es|que significa|como funciona|para que sirve) (?:la |una )?)?(?:api(?: rest)?|rest)$/,
    reply: 'Una API permite que dos programas se comuniquen. Una API REST organiza esa comunicación en recursos y operaciones HTTP. En AegisSec, la página usa la API para consultar el catálogo, iniciar sesión y enviar mensajes al chatbot.'
  },
  {
    category: 'Público objetivo',
    examples: /^(?:empresas|(?:a quien|a quienes) va dirigid[oa](?: el (?:portal|servicio))?|para quien es(?: el (?:portal|servicio))?|a que empresas (?:atienden|se dirige))$/,
    reply: 'AegisSec está dirigido a empresas y equipos técnicos que necesitan evaluar la seguridad de sus aplicaciones, proteger sus bases de datos o mejorar sus despliegues. Por ejemplo, equipos de tecnología, líderes de seguridad y clientes que buscan una auditoría.'
  },
  {
    category: 'Aclaración',
    examples: /^(?:respuesta|gestion)$/,
    reply: '¿Te refieres a respuesta a incidentes, a la gestión de reservas o a la administración de MongoDB? Dime cuál y te cuento.'
  },
  {
    category: 'Aclaración',
    examples: /^(?:que|que es|como|como funciona|cuanto|cual)$/,
    reply: '¿Sobre qué tema quieres saber más? Puedes preguntar por un servicio, sus precios, cómo reservar o qué significa un término como SMTP.'
  },
  {
    category: 'Correo SMTP',
    examples: /^(?:(?:que es|que significa|para que sirve|como funciona) )?smtp$|^como (?:funciona|se envia) (?:el correo|la confirmacion)$/,
    reply: 'SMTP es el protocolo que se usa para enviar correos. En AegisSec, el formulario de contacto usa Nodemailer para enviar tu consulta al buzón institucional y una confirmación a tu correo cuando el envío está configurado.'
  },
  {
    category: 'Hardening',
    examples: /^(?:que es|que significa|para que sirve) (?:el )?hardening(?: de mongodb(?: atlas)?)?$/,
    reply: 'Hardening significa reforzar la seguridad de un sistema reduciendo su exposición. En MongoDB Atlas incluye limitar permisos, revisar la configuración y validar los datos. Si quieres el valor del servicio, pregunta «¿Cuánto cuesta el hardening de MongoDB Atlas?».'
  },
  {
    category: 'Bienvenida',
    examples: /^(?:(?:hola|buenas|buenos dias|buenas tardes|buenas noches)(?: aegisbot| bot)?|hey|holi)$/,
    reply: '¡Hola! Soy AegisBot. Puedo orientarte sobre servicios, precios en UF, reservas y cómo contactar a un ejecutivo.'
  },
  {
    category: 'Ayuda',
    examples: /^(?:y )?(?:que (?:te )?puedo preguntar|que (?:puedes|sabes) responder|que (?:mas )?puedes hacer|como me puedes ayudar|en que me puedes ayudar|que sabes|sabes|preguntas|preguntas frecuentes|ayuda)(?: aqui| en el chat)?$/,
    reply: 'Puedes preguntar «¿Cuánto cuesta MongoDB Atlas?», «¿Qué incluye el pentesting?», «¿Cómo reservo?» o «¿Cómo hablo con un ejecutivo?».'
  },
  {
    category: 'Sobre AegisBot',
    examples: /^(?:y )?(?:que eres|quien eres|como te llamas|que es aegisbot|eres (?:una?|inteligencia) (?:ia|bot|chatbot|artificial)|eres (?:ia|inteligencia artificial))$/,
    reply: 'Soy AegisBot, el asistente de AegisSec Enterprise. Uso el catálogo y las preguntas frecuentes para orientarte sobre los servicios y cómo solicitarlos.'
  },
  {
    category: 'Sobre AegisSec',
    examples: /^(?:y )?(?:que es aegis(?:sec)?(?: enterprise)?|que hace aegis(?:sec)?(?: enterprise)?|quienes son|a que se dedican)$/,
    reply: 'AegisSec Enterprise es un portal de consultoría en ciberseguridad. Ofrece auditorías web y API, implementación de CI/CD seguro, hardening de MongoDB Atlas y apoyo ante incidentes.'
  },
  {
    category: 'Tecnologías de la plataforma',
    examples: /\b(?:librerias|bibliotecas|dependencias|stack|tecnologias)\b/,
    reply: 'La página usa HTML, CSS y JavaScript. El backend usa Node.js con Express, MongoDB con Mongoose, Argon2id para contraseñas, JSON Web Tokens para sesiones y Nodemailer para correo. GitHub Actions ejecuta las pruebas y controles como CodeQL y npm audit.'
  },
  {
    category: 'Reservas',
    examples: /\b(?:como (?:reservo|agendo|solicito)|(?:hacer|crear|solicitar) una reserva|pedir hora)\b/,
    reply: 'Inicia sesión, abre «Mis Solicitudes» y envía una solicitud con el servicio y tu fecha preferida. El equipo la revisará antes de aprobarla.'
  }
];

function normalize(value) {
  return String(value ?? '').toLowerCase().normalize('NFD')
    .replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function contains(text, phrase) {
  return phrase && ` ${text} `.includes(` ${phrase} `);
}

function rank(query, phrases) {
  const terms = phrases.map(normalize).filter(Boolean);
  const exact = terms.filter(term => contains(query, term)).length;
  const related = synonymGroups.filter(group =>
    group.some(term => terms.includes(term)) && group.some(term => contains(query, term))
  ).length;
  return exact * 3 + related;
}

function bestMatch(items, score) {
  return items.reduce((best, item) => {
    const points = score(item);
    return points > best.points ? { item, points } : best;
  }, { item: null, points: 0 }).item;
}

function isPriceQuestion(message) {
  const query = normalize(message);
  return /\b(?:precios?|tarifas?|costos?|cotizar|cotizacion|uf)\b/.test(query)
    || /\b(?:cuanto (?:cuestan?|salen?|valen?|cobran)|que cobran)\b/.test(query);
}

function asksForCatalog(query) {
  return /^(?:y )?(?:lista|listado|catalogo) de (?:los )?(?:productos|servicios)(?: por favor)?$/.test(query)
    || /^(?:y )?(?:(?:que|cuales) servicios (?:existen|tienen|ofrecen|ofreces|hay)|que venden|cuales son los servicios)$/.test(query);
}

function describesBotTraffic(query) {
  const traffic = /\b(?:bots?|trafico automatizado|peticiones masivas|solicitudes masivas|spam)\b/;
  const problem = /\b(?:tumban|tumba|cae|caidas?|saturan?|colapsa|deja de responder|no carga|ataque|spam|lent[oa]|crashea|no responde|saturacion)\b/;
  return traffic.test(query) && problem.test(query);
}

function serviceRows(services) {
  return services.map(({ title, price }) => ({ title, price }));
}

function catalogAnswer(services) {
  const usesUf = services.length && services.every(({ price }) => /\bUF\b/i.test(price));
  return {
    matchedCategory: 'Servicios y Precios',
    reply: services.length
      ? (usesUf ? 'Estas son las tarifas vigentes en UF.' : 'Estas son las tarifas vigentes del catálogo.')
      : 'El catálogo no tiene servicios publicados en este momento.',
    recommendations: serviceRows(services)
  };
}

function resolveFastAnswer(message, faqs, services, details = false) {
  const query = normalize(message);
  if (asksForCatalog(query)) return catalogAnswer(services);
  const exactQuestion = faqs.find(faq => normalize(faq.question) === query);
  const askingPrice = isPriceQuestion(message);
  if (!askingPrice && exactQuestion) {
    return { matchedCategory: exactQuestion.category, reply: exactQuestion.answer };
  }
  const definition = !askingPrice && glossaryAnswer(query);
  if (definition) return definition;
  if (!askingPrice && describesBotTraffic(query)) {
    const incidentService = services.find(({ title }) => /\bddos\b/.test(normalize(title)));
    return {
      matchedCategory: 'Respuesta a incidentes',
      recommendations: serviceRows(incidentService ? [incidentService] : []),
      reply: incidentService
        ? 'Si tu web deja de responder cuando llegan muchas solicitudes de bots, revisa si ese tráfico está saturando el sitio. El servicio recomendado incluye limitación de solicitudes y WAF.'
        : 'Si el sitio se cae cuando llegan bots, conviene revisar el tráfico y qué rutas se saturan. Puedes escribirnos por Contacto & SMTP para que el equipo evalúe el caso.'
    };
  }
  const general = generalAnswers.find(({ examples, category }) => examples.test(query)
    || (!query && /^[¿?¡!.,…\s]+$/.test(message) && category === 'Aclaración'));
  if (!askingPrice && general) {
    return { matchedCategory: general.category, reply: general.reply };
  }
  const faq = exactQuestion || bestMatch(faqs, item => rank(query, String(item.keywords || '').split(',')));
  const service = (details || askingPrice || !faq) && bestMatch(services, item => {
    const title = normalize(item.title);
    const signals = synonymGroups.slice(5).flat().filter(term => contains(title, term));
    return (contains(query, title) ? 20 : 0) + rank(query, signals);
  });

  if (service) {
    return {
      matchedCategory: service.category,
      reply: service.description || 'Encontré este servicio en el catálogo.',
      recommendations: serviceRows([service])
    };
  }
  if (askingPrice) {
    if (!services.length) {
      return { matchedCategory: 'Servicios y Precios', reply: 'El catálogo no tiene servicios publicados en este momento.' };
    }
    const generalPricing = /^(?:(?:y|hola) )?(?:(?:cual(?:es)?|cuanto|que) (?:son |es |tienen )?(?:(?:los|las|el|la) )?)?(?:precios?|tarifas?|costos?)(?: en uf)?(?: a que servicio)?$/.test(query)
      || /^(?:cuanto (?:cuesta|sale|vale)|que cobran|cotizar)$/.test(query)
      || /\b(?:servicios?|productos?|catalogo|lista de precios|ofrecen|ofreces|venden)\b/.test(query)
      || exactQuestion?.category === 'Servicios y Precios';
    if (generalPricing) return catalogAnswer(services);
    return {
      matchedCategory: 'Aclaración',
      reply: '¿De qué servicio quieres el precio? Puedes escribir su nombre o pedir la lista de precios.'
    };
  }
  return faq && { matchedCategory: faq.category, reply: faq.answer };
}

module.exports = { resolveFastAnswer, isPriceQuestion, catalogAnswer, serviceRows };
