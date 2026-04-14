const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Domains to ensure are whitelisted
const DOMAINS_TO_WHITELIST = [
  'localhost',
  '127.0.0.1',
  'zenvy-customer.vercel.app',
  'zenvy-admin.vercel.app',
  'zenvy-rider.vercel.app',
  'zenvy-restaurant.vercel.app',
  'hostelbites-customer.vercel.app',
  'hostelbites-admin.vercel.app',
  'hostelbites-delivery.vercel.app',
  'hostelbites-restaurant.vercel.app'
];

async function run() {
  console.log('🚀 Starting Firebase Domain Whitelisting...');

  const keyPath = path.join(__dirname, '..', 'firebase-key.json');
  if (!fs.existsSync(keyPath)) {
    console.error('❌ Error: firebase-key.json not found in backend root.');
    process.exit(1);
  }

  const serviceAccount = require(keyPath);
  const projectId = serviceAccount.project_id;

  try {
    const auth = new GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;

    console.log(`📡 Fetching current config for project: ${projectId}...`);
    
    // API: https://cloud.google.com/identity-platform/docs/reference/rest/v2/projects/getConfig
    const configUrl = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`;
    
    const response = await axios.get(configUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const currentDomains = response.data.authorizedDomains || [];
    console.log('✅ Current domains:', currentDomains);

    const updatedDomains = [...new Set([...currentDomains, ...DOMAINS_TO_WHITELIST])];

    if (updatedDomains.length === currentDomains.length) {
      console.log('✨ All domains already whitelisted. No changes needed.');
      return;
    }

    console.log('📝 Updating authorized domains...');
    await axios.patch(`${configUrl}?updateMask=authorizedDomains`, 
      { authorizedDomains: updatedDomains },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('🎉 Successfully updated domains!');
    console.log('New List:', updatedDomains);

  } catch (error) {
    console.error('❌ Whitelisting failed:');
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

run();
