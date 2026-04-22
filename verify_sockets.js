const io = require('socket.io-client');

async function run() {
  console.log("Starting Real-Time Ecosystem Verification (V4)...");

  const serverUrl = 'http://localhost:5005';

  try {
    const res = await fetch(`${serverUrl}/api/users/restaurants`);
    const resData = await res.json();
    const restaurant = resData[0];
    if (!restaurant) throw new Error("No restaurants");

    const customerSocket = io(serverUrl, { transports: ['websocket'] });
    const adminSocket = io(serverUrl, { transports: ['websocket'] });

    customerSocket.on('connect', () => console.log("Customer Connected"));
    adminSocket.on('connect', () => {
        adminSocket.emit('joinAdmin');
        console.log("Admin Connected");
    });

    customerSocket.on('statusUpdated', (data) => {
        console.log(`✅ MATCH: Received standardized status update:`, data);
        setTimeout(() => process.exit(0), 1000);
    });

    adminSocket.on('admin_newOrder', (data) => {
        console.log(`✅ MATCH: Admin received new order alert:`, data.id);
    });

    await new Promise(r => setTimeout(r, 2000));

    console.log("Logging in...");
    const authRes = await fetch(`${serverUrl}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firebaseToken: 'E2E_MOCK_TOKEN', phone: '9391955674', name: 'Nexus Admin' })
    });
    const { token } = await authRes.json();

    console.log("Placing order...");
    const orderRes = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        restaurantId: restaurant.id,
        items: [{ id: 'item1', quantity: 1, price: 100, name: 'Test Item' }],
        totalPrice: 100,
        paymentMethod: 'COD',
        deliveryAddress: 'Amaravathi Center'
      })
    });
    const orderData = await orderRes.json();
    const orderId = orderData.id || orderData._id;

    customerSocket.emit('joinOrder', orderId);
    await new Promise(r => setTimeout(r, 2000));

    console.log("Updating status to Accepted...");
    await fetch(`${serverUrl}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: 'Accepted' })
    });

    setTimeout(() => {
        console.log("Timeout waiting for events.");
        process.exit(1);
    }, 10000);

  } catch (err) {
    console.error("Verification failed:", err.message);
    process.exit(1);
  }
}

run();
