const mongoose = require('mongoose');

const globalConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g., 'shift_timings', 'elite_threshold'
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  description: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('GlobalConfig', globalConfigSchema);
