// Las comprobaciones se activan por observaciones del usuario, no por respuestas del modelo.
const network = /\b(?:ancho de banda|cuota de red|l[ií]mite de red|mbps|red[^.]{0,30}cuota)\b/i;
const ruledOut = /\b(?:no (?:se )?(?:llega|alcanza|satura|supera)|descart(?:ado|ada|[ée])|por debajo|no es (?:la red|el ancho de banda))\b/i;
const contention = /\b(?:concurrencia|muchos usuarios|mucha gente|al mismo tiempo|solicitudes masivas|pico de tr[aá]fico)\b/i;
const database = /\b(?:base de datos|consulta|inicio de sesi[oó]n|conexiones|pool)\b/i;

function claimsUnverifiedCause(text) {
  return /\b(?:se (?:ha )?bloque(?:ado|ó|a)|se debe|indica que el tr[aá]fico|el problema est[aá]|la causa (?:es|principal))[^.?!]{0,100}\b(?:l[ií]mite|ancho de banda|base de datos|causa|tr[aá]fico)\b/i.test(text);
}

function diagnosticCheck(turns) {
  const lastNetwork = turns.findLast(turn => network.test(turn));
  if (lastNetwork && !ruledOut.test(lastNetwork)) {
    return {
      instruction: 'La limitación de ancho de banda es una hipótesis. Indica cómo comparar los Mbps de entrada y salida con la cuota del plan durante el episodio, y qué revisar si el tráfico se mantiene por debajo.',
      isUseful: text => !claimsUnverifiedCause(text) && /\bmbps\b/i.test(text) && /\b(?:cuota|l[ií]mite|plan)\b/i.test(text)
        && /\b(?:cpu|base de datos|recursos)\b/i.test(text) && !/qu[eé] carga se bloquea/i.test(text),
      fallback: 'En el panel del hosting, compara los Mbps de entrada y salida durante la lentitud con el límite de tu plan. Si el tráfico se acerca al límite, identifica qué recurso o ruta transfiere más datos. Si queda por debajo, compara el uso de CPU y el tiempo de las consultas a la base de datos en el mismo minuto.'
    };
  }
  if (lastNetwork && ruledOut.test(lastNetwork) && turns.slice(-3).some(turn => database.test(turn))) {
    return {
      instruction: 'El visitante ya descartó el límite de red. Para la lentitud restante, indica qué métrica de consultas o de conexiones a la base revisar.',
      isUseful: text => /\b(?:mide|revisa|compara)\b/i.test(text) && /\b(?:consultas|pool|conexiones)\b/i.test(text)
        && /\b(?:latencia|tiempo|espera)\b/i.test(text) && !/\bindican que\b/i.test(text),
      fallback: 'Como la red quedó por debajo del límite, mide cuánto tardan las consultas y si hay espera para conseguir una conexión a la base de datos. Compáralo durante el pico y en una hora normal para ver dónde aumenta la latencia.'
    };
  }
  if (contention.test(turns.join(' '))) {
    return {
      instruction: 'La lentitud coincide con más usuarios. Propón revisar latencia, solicitudes y uso de recursos durante el episodio, sin diagnosticar un ataque.',
      isUseful: text => !claimsUnverifiedCause(text) && /\b(?:compara|mide|revisa|consulta)\b/i.test(text)
        && /\b(?:latencia|solicitudes|tiempo de respuesta|errores|cpu)\b/i.test(text)
        && !/qu[eé] (?:carga|m[eé]trica)/i.test(text),
      followup: 'En el monitor del hosting, toma una captura de la hora del pico y mira qué rutas tardan más en el registro de acceso. Si una sola ruta concentra la espera, empieza por revisar esa petición.',
      fallback: 'Compara el tiempo de respuesta, las solicitudes por minuto y el uso de CPU durante el pico con una hora normal. Si la lentitud coincide con el aumento de solicitudes, revisa qué ruta se satura primero.'
    };
  }
  return null;
}

module.exports = { diagnosticCheck };
