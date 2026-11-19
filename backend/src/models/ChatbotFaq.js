const mongoose = require('mongoose');

const chatbotFaqSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: [true, 'La categoría es obligatoria'],
      trim: true,
      maxlength: 80
    },
    keywords: {
      type: String,
      required: [true, 'Las palabras clave son obligatorias'],
      trim: true,
      maxlength: 250
    },
    question: {
      type: String,
      required: [true, 'La pregunta es obligatoria'],
      trim: true,
      maxlength: 200
    },
    answer: {
      type: String,
      required: [true, 'La respuesta es obligatoria'],
      trim: true,
      maxlength: 600
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    collection: 'chatbot_faqs',
    versionKey: false
  }
);

chatbotFaqSchema.index({ active: 1, category: 1 });

module.exports = mongoose.model('ChatbotFaq', chatbotFaqSchema);
