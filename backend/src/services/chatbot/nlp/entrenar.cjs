const fs = require('node:fs');
const path = require('node:path');
const { normalize, train: fit, predict } = require('./clasificador.cjs');
const { train, test, final } = require('./corpus.cjs');

const variations = [
  text => text,
  text => `hola, ${text} por favor`,
  text => `tengo una duda: ${text}`,
  text => `${text.replace(/\bque\b/g, 'q').replace(/\bpagina\b/g, 'pajina').replace(/\bporque\b/g, 'porq')}`,
  text => `oye, ${text}, me orientas`
];
const examples = Object.entries(train).flatMap(([intent, phrases]) =>
  [...new Set(phrases.flatMap(text => variations.map(variation => normalize(variation(text)))))].map(text => ({ intent, text })));
const model = fit(examples);
const destination = path.join(__dirname, 'modelo.json');
fs.writeFileSync(destination, JSON.stringify(model));
const known = new Set(examples.map(({ text }) => text));
function evaluate(cases, name) {
  const results = Object.entries(cases).flatMap(([expected, phrases]) => phrases.map(text => {
    if (known.has(normalize(text))) throw new Error(`Caso compartido entre entrenamiento y prueba: ${text}`);
    const prediction = predict(text, model);
    return { text, expected, ...prediction };
  }));
  console.log(`${name}: ${results.filter(row => row.expected === row.intent).length}/${results.length} correctas`);
  for (const { text, expected, intent, candidate, score } of results) {
    if (intent !== expected) console.log(`${expected} → ${intent} (${candidate} ${score.toFixed(2)}): ${text}`);
  }
}
console.log(`Entrenamiento: ${examples.length} frases, ${Object.keys(train).length} intenciones`);
evaluate(test, 'Desarrollo');
evaluate(final, 'Evaluación final');
