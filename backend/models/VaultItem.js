const mongoose = require('mongoose');

const vaultItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number, required: true },
  remainingCount: { type: Number, default: 0 },
  imageUrl: { type: String },
  isActive: { type: Boolean, default: true },
  resetAt: { type: Date } // When this item should disappear or reset
}, { timestamps: true });

module.exports = mongoose.model('VaultItem', vaultItemSchema);
