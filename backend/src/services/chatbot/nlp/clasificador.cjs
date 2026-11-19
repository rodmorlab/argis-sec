const STOP = new Set('a al con de del el en la las lo los me mi mis para por que se un una y ya te puedes favor necesito quisiera saber tengo'.split(' '));

function normalize(text) {
  return String(text).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function features(text) {
  const words = normalize(text).split(' ').filter(word => word && !STOP.has(word));
  const result = new Map();
  const put = (feature, weight) => result.set(feature, weight);
  for (const [index, word] of words.entries()) {
    put(`w:${word}`, 2);
    if (index) put(`b:${words[index - 1]} ${word}`, 0.8);
    const marked = `^${word}$`;
    for (const size of [3, 4]) {
      for (let offset = 0; offset <= marked.length - size; offset += 1) {
        put(`c:${marked.slice(offset, offset + size)}`, 0.6);
      }
    }
  }
  return result;
}

function vector(text, weights) {
  const values = [...features(text)].filter(([key]) => Object.hasOwn(weights, key))
    .map(([key, value]) => [key, value * weights[key]]);
  const norm = Math.hypot(...values.map(([, value]) => value)) || 1;
  return values.map(([key, value]) => [key, value / norm]);
}

function train(examples) {
  const counts = new Map();
  for (const { text } of examples) {
    for (const feature of features(text).keys()) counts.set(feature, 1 + (counts.get(feature) || 0));
  }
  const weights = Object.fromEntries([...counts].map(([key, count]) =>
    [key, Math.log((examples.length + 1) / (count + 1)) + 1]));
  const references = examples.map(({ intent, text }) => ({ intent, values: vector(text, weights) }));
  const totals = new Map();
  for (const { intent, values } of references) {
    if (!totals.has(intent)) totals.set(intent, new Map());
    const centroid = totals.get(intent);
    for (const [feature, weight] of values) centroid.set(feature, (centroid.get(feature) || 0) + weight);
  }
  const centroids = Object.fromEntries([...totals].map(([intent, centroid]) => {
    const norm = Math.hypot(...centroid.values());
    return [intent, [...centroid].map(([feature, weight]) => [feature, weight / norm])];
  }));
  return { weights, references, centroids };
}

function predict(text, model, { minScore = 0.15, minMargin = 0.024 } = {}) {
  const query = new Map(vector(text, model.weights));
  const byIntent = new Map();
  for (const { intent, values } of model.references) {
    const score = values.reduce((sum, [key, value]) => sum + value * (query.get(key) || 0), 0);
    byIntent.set(intent, Math.max(score, byIntent.get(intent) || 0));
  }
  const candidates = [...byIntent].map(([intent, nearest]) => {
    const centroid = model.centroids[intent].reduce((sum, [key, value]) => sum + value * (query.get(key) || 0), 0);
    return [intent, nearest * 0.65 + centroid * 0.35];
  }).sort((a, b) => b[1] - a[1]);
  const [intent = 'desconocido', score = 0] = candidates[0] || [];
  const margin = score - (candidates[1]?.[1] || 0);
  return { intent: score >= minScore && margin >= minMargin ? intent : 'desconocido', score, margin, candidate: intent };
}

module.exports = { normalize, train, predict };
