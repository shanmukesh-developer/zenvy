/* eslint-disable */
require('dotenv').config();
const { connectDB } = require('./config/db');
const { getDeliveryPartnerModel } = require('./models/DeliveryPartner');
const bcrypt = require('bcryptjs');

const createProductionRider = async () => {
  await connectDB();
  const DeliveryPartner = getDeliveryPartnerModel();
  
  const phone = '9999999999';
  const password = 'riderpassword123';
  
  await DeliveryPartner.destroy({ where: { phone } }).catch(() => {});
  
  try {
    // Model has beforeCreate hook for hashing, but let's be sure or just use the model create
    const rider = await DeliveryPartner.create({
      name: 'Nexus Prime Rider',
      phone: phone,
      password: password, // will be hashed by hook
      isApproved: true,
      isOnline: true,
      vehicleType: 'Electric Scooter',
      vehicleNumber: 'NX-001-ZEN'
    });
    console.log(`✅ Production Rider Created: ${phone} / ${password}`);
  } catch (err) {
    console.error('❌ Failed to create rider:', err.message);
  }
  
  process.exit();
};

createProductionRider();
