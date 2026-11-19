const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 120
    },
    serviceTitle: {
      type: String,
      required: [true, 'El servicio solicitado es obligatorio'],
      trim: true,
      maxlength: 150
    },
    preferredDate: {
      type: String,
      required: [true, 'La fecha preferida es obligatoria'],
      trim: true
    },
    priority: {
      type: String,
      enum: ['Normal', 'Alta', 'Crítica'],
      default: 'Normal'
    },
    notes: {
      type: String,
      required: [true, 'El alcance técnico es obligatorio'],
      trim: true,
      maxlength: 300
    },
    status: {
      type: String,
      enum: ['Pendiente Revisión', 'Aprobada'],
      default: 'Pendiente Revisión'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { versionKey: false }
);

bookingSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
