require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const { seedDatabase } = require('./seed');
const { startModel } = require('./services/chatbot/startModel');

const PORT = Number(process.env.PORT || 4000);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/aegissec_db';

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[MongoDB] Conectado correctamente.');

    // Carga semilla inicial idempotente si la base está vacía o faltan registros base
    await seedDatabase();
    console.log('[Seed] Verificación inicial completada.');

    app.listen(PORT, () => {
      console.log(`[AegisSec API] Servidor escuchando en http://localhost:${PORT}`);
      startModel();
    });
  } catch (err) {
    console.error('[Startup Error] No se pudo iniciar el servidor:', err.message);
    process.exit(1);
  }
}

startServer();
