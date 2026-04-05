const { connectDB } = require('./config/db');
const { getDeliveryPartnerModel } = require('./models/DeliveryPartner');
const bcrypt = require('bcryptjs');

const run = async () => {
  await connectDB();
  const DeliveryPartner = getDeliveryPartnerModel();
  const partner = await DeliveryPartner.findOne({ where: { phone: '1234567890' } });
  if (!partner) { 
    console.log('Partner not found in DB!'); 
    return process.exit(); 
  }
  console.log('Partner found! DB password value:', partner.password);
  
  const match = await bcrypt.compare('password123', partner.password);
  console.log('Does password123 match?', match);
  process.exit();
};

run().catch(console.error);
