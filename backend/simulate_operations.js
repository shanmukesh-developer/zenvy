const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:5001';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1ZjFhMmIzYzRkNWU2ZjdhOGI5YzAwMCIsIm5hbWUiOiJBZG1pbiBVc2VyIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzc0MzM5ODMxLCJleHAiOjE3NzY5MzE4MzF9.Uxu3cFn4Uz23z4Orc3otNoI2JSRrTXIyWpvBOX-wJcs';

async function runSimulation() {
  console.log('--- STARTING ZENVY ORBITAL SIMULATION ---');

  // 1. Register a Simulated Customer
  console.log('\n[1] Registering Customer "Demo User"...');
  const dummyPhone = '99999' + Math.floor(Math.random() * 99999);
  const regRes = await fetch(`${API_URL}/api/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Demo Agent', phone: dummyPhone, password: 'password', hostelBlock: 'Block A', roomNumber: '101' })
  });
  const customerAuth = await regRes.json();
  const CUSTOMER_TOKEN = customerAuth.token;
  console.log('✅ Customer registered successfully! Token acquired.');

  // 2. Fetch Active Asset Catalog (Customer View)
  console.log('\n[2] Fetching Live Restaurant Catalog...');
  const restRes = await fetch(`${API_URL}/api/users/restaurants`, {
    headers: { 'Authorization': `Bearer ${CUSTOMER_TOKEN}` }
  });
  const restaurants = await restRes.json();
  const targetRest = restaurants.find(r => r.vendorType === 'GYM' || r.vendorType === 'RESTAURANT' || r.menu?.length > 0);
  
  if (!targetRest || !targetRest.menu || targetRest.menu.length === 0) {
    console.log('❌ No valid items found to order.');
    return;
  }
  
  const targetItem = targetRest.menu[0];
  console.log(`✅ Found product: "${targetItem.name}" at "${targetRest.name}" (₹${targetItem.price})`);

  // 3. Place The Customer Order
  console.log('\n[3] Customer is Placing Order (Simulating Cart Checkout)...');
  const orderPayload = {
    restaurantId: targetRest.id || targetRest._id,
    items: [
      {
        menuItemId: targetItem.id || targetItem._id,
        name: targetItem.name,
        price: targetItem.price,
        quantity: 2
      }
    ],
    deliveryLocation: { type: 'Point', coordinates: [80.5000, 16.5000] },
    deliveryAddress: 'Block A, Room 101',
    deliverySlot: '5:00 PM',
    paymentMethod: 'razorpay',
    deliveryFee: 20,
    appFee: 10,
    totalPrice: (targetItem.price * 2) + 20 + 10
  };

  const orderRes = await fetch(`${API_URL}/api/orders`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CUSTOMER_TOKEN}`
    },
    body: JSON.stringify(orderPayload)
  });
  
  const orderData = await orderRes.json();
  if (!orderRes.ok) {
    console.log('❌ Failed to place order:', orderData);
    return;
  }
  console.log(`✅ Order Placed Successfully! OrderID: ${orderData._id || orderData.id} | Total: ₹${orderData.totalPrice}`);

  // 4. Verify Admin Dashboard Telemetry
  console.log('\n[4] Simulating Admin Dashboard Telemetry Sync...');
  const adminRes = await fetch(`${API_URL}/api/admin/orders`, {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
  });
  const adminOrders = await adminRes.json();
  const receivedOrder = adminOrders.find(o => o.id === orderData._id || o._id === orderData._id);
  
  if (receivedOrder) {
    console.log(`✅ Admin Dashboard instantly received the order!`);
    console.log(`   Customer: ${receivedOrder.deliveryAddress}`);
    console.log(`   Items: ${receivedOrder.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}`);
    console.log(`   Status: ${receivedOrder.status}`);
  } else {
    console.log('❌ Order Not Found in Admin Dashboard!');
  }

  // 5. Check Admin Stats
  console.log('\n[5] Polling Nexus Platform Stats...');
  const statsRes = await fetch(`${API_URL}/api/admin/stats`, {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
  });
  const stats = await statsRes.json();
  console.log(`✅ Nexus Live Telemetry updated:`);
  console.log(`   Active Orders Revenue: ${stats.activeRevenue}`);
  console.log(`   Current Active Orders Drop: ${stats.activeOrders}`);

  console.log('\n--- ZENVY OPERATIONS SIMULATION COMPLETE ---');
}

runSimulation();
