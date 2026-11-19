const { execFile } = require('node:child_process');
const path = require('node:path');

function startModel() {
  if (process.env.CHAT_AI_ENABLED !== 'true' || process.env.CHAT_AI_URL) return;

  const backend = path.resolve(__dirname, '../../..');
  const compose = ['compose', '-f', 'chatbot.compose.yml'];
  if (process.env.CHAT_AI_VULKAN === 'true') {
    compose.push('-f', 'chatbot.vulkan.compose.yml');
  }
  execFile('docker', [...compose, 'up', '-d', 'qwen'], {
    cwd: backend,
    timeout: 120000
  }, (error) => {
    if (error) {
      console.error('[Chatbot IA] No se pudo iniciar Docker. Las preguntas rápidas siguen disponibles.');
      return;
    }
    process.env.CHAT_AI_URL = 'http://127.0.0.1:6771/v1/chat/completions';
    console.log('[Chatbot IA] Contenedor iniciado. El modelo puede tardar en cargar.');
  });
}

module.exports = { startModel };
