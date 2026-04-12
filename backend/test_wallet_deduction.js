const http = require('http');

const API_URL = 'http://localhost:5005';
let userToken = '';

async function runTest() {
  try {
    // 1. Authenticate to get a student token
    console.log('Logging in as student...');
    const loginRes = await fetch(`${API_URL}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: 's@example.com', password: 'password123' })
    });
    
    if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.statusText}`);
    const loginData = await loginRes.json();
    userToken = loginData.token;
    
    console.log(`Logged in. Initial Wallet Balance: ₹${loginData.walletBalance || 0}`);
    
    // 2. Create Order with Wallet (attempt 1 - expects success if balance is sufficient)
    console.log('\n--- Attempting Wallet Order ---');
    const orderData = {
      restaurantId: 'a89d2c2b-6b2c-4f7c-9b8c-5a6b7c8d9e0f',
      items: [
        {
          menuItemId: '26797077-b045-4cee-8af9-0e5caa005819',
          name: 'Zenvy Signature Combo',
          quantity: 1
        }
      ],
      paymentMethod: 'Wallet',
      deliveryAddress: 'Hostel Block A, Rm 101'
    };

    const orderRes = await fetch(`${API_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify(orderData)
    });
    
    const orderResult = await orderRes.json();
    
    if (orderRes.ok) {
      console.log('✅ Order Success!');
      console.log(`Order ID: ${orderResult.id}`);
      console.log(`Final Price Deducted: ₹${orderResult.finalPrice}`);
      
      // Verify new balance
      const profileRes = await fetch(`${API_URL}/api/users/profile`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      const profile = await profileRes.json();
      console.log(`New Wallet Balance: ₹${profile.walletBalance || 0}`);
      
    } else {
      console.log('❌ Order Failed (Expected if Insufficient Balance):', orderResult.message);
    }
    
  } catch (err) {
    console.error('Fatal Error:', err);
  }
}

// Simple fetch implementation for Node.js
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: options.headers,
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk.toString());
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          json: () => Promise.resolve(JSON.parse(body))
        });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

runTest();
