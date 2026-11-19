const mongoose = require('mongoose');

const socialSchema = new mongoose.Schema(
  {
    network: {
      type: String,
      required: [true, 'El nombre de la red social es obligatorio'],
      trim: true,
      maxlength: 50
    },
    url: {
      type: String,
      required: [true, 'La URL es obligatoria'],
      trim: true,
      validate: {
        validator: (value) => typeof value === 'string' && value.startsWith('https://'),
        message: 'La URL debe iniciar con https://'
      }
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Social', socialSchema);
