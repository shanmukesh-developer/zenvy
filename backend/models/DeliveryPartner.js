const mongoose = require('mongoose');

const deliveryPartnerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  vehicleType: { type: String },
  liveLocation: {
    lat: { type: Number },
    lng: { type: Number }
  },
  isOnline: { type: Boolean, default: false },
  currentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  totalEarnings: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('DeliveryPartner', deliveryPartnerSchema);
