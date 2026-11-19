const dialogueGuide = require('./detailDialogue');
const { diagnosticCheck } = require('./detailDiagnostics');
const { resolveFastAnswer, catalogAnswer, serviceRows } = require('../../utils/fastans');

class DetailUnavailable extends Error {}
const unavailableMessage = 'esta funcion no se encuentra disponible en estos momentos';

function detailsMode() {
  return process.env.CHAT_AI_ENABLED === 'true' ? 'ai' : 'off';
}

async function requestCompletion(messages, options, signal) {
  const { CHAT_AI_URL, CHAT_AI_MODEL, CHAT_AI_KEY } = process.env;
  const response = await fetch(CHAT_AI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(CHAT_AI_KEY ? { Authorization: `Bearer ${CHAT_AI_KEY}` } : {})
    },
    body: JSON.stringify({
      ...(CHAT_AI_MODEL ? { model: CHAT_AI_MODEL } : {}),
      messages,
      temperature: 0,
      chat_template_kwargs: { enable_thinking: false },
      ...options
    }),
    signal,
    redirect: 'error'
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const choice = payload.choices?.[0];
  const text = choice?.message?.content?.trim();
  if (!text) throw new Error('Respuesta vacía');
  return { text, finishReason: choice.finish_reason };
}

function conversationOpening(question) {
  const text = question.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, '').trim();
  if (/^(?:hola|buenas|buenos dias|buenas tardes|buenas noches)$/.test(text)) {
    return '¡Hola! Cuéntame, ¿en qué te puedo ayudar?';
  }
  if (/^(?:quien eres|que eres|como te llamas)$/.test(text)) {
    return 'Soy AegisBot, el asistente de AegisSec. Si me cuentas qué pasa con tu sitio o tu aplicación, puedo ayudarte a decidir qué revisar primero.';
  }
  if (/^(?:como funcionas|como trabajas|que puedes hacer)$/.test(text)) {
    return 'Leo tu consulta y, si hace falta, te pido un dato para entenderla mejor. Si un servicio encaja, puedo explicarte por qué.';
  }
  if (/^(?:me puedes ayudar(?: con una consulta)?|puedes ayudarme|tengo un problema|tengo una consulta|tengo una duda)$/.test(text)) {
    return 'Claro, cuéntame qué pasó. ¿Qué fue lo primero que notaste?';
  }
  if (!text || text.length < 5) {
    return 'No entendí bien ese mensaje. ¿Me cuentas un poco más?';
  }
  return null;
}

function historyMessages(history) {
  const turns = [];
  const configured = Number(process.env.CHAT_AI_HISTORY_BYTES || 1200);
  let remaining = Number.isFinite(configured) ? Math.max(0, Math.min(configured, 6500)) : 1200;
  for (const turn of history.slice(-30).reverse()) {
    if (typeof turn?.user !== 'string' || typeof turn?.assistant !== 'string') continue;
    const user = turn.user.trim().slice(0, 180);
    const assistant = turn.assistant.trim().slice(0, 480);
    if (!user || !assistant) continue;
    remaining -= Buffer.byteLength(user) + Buffer.byteLength(assistant) + 32;
    if (remaining < 0) break;
    turns.unshift({ role: 'user', content: user }, { role: 'assistant', content: assistant });
  }
  return turns;
}

