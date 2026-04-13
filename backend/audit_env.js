/* eslint-disable */
const { getUserModel } = require('./models/User');
const { getDeliveryPartnerModel } = require('./models/DeliveryPartner');
const jwt = require('jsonwebtoken');
require('dotenv').config();

console.log('--- ENV AUDIT ---');
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0);
console.log('JWT_SECRET prefix:', process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 3) : 'NONE');
console.log('-----------------');

const uToken = jwt.sign({id: 1, role: 'user'}, process.env.JWT_SECRET || 'secret');
const dToken = jwt.sign({id: 1}, process.env.JWT_SECRET || 'secret');

try {
  jwt.verify(uToken, process.env.JWT_SECRET || 'secret');
  console.log('User Token verification: OK');
} catch (e) {
  console.log('User Token verification: FAILED', e.message);
}

try {
  jwt.verify(dToken, process.env.JWT_SECRET || 'secret');
  console.log('Driver Token verification: OK');
} catch (e) {
  console.log('Driver Token verification: FAILED', e.message);
}
