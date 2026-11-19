const mongoose = require('mongoose');

const chatbotLogSchema = new mongoose.Schema(
  {
    query: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180
    },
    matchedCategory: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'chatbot_logs',
    versionKey: false
  }
);

module.exports = mongoose.model('ChatbotLog', chatbotLogSchema);