async function askModel(question, services, history) {
  const opening = conversationOpening(question);
  if (opening && !(history.length && /^[¿?\s]*(?:qu[eé])?[¿?\s]*$/i.test(question))) return opening;
  if (!process.env.CHAT_AI_URL) throw new DetailUnavailable(unavailableMessage);
  const signal = AbortSignal.timeout(25000);
  const prior = historyMessages(history);
  const previousQuestion = prior.at(-2)?.content;
  const user = { role: 'user', content: question };
  const labels = ['tarifario', 'contacto', 'pipeline', 'incidentes', 'auditoria', 'mongodb', 'general', 'otro'];
  const classifier = [
    'Clasifica el mensaje actual. Usa el anterior para entender referencias.',
    'tarifario = pide lista de precios o servicios; contacto = cambios inesperados o posible acceso sin permiso;',
    'pipeline = fallos al desplegar; incidentes = caídas por tráfico o bots;',
    'auditoria = evaluación de seguridad web; mongodb = permisos o configuración de la base de datos;',
    'general = saludo o ayuda del portal; otro = consulta ajena. Devuelve solo la categoría.'
  ].join(' ');
  const catalogMatch = {
    pipeline: /devsecops|ci\/cd/i,
    incidentes: /ddos|incidentes/i,
    auditoria: /pentesting|owasp/i,
    mongodb: /mongodb|hardening/i
  };

  try {
    const asksForCatalog = /\b(?:precios?|tarifas?|costos?|cat[aá]logo|cu[aá]nto (?:cuesta|vale|sale)|lista de (?:servicios|productos)|qu[eé] servicios (?:existen|ofrecen|tienen))\b/i.test(question);
    if (asksForCatalog) {
      return resolveFastAnswer(question, [], services) || catalogAnswer(services);
    }
    const asksForService = /\b(?:servicios?|contratar|cotizar|ofrecen|ofreces)\b/i.test(question);
    const userTurns = [...prior.filter(({ role }) => role === 'user').map(({ content }) => content), question];
    const conversation = userTurns.join(' ');
    const chartConfirmed = userTurns.some(turn => /\b(?:salto|pico|subida|ampl[ií]a|sube|aumenta)\b/i.test(turn)
      && /\b(?:gr[aá]fic[oa]|anal[ií]tica)\b/i.test(turn));
    const overnight = /\b(?:madrugada|noche)\b/i.test(conversation);
    const sitewide = /\b(?:todo el sitio|toda la web|toda la p[aá]gina)\b/i.test(conversation);
    const correction = /\b(?:ya te dije|te dije que s[ií]|pero si te dije)\b/i.test(question);
    const mentionsTraffic = /\b(?:bots?|robots?|tr[aá]fico|peticiones masivas|conexiones al mismo tiempo|muchas conexiones|se llena de gente)\b/i.test(conversation);
    const mentionsOutage = /\b(?:tumban|tumba|ca[eí]|ca[ií]das?|se cae|colapsa|crashea|deja de responder|no carga|lent[oa]|lentitud|no puede funcionar con normalidad)\b/i.test(conversation);
    const trafficOutage = mentionsTraffic && mentionsOutage;
    const unresponsive = /\b(?:deja de responder|no responde|crashea|colapsa|se cae)\b/i.test(question);
    const incident = trafficOutage ? services.find(({ title }) => catalogMatch.incidentes.test(title)) : undefined;
    const incidentAlreadyOffered = incident && prior.some(({ role, content }) =>
      role === 'assistant' && content.includes(incident.title));
    if (trafficOutage && unresponsive && !asksForService) {
      const nextStep = 'Si la web deja de responder, revisa qué pasó durante el pico: solicitudes por minuto, errores 5xx y si el proceso se reinició. Si suben las solicitudes y el servidor se satura, puedes aplicar límites de solicitudes en el WAF a las rutas afectadas.';
      return incident && !incidentAlreadyOffered
        ? { reply: nextStep, recommendations: serviceRows([incident]) }
        : nextStep;
    }
    if (incident && !incidentAlreadyOffered && !asksForService && !chartConfirmed
      && /\b(?:bots?|robots?|muchas conexiones|tr[aá]fico|peticiones masivas)\b/i.test(question)) {
      return {
        reply: 'Muchos bots o conexiones junto con lentitud pueden indicar saturación o un posible DDoS. Revisa si las solicitudes por minuto y los errores 5xx suben a la vez.',
        recommendations: serviceRows([incident])
      };
    }
    const concurrentTraffic = /\b(?:al mismo tiempo|simult[aá]ne[oa]s?|mucha gente conectad[oa])\b/i.test(question);
    if (asksForService && trafficOutage) {
      if (incident) {
        return {
          reply: 'Este servicio revisa si el tráfico está saturando tu web y contempla límites de solicitudes y WAF.',
          recommendations: serviceRows([incident])
        };
      }
    }
    let intent;
    if (asksForService) {
      const useGrammar = process.env.CHAT_AI_FORMAT !== 'json_schema';
      const format = useGrammar
        ? { grammar: `root ::= ${labels.map(label => JSON.stringify(label)).join(' | ')}` }
        : { response_format: { type: 'json_schema', json_schema: { name: 'aegis_intent', schema: {
          type: 'object',
          properties: { intent: { type: 'string', enum: labels } },
          required: ['intent'],
          additionalProperties: false
        } } } };
      const classification = await requestCompletion([{ role: 'system', content: classifier }, ...prior, user],
        { ...format, max_tokens: 32 }, signal);
      intent = useGrammar ? classification.text : JSON.parse(classification.text).intent;
      if (!labels.includes(intent)) throw new Error('Intención inválida');

    }
    const selected = asksForService && services.find(({ title }) => catalogMatch[intent]?.test(title));
    const diagnostic = diagnosticCheck(userTurns);
    const context = [
      dialogueGuide,
      diagnostic?.instruction || '',
      'Propón una comprobación concreta. Evita repetir el mensaje del usuario o texto literal de un ejemplo. No inventes causas ni precios.',
      trafficOutage ? 'Describe un siguiente paso para investigar la caída. No sugieras cambiar de puerto, revisar permisos ni confirmar un ataque con solo el pico.' : '',
      concurrentTraffic ? 'El usuario ya describió mucha actividad simultánea. Avanza a comprobar qué recurso se saturó. No vuelvas a preguntar si subió el tráfico.' : '',
      intent === 'contacto' && !trafficOutage ? 'Ante cambios inesperados, sugiere revisar el historial de cambios y las sesiones del panel.' : '',
      selected ? `Servicio relacionado: ${selected.title}. ${selected.description}` : ''
    ].join('\n');
    const evidence = userTurns.slice(0, -1).map(turn => `- ${turn}`).join('\n');
    const input = evidence
      ? { role: 'user', content: `Observaciones anteriores del visitante:\n${evidence}\nConsulta actual: ${question}` }
      : user;
    const answer = await requestCompletion([{ role: 'system', content: context }, input],
      { max_tokens: 220, temperature: 0.45, top_p: 1, top_k: 20, min_p: 0, presence_penalty: 0.8 }, signal);
    const handlingUserData = /\b(?:datos|informaci[oó]n)\b/i.test(`${previousQuestion || ''} ${question}`)
      && /\b(?:usuarios|clientes|personales)\b/i.test(`${previousQuestion || ''} ${question}`);
    const mentionsExposure = /\b(?:robar|roban|rob[oó]|robo|filtraci[oó]n|filtran|exposici[oó]n|sin permiso)\b/i.test(question);
    const reversedVoice = /\b(?:mis (?:usuarios|clientes|datos)|mi (?:sitio|aplicaci[oó]n)|c[oó]mo puedo (?:proteger|solucionar|mantener|asegurar))\b/i.test(answer.text);
    const copiedExample = dialogueGuide.split('Asistente: ').slice(1)
      .some(example => example.split('\n', 1)[0].trim() === answer.text);
    const repeatedReply = prior.some(turn => turn.role === 'assistant' && turn.content === answer.text);
    const unusable = copiedExample || repeatedReply || answer.text.length < 12 || reversedVoice || answer.finishReason === 'length'
      || /prop[oó]n una comprobaci[oó]n|no inventes causas|^(anterior|actual|usuario|asistente):/i.test(answer.text);
    let explanation = answer.text;
    const irrelevantTrafficAnswer = !/\b(?:solicitudes|tr[aá]fico|registros|m[eé]tricas|errores|picos)\b/i.test(answer.text)
      || /\b(?:datos de tus clientes|datos de tus usuarios)\b/i.test(answer.text);
    if (trafficOutage && chartConfirmed) {
      if (correction || /^[¿?\s]*(?:qu[eé])?[¿?\s]*$/i.test(question)) {
        explanation = 'Ya me dijiste que viste un salto en el gráfico. Lo que queda por comprobar es si el servidor también recibió más solicitudes. Si los registros se mantienen estables, revisa cómo la herramienta de analítica está contando esas visitas.';
      } else if (/\b(?:conexiones|solicitudes)\b/i.test(question) && concurrentTraffic) {
        explanation = 'Si las conexiones simultáneas suben junto con la lentitud, revisa qué rutas concentran el tráfico y si muchas solicitudes se repiten con el mismo patrón. Eso ayuda a distinguir actividad automatizada de un pico real de visitas.';
      } else {
        explanation = `Revisa los registros de acceso y los errores 5xx en el minuto exacto del pico${overnight ? ' nocturno' : ''}. Si también subieron las solicitudes, identifica qué rutas recibieron más tráfico. Si los registros se mantienen estables, revisa cómo tu herramienta de analítica cuenta las visitas.`;
      }
    } else if (trafficOutage && overnight && concurrentTraffic) {
      explanation = 'Durante el próximo episodio nocturno, compara las conexiones por minuto con el tiempo de respuesta y los errores del servidor. Si suben juntos, revisa qué rutas concentran las solicitudes antes de concluir que son bots.';
    } else if (trafficOutage && overnight) {
      explanation = `${sitewide ? 'Como se cae todo el sitio, ' : ''}revisa los registros de acceso y los errores del servidor en la franja nocturna. ¿Tienes la hora aproximada de una caída para cruzarla con el gráfico?`.replace(/^revisa/, 'Revisa');
    } else if (trafficOutage && sitewide) {
      explanation = 'Como se cae todo el sitio, revisa si el servidor muestra errores o saturación en ese momento. ¿Suele pasar a una hora concreta?';
    } else if (trafficOutage && concurrentTraffic) {
      explanation = 'Durante el próximo pico, mira el tiempo de respuesta, el uso de CPU y las conexiones de la base de datos. Si una de esas métricas se dispara, tendrás un primer punto para investigar la saturación.';
    } else if (trafficOutage && (unusable || irrelevantTrafficAnswer || /cambiar el (?:servidor|puerto)|permisos de acceso/i.test(answer.text))) {
      explanation = 'Empieza por revisar si la caída coincide con un aumento de solicitudes y errores del servidor. ¿La web deja de responder por completo o muestra un mensaje de error?';
    } else if (handlingUserData && mentionsExposure) {
      explanation = 'Si sospechas que alguien obtuvo datos de tus usuarios, conserva los registros y revisa qué cuentas accedieron a ellos. Si identificas una cuenta o clave comprometida, revoca sus sesiones o rota la clave. ¿Qué señal viste: accesos desconocidos, registros exportados o datos publicados?';
    } else if (unusable) {
      explanation = handlingUserData
        ? '¿Dónde guardas los datos de tus usuarios y quién puede verlos o exportarlos?'
        : 'Para orientarte, dime qué cambió justo antes de que apareciera el problema y si puedes reproducirlo.';
    }
    if (diagnostic && (unusable || !diagnostic.isUseful(explanation))) {
      explanation = prior.at(-1)?.content === diagnostic.fallback && diagnostic.followup
        ? diagnostic.followup
        : diagnostic.fallback;
    }
    return selected ? { reply: explanation, recommendations: serviceRows([selected]) } : explanation;
  } catch {
    throw new DetailUnavailable(unavailableMessage);
  }
}

module.exports = { historyMessages, askModel, detailsMode, DetailUnavailable, unavailableMessage };
