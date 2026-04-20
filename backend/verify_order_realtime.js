const io = require('socket.io-client');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const API_URL = 'http://localhost:5005';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_zenvy_token_2026';

async function verify() {
  console.log('--- Phase 1: Customer -> Delivery Portal Real-Time Verification ---');

  // 1. Create tokens
  const userId = '1fa1f97f-901b-48c6-a358-ed7675a755a8';
  const riderId = 'test-rider-id-' + Date.now();
  
  const userToken = jwt.sign({ id: userId, role: 'student' }, JWT_SECRET);
  const riderToken = jwt.sign({ id: riderId, role: 'delivery' }, JWT_SECRET);

  console.log('-> Tokens generated.');

  // 2. Connect Rider Socket
  const riderSocket = io(API_URL, {
    auth: { token: riderToken, role: 'rider', driverId: riderId, name: 'Test Rider' },
    transports: ['websocket']
  });

  const orderReceivedPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      riderSocket.disconnect();
      reject(new Error('Timeout: Did not receive newOrder event in 10 seconds'));
    }, 10000);

    riderSocket.on('newOrder', (data) => {
      console.log('✅ SUCCESS: Rider received real-time order alert:', data.id);
      clearTimeout(timeout);
      resolve(data);
    });

    riderSocket.on('connect_error', (err) => {
      reject(new Error('Socket Connection Error: ' + err.message));
    });
  });

  riderSocket.on('connect', () => {
    console.log('-> Rider socket connected.');
    // Trigger online status
    riderSocket.emit('rider_connected', { driverId: riderId, name: 'Test Rider' });
    riderSocket.emit('rider_status_change', { riderId, name: 'Test Rider', isOnline: true });
  });

  // 3. Place Order as Customer
  try {
    // Wait for socket to connect before placing order
    await new Promise(r => setTimeout(r, 1000));

    console.log('-> Placing order as Customer...');
    const orderPayload = {
      restaurantId: '86f8f0f3-aab2-4a8b-ae11-f028bfad4fd5', 
      items: [{ menuItemId: 'a4212941-4ff3-4e60-8298-5ad950f786bf', name: 'Test Burger', quantity: 1, price: 100 }],
      totalPrice: 100,
      deliveryAddress: 'Test Sector',
      paymentMethod: 'COD'
    };

    // Note: We might need to ensure the restaurant exists in the DB if the API checks it.
    // In our test environment, we'll assume the API has a fallback or we use a valid ID.
    
    const res = await axios.post(`${API_URL}/api/orders`, orderPayload, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    console.log('-> Order placed successfully. ID:', res.data._id);
    
    await orderReceivedPromise;
    console.log('--- Phase 1 PASSED ---');
  } catch (err) {
    console.error('❌ Phase 1 FAILED:', err.response?.data || err.message);
    process.exit(1);
  } finally {
    riderSocket.disconnect();
  }
}

verify();
