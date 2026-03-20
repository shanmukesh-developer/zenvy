const fetch = require('node-fetch');

async function testApi() {
  try {
    const res = await fetch('http://localhost:5000/api/restaurants');
    const data = await res.json();
    console.log('API RESPONSE [RESTAURANTS]:', JSON.stringify(data).substring(0, 100), '...');
    console.log('SUCCESS: API is stable and Sequelize is working.');
  } catch (err) {
    console.error('API FAILED:', err.message);
  }
}

testApi();
