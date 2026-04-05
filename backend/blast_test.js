const API_URL = 'http://localhost:5001/api';
let ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1ZjFhMmIzYzRkNWU2ZjdhOGI5YzAwMCIsIm5hbWUiOiJBZG1pbiBVc2VyIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzc0MzM5ODMxLCJleHAiOjE3NzY5MzE4MzF9.Uxu3cFn4Uz23z4Orc3otNoI2JSRrTXIyWpvBOX-wJcs';
let CUSTOMER_TOKEN = '';
let VAULT_ID = '';
let RESTAURANT_ID = '';

async function blast() {
  console.log('--- ZENVY OMNI-PORTAL STRESS TEST ---');
  let errorsFound = 0;

  const request = async (name, url, options = {}) => {
    try {
      const res = await fetch(`${API_URL}${url}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      const data = await res.text();
      if (!res.ok) {
        console.error(`❌ [${name}] FAILED: ${res.status} - ${data}`);
        errorsFound++;
      } else {
        console.log(`✅ [${name}] SUCCESS: ${res.status}`);
      }
      return { ok: res.ok, status: res.status, data: data.startsWith('{') || data.startsWith('[') ? JSON.parse(data) : data };
    } catch (e) {
      console.error(`❌ [${name}] KILLED: ${e.message}`);
      errorsFound++;
    }
  };

  // 1. Auth Test
  const phone = `99${Math.floor(Math.random() * 100000000)}`;
  const regRes = await request('CUSTOMER REGISTRATION', '/users/register', { 
    method: 'POST', body: JSON.stringify({ name: 'Blast Test', phone, password: 'password', hostelBlock: 'A', roomNumber: '101' })
  });
  if (regRes.ok) CUSTOMER_TOKEN = regRes.data.token;

  // 2. Restaurants Fetch
  const restRes = await request('FETCH RESTAURANTS', '/restaurants');
  if (restRes.ok && restRes.data.length > 0) RESTAURANT_ID = restRes.data[0]._id || restRes.data[0].id;

  // 3. Vault Init (Admin)
  const vaultRes = await request('ADMIN VAULT INIT', '/admin/vault/new', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify({ name: 'Blast Reward', price: 0, originalPrice: 100, remainingCount: 1, streakRequirement: 0 })
  });
  if (vaultRes.ok) VAULT_ID = vaultRes.data._id;

  // 4. Vault Claim (Customer)
  if (CUSTOMER_TOKEN && VAULT_ID) {
    await request('CUSTOMER VAULT CLAIM', `/vault/claim/${VAULT_ID}`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${CUSTOMER_TOKEN}` }
    });
  }

  // 5. Order Placement
  let orderId = '';
  if (CUSTOMER_TOKEN && RESTAURANT_ID) {
    const orderRes = await request('CUSTOMER ORDER', '/orders', {
      method: 'POST', headers: { 'Authorization': `Bearer ${CUSTOMER_TOKEN}` },
      body: JSON.stringify({ 
        restaurantId: RESTAURANT_ID,
        items: [{ menuItemId: 'test-item', name: 'Test', price: 100, quantity: 1 }],
        totalPrice: 100, finalPrice: 100, deliveryFee: 0, platformFee: 0,
        deliverySlot: '1:00 PM', deliveryLocation: { lat: 16, lng: 80 }
      })
    });
    if (orderRes.ok) orderId = orderRes.data._id;
  }

  // 6. Admin Stats
  await request('ADMIN STATS', '/admin/stats', { headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` } });

  // 7. Rider / Delivery Status
  if (orderId) {
    await request('RIDER/ADMIN DELIVER', `/orders/${orderId}/status`, {
      method: 'PUT', headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ status: 'Delivered' })
    });
  }

  // 8. Delete operations (cleanup)
  if (VAULT_ID) {
    await request('ADMIN VAULT DELETE', `/admin/vault/${VAULT_ID}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    });
  }

  console.log(`\n============== STRESS TEST COMPLETE ==============`);
  console.log(`Total Errors Discovered: ${errorsFound}`);
  process.exit(errorsFound > 0 ? 1 : 0);
}

blast();
