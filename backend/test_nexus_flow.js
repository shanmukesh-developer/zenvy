const axios = require('axios');
const fs = require('fs');
const { io } = require('socket.io-client');

const API_URL = 'http://localhost:5005/api';
const SOCKET_URL = 'http://localhost:5005';

async function runSimulation() {
  try {
    console.log('--- Phase 0: Auth and Context Fetching ---');
    // Fetch live token via test user or fallback
    let TOKEN;
    try {
       const loginParams = { phone: '9999999999', password: 'password123' };
       const loginRes = await axios.post(`${API_URL}/users/login`, loginParams);
       TOKEN = loginRes.data.token;
       console.log('✅ Synchronized API Session Token from Login.');
    } catch(err) {
       console.log('⚠️ Login failed (likely missing seeder). Injecting test user profile dynamically...');
       const regParams = { name: 'Nexus Tester', phone: '9999999999', password: 'password123', hostelBlock: 'OM', roomNumber: '101' };
       const regRes = await axios.post(`${API_URL}/users/register`, regParams);
       TOKEN = regRes.data.token;
       console.log('✅ Synchronized API Session Token via Registration.');
    }

    // Fetch valid live seed data Context
    const restRes = await axios.get(`${API_URL}/users/restaurants`);
    if(!restRes.data || restRes.data.length === 0) throw new Error("No Restaurants available.");
    const NEXUS_RID = restRes.data[0].id || restRes.data[0]._id;

    const menuRes = await axios.get(`${API_URL}/users/restaurants/${NEXUS_RID}`);
    // Handle variants of API wrapping the array
    const menuArr = Array.isArray(menuRes.data) ? menuRes.data : (menuRes.data.menu || [menuRes.data]);
    if(!menuArr || menuArr.length === 0) throw new Error("No menu items available for target restaurant.");
    const firstItem = menuArr[0];
    const ITEM_ID = firstItem.id || firstItem._id;
    const ITEM_NAME = firstItem.name || 'Organic Sample Item';
    console.log(`✅ Intercepted Live UUIDs -> RID: ${NEXUS_RID.substring(0, 8)}... | ITEM: ${ITEM_NAME}`);

    console.log('\n--- Phase 1: Global Announcement ---');
    const socket = io(SOCKET_URL);
    socket.emit('admin_announcement', {
      message: 'Nexus Omni-Catalog is now LIVE! Elite assets available for deployment.',
      type: 'Nexus_Pulse'
    });
    console.log('✅ Global Announcement Sent');

    console.log('\n--- Phase 2: Placing Order ---');
    const orderData = {
      restaurantId: NEXUS_RID,
      items: [
        { id: ITEM_ID, quantity: 2, name: ITEM_NAME }
      ],
      deliveryAddress: 'SRM Hostel Block A, Gate-2',
      deliverySlot: 'ASAP',
      paymentMethod: 'Cash'
    };

    const orderRes = await axios.post(`${API_URL}/orders`, orderData, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    
    const orderId = orderRes.data.id || orderRes.data._id;
    console.log(`✅ Order Created! ID: ${orderId}`);

    console.log('\n--- Phase 3: Restaurant Acceptance ---');
    await axios.put(`${API_URL}/orders/${orderId}/restaurant-accept`);
    console.log('✅ Order Accepted by Nexus Restaurant');

    console.log('\n--- Phase 4: Driver Simulation ---');
    console.log('Starting driver location pulses...');
    
    let i = 0;
    const interval = setInterval(() => {
      const lat = 16.4645 + (Math.sin(i * 0.1) * 0.005);
      const lng = 80.5055 + (Math.cos(i * 0.1) * 0.005);
      
      socket.emit('updateLocation', {
        orderId,
        lat,
        lng,
        riderName: 'Nexus Dispatcher',
        riderId: 'nexus-1'
      });
      
      console.log(`[SIM] Pulse ${i+1}: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      
      i++;
      if (i >= 15) {
        clearInterval(interval);
        console.log('\n--- Simulation Complete ---');
        process.exit(0);
      }
    }, 1000);

  } catch (err) {
    console.error('❌ Simulation Failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

runSimulation();
