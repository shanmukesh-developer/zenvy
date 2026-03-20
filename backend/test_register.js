const { connectDB, getSequelize } = require('./config/db');
const { getUserModel } = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

async function test() {
  try {
    console.log('🔄 Connecting to DB...');
    await connectDB();
    
    console.log('🔄 Loading User Model...');
    const User = getUserModel();
    if (!User) throw new Error('User model is null!');

    const phone = 'test_' + Date.now();
    console.log(`🔄 Attempting to create user with phone: ${phone}...`);
    
    const user = await User.create({
      name: 'Test User',
      phone: phone,
      password: 'password123',
      hostelBlock: 'H1',
      roomNumber: '101'
    });

    console.log('✅ User created successfully!', user.id);
  } catch (error) {
    console.error('❌ ERROR CAUGHT:');
    console.error(error);
  } finally {
    process.exit();
  }
}

test();
