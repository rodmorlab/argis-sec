const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'El título del servicio es obligatorio'],
      trim: true,
      maxlength: 150
    },
    category: {
      type: String,
      required: [true, 'La categoría es obligatoria'],
      trim: true,
      maxlength: 80
    },
    price: {
      type: String,
      required: [true, 'El precio referencial es obligatorio'],
      trim: true,
      maxlength: 50
    },
    description: {
      type: String,
      required: [true, 'La descripción es obligatoria'],
      trim: true,
      maxlength: 600
    }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Service', serviceSchema);
