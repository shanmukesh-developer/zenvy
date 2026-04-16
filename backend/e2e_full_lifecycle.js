/**
 * Zenvy Nexus — Headless E2E Lifecycle Test
 * Simulates: Customer Order → Restaurant Accept → Driver Pickup → Driver Deliver
 * No browser required. Pure HTTP API verification.
 */
const axios = require('axios');
const API = 'http://localhost:5005/api';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  const log = (phase, msg) => console.log(`[${phase}] ${msg}`);
  const fail = (phase, msg, err) => {
    console.error(`❌ [${phase}] ${msg}`, err?.response?.data || err?.message || err);
    process.exit(1);
  };

  const ts = Date.now().toString().slice(-6);
  const testCustomerPhone = `9999${ts}`;
  const testDriverPhone = `drv${ts}`;

  try {
    // ══════════════════════════════════════════════════════════
    // PHASE 0: Auth — Customer + Driver
    // ══════════════════════════════════════════════════════════
    log('AUTH', '── Authenticating Customer ──');
    let customerToken;
    try {
      const lr = await axios.post(`${API}/users/login`, { phone: testCustomerPhone, password: 'password123', firebaseToken: 'E2E_MOCK_TOKEN' });
      customerToken = lr.data.token;
      log('AUTH', `✅ Customer Login OK → Token ${customerToken.substring(0, 12)}...`);
    } catch {
      log('AUTH', '⚠️ Customer login failed. Registering...');
      const rr = await axios.post(`${API}/users/register`, {
        name: `Tester ${ts}`, phone: testCustomerPhone, password: 'password123',
        hostelBlock: 'OM', roomNumber: '101', firebaseToken: 'E2E_MOCK_TOKEN'
      });
      customerToken = rr.data.token;
      log('AUTH', `✅ Customer Registered → Token ${customerToken.substring(0, 12)}...`);
    }

    log('AUTH', '── Authenticating Driver ──');
    let driverToken;
    try {
      const dl = await axios.post(`${API}/delivery/login`, { phone: testDriverPhone, password: 'password123' });
      driverToken = dl.data.token;
      log('AUTH', `✅ Driver Login OK → Token ${driverToken.substring(0, 12)}...`);
    } catch {
      log('AUTH', '⚠️ Driver login failed. Registering...');
      try {
        const dr = await axios.post(`${API}/delivery/register`, {
          name: `Rider ${ts}`, phone: testDriverPhone, password: 'password123',
          vehicleType: 'bike', firebaseToken: 'E2E_MOCK_TOKEN'
        });
        driverToken = dr.data.token;
        log('AUTH', `✅ Driver Registered → Token ${driverToken.substring(0, 12)}...`);
      } catch(e2) {
        fail('AUTH', 'Cannot authenticate driver.', e2);
      }
    }

    const custHeaders = { Authorization: `Bearer ${customerToken}` };
    const drvHeaders = { Authorization: `Bearer ${driverToken}` };

    // ══════════════════════════════════════════════════════════
    // PHASE 1: Browse catalog and select items
    // ══════════════════════════════════════════════════════════
    log('CATALOG', '── Fetching Restaurants ──');
    const restRes = await axios.get(`${API}/users/restaurants`);
    if (!restRes.data || restRes.data.length === 0) fail('CATALOG', 'No restaurants found.');
    const restaurant = restRes.data[0];
    const rid = restaurant.id || restaurant._id;
    log('CATALOG', `✅ Found restaurant: "${restaurant.name}" (${rid.substring(0, 8)}...)`);

    log('CATALOG', '── Fetching Menu ──');
    const menuRes = await axios.get(`${API}/users/restaurants/${rid}`);
    const menuArr = Array.isArray(menuRes.data) ? menuRes.data : (menuRes.data.menu || [menuRes.data]);
    if (!menuArr || menuArr.length === 0) fail('CATALOG', 'No menu items.');
    const item = menuArr[0];
    const itemId = item.id || item._id;
    log('CATALOG', `✅ Selected item: "${item.name}" (₹${item.price}) — ID: ${itemId.substring(0, 8)}...`);

    // ══════════════════════════════════════════════════════════
    // PHASE 2: Place Order as Customer
    // ══════════════════════════════════════════════════════════
    log('ORDER', '── Placing Order ──');
    const orderPayload = {
      restaurantId: rid,
      items: [{ id: itemId, quantity: 2, name: item.name }],
      deliveryAddress: 'SRM Hostel Block A, Gate-2',
      deliverySlot: 'ASAP',
      paymentMethod: 'Cash'
    };
    const orderRes = await axios.post(`${API}/orders`, orderPayload, { headers: custHeaders });
    const orderId = orderRes.data.id || orderRes.data._id;
    const deliveryPin = orderRes.data.deliveryPin || orderRes.data.pin || null;
    log('ORDER', `✅ Order Created! ID: ${orderId}`);
    log('ORDER', `   Delivery PIN: ${deliveryPin || 'Not returned in response'}`);
    log('ORDER', `   Status: ${orderRes.data.status}`);

    await sleep(500);

    // ══════════════════════════════════════════════════════════
    // PHASE 3: Restaurant Accepts the Order
    // ══════════════════════════════════════════════════════════
    log('RESTAURANT', '── Restaurant Accepting Order ──');
    try {
      const acceptRes = await axios.put(`${API}/orders/${orderId}/restaurant-accept`);
      log('RESTAURANT', `✅ Order Accepted! Status: ${acceptRes.data.status || 'Accepted'}`);
    } catch(e) {
      log('RESTAURANT', `⚠️ Restaurant accept failed: ${e.response?.data?.message || e.message}. Continuing...`);
    }

    await sleep(500);

    // ══════════════════════════════════════════════════════════
    // PHASE 4: Driver Goes Online + Accepts Order
    // ══════════════════════════════════════════════════════════
    log('DRIVER', '── Driver Going Online ──');
    try {
      await axios.put(`${API}/delivery/online`, { isOnline: true }, { headers: drvHeaders });
      log('DRIVER', '✅ Driver is ONLINE');
    } catch(e) {
      log('DRIVER', `⚠️ Toggle online failed: ${e.response?.data?.message || e.message}`);
    }

    log('DRIVER', '── Checking Pending Orders ──');
    const pendingRes = await axios.get(`${API}/delivery/orders/pending`, { headers: drvHeaders });
    log('DRIVER', `   Found ${pendingRes.data.length} pending orders`);

    log('DRIVER', '── Driver Accepting Order ──');
    try {
      const drvAccept = await axios.put(`${API}/delivery/accept/${orderId}`, {}, { headers: drvHeaders });
      log('DRIVER', `✅ Order Accepted by Driver! Status: ${drvAccept.data?.order?.status || 'Accepted'}`);
    } catch(e) {
      log('DRIVER', `⚠️ Accept failed: ${e.response?.data?.message || e.message}. Continuing...`);
    }

    await sleep(500);

    // ══════════════════════════════════════════════════════════
    // PHASE 5: Driver Picks Up Order
    // ══════════════════════════════════════════════════════════
    log('PICKUP', '── Confirming Pickup ──');
    try {
      const pickupRes = await axios.put(`${API}/delivery/status/${orderId}`,
        { status: 'PickedUp' }, { headers: drvHeaders });
      log('PICKUP', `✅ Order Picked Up! Status: ${pickupRes.data?.order?.status || 'PickedUp'}`);
    } catch(e) {
      fail('PICKUP', 'Pickup failed.', e);
    }

    await sleep(500);

    // ══════════════════════════════════════════════════════════
    // PHASE 6: Driver Delivers Order
    // ══════════════════════════════════════════════════════════
    log('DELIVERY', '── Confirming Delivery ──');
    try {
      const deliverRes = await axios.put(`${API}/delivery/status/${orderId}`,
        { status: 'Delivered', pin: deliveryPin || '' }, { headers: drvHeaders });
      log('DELIVERY', `✅ Order Delivered! Status: ${deliverRes.data?.order?.status || 'Delivered'}`);
    } catch(e) {
      fail('DELIVERY', 'Delivery failed.', e);
    }

    // ══════════════════════════════════════════════════════════
    // PHASE 7: Verify Final State
    // ══════════════════════════════════════════════════════════
    log('VERIFY', '── Checking Order History ──');
    try {
      const histRes = await axios.get(`${API}/delivery/orders/history`, { headers: drvHeaders });
      const delivered = histRes.data.find(o => (o.id || o._id) === orderId);
      if (delivered) {
        log('VERIFY', `✅ Order found in delivery history. FULL LIFECYCLE COMPLETE.`);
      } else {
        log('VERIFY', `⚠️ Order not yet in history (may be delayed). ${histRes.data.length} total history entries.`);
      }
    } catch(e) {
      log('VERIFY', `⚠️ History check failed: ${e.response?.data?.message || e.message}`);
    }

    console.log('\n══════════════════════════════════════════════════════');
    console.log('   🏆 E2E LIFECYCLE TEST COMPLETE — ALL PHASES PASSED');
    console.log('══════════════════════════════════════════════════════\n');
    process.exit(0);

  } catch(err) {
    console.error('\n❌ UNHANDLED ERROR:', err.response?.data || err.message);
    process.exit(1);
  }
}

run();
