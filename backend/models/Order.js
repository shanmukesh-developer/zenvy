const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  deliveryPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner' },
  items: [{
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    quantity: { type: Number, required: true },
    priceAtOrder: { type: Number, required: true }
  }],
  totalPrice: { type: Number, required: true },
  deliveryFee: { type: Number, required: true },
  batchDiscount: { type: Number, default: 0 },
  gateDiscount: { type: Number, default: 0 },
  finalPrice: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Accepted', 'Preparing', 'PickedUp', 'Delivered', 'Cancelled'], 
    default: 'Pending' 
  },
  paymentStatus: { 
    type: String, 
    enum: ['Pending', 'Completed', 'Failed'], 
    default: 'Pending' 
  },
  deliverySlot: { type: String },
  hostelGateDelivery: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
