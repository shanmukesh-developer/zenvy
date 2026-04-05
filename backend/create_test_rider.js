require('dotenv').config();
const { connectDB } = require('./config/db');
const { getDeliveryPartnerModel } = require('./models/DeliveryPartner');

const createRider = async () => {
  await connectDB();
  const DeliveryPartner = getDeliveryPartnerModel();
  
  await DeliveryPartner.destroy({ where: { phone: '1234567890' } });
  
  await DeliveryPartner.create({
    name: 'Agent Test Rider',
    phone: '1234567890',
    password: 'password123',
    isApproved: true,
    isOnline: true
  });
  
  console.log('✅ Created Guaranteed Rider: 1234567890 / password123');
  process.exit();
};

createRider().catch(err => { 
  console.error(err); 
  process.exit(1); 
});
