const bcrypt = require('bcryptjs');
const { connectDB } = require('./config/db');
const { getDeliveryPartnerModel } = require('./models/DeliveryPartner');

async function fixRider() {
  await connectDB();
  const DeliveryPartner = getDeliveryPartnerModel();
  
  const phone = '0000000000';
  const password = 'srk';
  
  console.log(`Fixing rider ${phone}...`);
  
  const partner = await DeliveryPartner.findOne({ where: { phone } });
  if (partner) {
    console.log('Found partner. Updating password...');
    partner.password = await bcrypt.hash(password, 10);
    await partner.save();
    console.log('Password updated and hashed.');
  } else {
    console.log('Partner not found. Creating...');
    await DeliveryPartner.create({
      name: 'Hostel Hub Rider',
      phone,
      password,
      isApproved: true,
      isOnline: true,
      vehicleType: 'Zenvy Cycle'
    });
    console.log('Partner created and hashed via hook.');
  }

  // Double check
  const updated = await DeliveryPartner.findOne({ where: { phone } });
  const isMatch = await bcrypt.compare(password, updated.password);
  console.log(`Verification: ${isMatch ? 'PASS' : 'FAIL'}`);
  console.log(`Hash: ${updated.password}`);
  
  process.exit();
}

fixRider();
