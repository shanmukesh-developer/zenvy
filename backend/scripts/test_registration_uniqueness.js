const axios = require('axios');

async function testRegistration() {
    const API_URL = 'http://localhost:5005/api/users/register';
    const testPhone = '1111111111';
    
    console.log('--- Testing Registration Uniqueness ---');
    
    // 1. Create User A
    try {
        console.log('Creating User A (Unique Name, Phone 1111111111)...');
        await axios.post(API_URL, {
            name: 'User A',
            phone: testPhone,
            password: 'password123',
            firebaseToken: 'E2E_MOCK_TOKEN'
        });
        console.log('✅ User A created.');
    } catch (e) {
        console.log('User A creation failed (maybe already exists):', e.response?.data?.message || e.message);
    }

    // 2. Create User B with SAME phone but DIFFERENT name
    try {
        console.log('Creating User B (New Name, SAME Phone 1111111111)...');
        await axios.post(API_URL, {
            name: 'User B',
            phone: testPhone,
            password: 'password123',
            firebaseToken: 'E2E_MOCK_TOKEN'
        });
        console.log('✅ User B created (Success! Multiple accounts per phone allowed).');
    } catch (e) {
        console.error('❌ User B creation failed:', e.response?.data?.message || e.message);
    }

    // 3. Create User C with SAME name as User A
    try {
        console.log('Creating User C (SAME Name "User A")...');
        await axios.post(API_URL, {
            name: 'User A',
            phone: '2222222222',
            password: 'password123',
            firebaseToken: 'E2E_MOCK_TOKEN'
        });
        console.error('❌ User C created (Fail! Duplicate names should be blocked).');
    } catch (e) {
        console.log('✅ User C creation blocked:', e.response?.data?.message || e.message);
    }
}

testRegistration();
