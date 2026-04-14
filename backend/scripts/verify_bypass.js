const axios = require('axios');

const API_URL = 'http://localhost:5005';

async function testUserBypass() {
  console.log('🧪 Testing User OTP Bypass...');
  try {
    const res = await axios.post(`${API_URL}/api/users/login`, {
      phone: '1234567890',
      firebaseToken: 'E2E_MOCK_TOKEN'
    });
    console.log('✅ User Bypass Success:', res.data.name);
  } catch (err) {
    console.error('❌ User Bypass Failed:', err.response?.data?.message || err.message);
  }
}

async function testRiderBypass() {
  console.log('🧪 Testing Rider OTP Bypass...');
  try {
    const res = await axios.post(`${API_URL}/api/delivery/login`, {
      phone: '1234567890',
      firebaseToken: 'E2E_MOCK_TOKEN'
    });
    console.log('✅ Rider Bypass Success:', res.data.name);
  } catch (err) {
    console.error('❌ Rider Bypass Failed:', err.response?.data?.message || err.message);
  }
}

async function run() {
  await testUserBypass();
  await testRiderBypass();
}

run();
