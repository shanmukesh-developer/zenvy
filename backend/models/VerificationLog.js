const mongoose = require('mongoose');

const verificationLogSchema = new mongoose.Schema({
  adminId: { type: String, required: true },
  targetId: { type: String, required: true },
  action: { type: String, required: true }, // e.g., 'ELITE_TOGGLE', 'RIDER_APPROVE'
  details: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VerificationLog', verificationLogSchema);
