require('dotenv').config();
const { connectDB } = require('./config/db');
const { getUserModel } = require('./models/User');

const run = async () => {
  try {
    await connectDB();
    const User = getUserModel();
    
    const phone = '9999999999';
    const existing = await User.findOne({ where: { phone } });
    
    if (existing) {
      console.log('Admin already exists');
      await existing.update({ role: 'admin' });
      console.log('Updated to admin');
    } else {
      await User.create({
        name: 'Admin User',
        phone,
        password: 'admin123',
        hostelBlock: 'A',
        roomNumber: '101',
        role: 'admin'
      });
      console.log('Admin created');
    }
  } catch (err) {
    console.error('Error creating admin:', err);
  }
  process.exit(0);
};

run().catch(console.error);
