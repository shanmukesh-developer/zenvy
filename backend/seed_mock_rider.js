require('dotenv').config();
const { connectDB } = require('./config/db');
const { getDeliveryPartnerModel } = require('./models/DeliveryPartner');

const seedMockRider = async () => {
  await connectDB();
  const DeliveryPartner = getDeliveryPartnerModel();
  
  // Ensure mock-driver-1 exists with proper UUID or fixed ID
  // SQLite might not like non-UUIDs if it's set to UUID type, but we can try
  
  await DeliveryPartner.destroy({ where: { id: 'mock-driver-1' } }).catch(() => {});
  
  try {
    await DeliveryPartner.create({
      id: 'mock-driver-1',
      name: 'Hostel Hub Rider',
      phone: '0000000000',
      password: 'srk',
      isApproved: true,
      isOnline: true,
      vehicleType: 'Zenvy Cycle'
    });
    console.log('✅ Synchronized Mock Rider: mock-driver-1 / srk');
  } catch (err) {
    console.error('❌ Failed to seed mock rider:', err.message);
  }
  
  process.exit();
};

seedMockRider();
