require('dotenv').config();
const { connectDB } = require('./config/db');
const { getUserModel } = require('./models/User');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const run = async () => {
  try {
    await connectDB();
    const User = getUserModel();
    const user = await User.findOne({ where: { phone: '9999999999' } });
    
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }
    
    const token = jwt.sign({ id: user.id, role: 'admin' }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
    fs.writeFileSync('token.txt', token);
    console.log('Token saved to token.txt');
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
};

run().catch(console.error);
