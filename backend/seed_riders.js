require('dotenv').config();
const { connectDB, getSequelize } = require('./config/db');
const bcrypt = require('bcryptjs');

async function seedRiders() {
  try {
    console.log('--- CONNECTING TO NEXUS DB ---');
    await connectDB();
    const sequelize = getSequelize();
    
    console.log('--- SYNCING FLEET SCHEMA (FORCE) ---');
    const DeliveryPartner = sequelize.models.DeliveryPartner;
    await sequelize.query('PRAGMA foreign_keys = OFF');
    await DeliveryPartner.sync({ force: true });
    await sequelize.query('PRAGMA foreign_keys = ON');
    
    console.log('--- SEEDING RIDERS ---');
    const password = await bcrypt.hash('password123', 10);
    
    const riders = [
      {
        name: 'Shanmukh (Fleet Lead)',
        phone: '9391955674',
        password,
        vehicleType: 'Electric',
        isApproved: true,
        isOnline: true,
        isSosActive: false
      },
      {
        name: 'John Doe',
        phone: '1234567890',
        password,
        vehicleType: 'Bike',
        isApproved: true,
        isOnline: false,
        isSosActive: false
      },
      {
        name: 'Jane Smith',
        phone: '9876543210',
        password,
        vehicleType: 'Cycle',
        isApproved: false,
        isOnline: false,
        isSosActive: false
      }
    ];

    for (const r of riders) {
      const [rider, created] = await DeliveryPartner.findOrCreate({
        where: { phone: r.phone },
        defaults: r
      });
      if (created) console.log(`[+] Created ${r.name}`);
      else {
        await rider.update(r);
        console.log(`[~] Updated ${r.name}`);
      }
    }
    console.log('--- SEEDING COMPLETE ---');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seedRiders();
