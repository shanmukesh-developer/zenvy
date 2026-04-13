/* eslint-disable */
const axios = require('axios');

const API_URL = 'http://127.0.0.1:5005';
const ORDER_ID = '068a9e9f-5da8-4549-8cda-91784616df5a'; // Use same test order if it exists or create one
const RIDER_A_TOKEN = '...'; 
const RIDER_B_TOKEN = '...'; 

async function testRace() {
    console.log('--- STARTING CONCURRENCY RACE TEST ---');
    
    const req1 = axios.put(`${API_URL}/api/delivery/orders/${ORDER_ID}/accept`, {}, {
        headers: { 'Authorization': `Bearer ${RIDER_A_TOKEN}` }
    }).catch(e => ({ status: e.response?.status, data: e.response?.data }));

    const req2 = axios.put(`${API_URL}/api/delivery/orders/${ORDER_ID}/accept`, {}, {
        headers: { 'Authorization': `Bearer ${RIDER_B_TOKEN}` }
    }).catch(e => ({ status: e.response?.status, data: e.response?.data }));

    const [res1, res2] = await Promise.all([req1, req2]);

    console.log('RIDER A:', res1.status, res1.data);
    console.log('RIDER B:', res2.status, res2.data);

    if (res1.status === 200 && res2.status === 200) {
        console.error('❌ FAIL: Both riders accepted the same order!');
    } else {
        console.log('✅ PASS: Only one rider could claim the order.');
    }
}

// testRace();
