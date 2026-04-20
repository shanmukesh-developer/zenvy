const fs = require('fs');
const path = require('path');

const keyPath = path.join(__dirname, '..', 'firebase-key.json');

if (!fs.existsSync(keyPath)) {
  console.error('❌ Error: firebase-key.json not found in backend directory.');
  process.exit(1);
}

try {
  const keyFile = fs.readFileSync(keyPath, 'utf8');
  const key = JSON.parse(keyFile);

  console.log('\n--- FIREBASE ENVIRONMENT VARIABLES FOR RENDER ---\n');
  console.log(`FIREBASE_PROJECT_ID: ${key.project_id}`);
  console.log(`FIREBASE_CLIENT_EMAIL: ${key.client_email}`);
  
  // Base64 encode the private key to avoid newline issues in Render ENV vars
  const privateKeyBase64 = Buffer.from(key.private_key).toString('base64');
  console.log(`FIREBASE_PRIVATE_KEY (Base64): ${privateKeyBase64}`);
  
  console.log('\n--- OR USE THE FULL ACCOUNT JSON BASE64 ---\n');
  const fullBase64 = Buffer.from(keyFile).toString('base64');
  console.log(`FIREBASE_SERVICE_ACCOUNT_BASE64: ${fullBase64}`);
  
  console.log('\n-----------------------------------------------\n');
} catch (err) {
  console.error('❌ Error parsing firebase-key.json:', err.message);
  process.exit(1);
}
