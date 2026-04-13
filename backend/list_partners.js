const { connectDB } = require('./config/db');
const { getDeliveryPartnerModel } = require('./models/DeliveryPartner');

async function listPartners() {
  await connectDB();
  const DeliveryPartner = getDeliveryPartnerModel();
  const partners = await DeliveryPartner.findAll();
  console.log('--- Delivery Partners ---');
  partners.forEach(p => {
    console.log(`ID: ${p.id}, Name: ${p.name}, Phone: ${p.phone}`);
  });
  process.exit(0);
}

listPartners();
