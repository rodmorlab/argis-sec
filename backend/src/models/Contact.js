const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 100
    },
    phone: {
      type: String,
      default: 'No indicado',
      trim: true,
      maxlength: 25
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    smtpInstitutionalSent: {
      type: Boolean,
      default: false
    },
    smtpClientCopySent: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { versionKey: false }
);

contactSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Contact', contactSchema);
