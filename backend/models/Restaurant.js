const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  imageUrl: { type: String },
  rating: { type: Number, default: 0 },
  deliveryTime: { type: Number },
  commissionRate: { type: Number, default: 10 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Restaurant', restaurantSchema);
