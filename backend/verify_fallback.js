const axios = require('axios');

async function verifyFallback() {
  const vaultId = '8ed24fe9-9557-4c22-bc3f-d4b90d327727';
  const url = `http://localhost:5005/api/admin/menu/${vaultId}`;
  
  try {
    const response = await axios.get(url);
    console.log('✅ Fallback Verified!');
    console.log('Data:', JSON.stringify(response.data, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('❌ Fallback Failed:', err.response ? err.response.status : err.message);
    process.exit(1);
  }
}

verifyFallback();
