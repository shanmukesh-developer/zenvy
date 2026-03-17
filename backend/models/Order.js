const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  restaurantId: { type: String, required: true },
  deliveryPartnerId: { type: String },
  items: [{
    menuItemId: { type: String },
    name: { type: String },
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
