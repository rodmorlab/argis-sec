const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const User = require('../models/User');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const Contact = require('../models/Contact');
const Social = require('../models/Social');
const ChatbotFaq = require('../models/ChatbotFaq');
const ChatbotLog = require('../models/ChatbotLog');
const { seedDatabase } = require('../seed');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/aegissec_db';
const BACKUP_DIR = path.resolve(__dirname, '../../../evidencia/backup_nosql');

async function runBackup() {
  await mongoose.connect(MONGO_URI);
  await seedDatabase();

  const [users, services, bookings, contacts, socials, chatbot_faqs, chatbot_logs] =
    await Promise.all([
      User.find().select('-passwordHash').sort({ createdAt: 1 }).lean(),
      Service.find().sort({ _id: 1 }).lean(),
      Booking.find().sort({ createdAt: -1 }).lean(),
      Contact.find().sort({ createdAt: -1 }).lean(),
      Social.find().sort({ _id: 1 }).lean(),
      ChatbotFaq.find().sort({ _id: 1 }).lean(),
      ChatbotLog.find().sort({ timestamp: -1 }).lean()
    ]);

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const consolidated = {
    metadata: {
      project: 'AegisSec Enterprise',
      database: mongoose.connection.name,
      exportedAt: new Date().toISOString(),
      leastPrivilegeUser: 'aegis_app_rw (role: readWrite)',
      counts: {
        users: users.length,
        services: services.length,
        bookings: bookings.length,
        contacts: contacts.length,
        socials: socials.length,
        chatbot_faqs: chatbot_faqs.length,
        chatbot_logs: chatbot_logs.length
      }
    },
    collections: {
      users,
      services,
      bookings,
      contacts,
      socials,
      chatbot_faqs,
      chatbot_logs
    }
  };

  const outPath = path.join(BACKUP_DIR, 'aegissec_db_backup.json');
  fs.writeFileSync(outPath, JSON.stringify(consolidated, null, 2), 'utf8');
  console.log(`[Backup NoSQL] Respaldo exportado exitosamente en: ${outPath}`);
  await mongoose.disconnect();
}

runBackup().catch((err) => {
  console.error('[Backup Error]', err.message);
  process.exit(1);
});
