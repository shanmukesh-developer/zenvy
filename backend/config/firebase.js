const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  try {
    const serviceAccountPath = path.join(__dirname, '..', 'firebase-key.json');
    
    // 1. Try environment variables first (More robust for container/cloud environments)
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      // 1. Strip surrounding quotes and whitespace
      privateKey = privateKey.replace(/^["']|["']$/g, '').trim();

      // 2. Handle Base64 encoding
      if (privateKey.startsWith('LS0tLS1') || (privateKey.length > 0 && !privateKey.includes('-----BEGIN PRIVATE KEY-----'))) {
        try {
          // Strip all whitespace/newlines that might have been introduced by .env wrapping
          privateKey = privateKey.replace(/\s+/g, '');
          privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
        } catch (e) {
          console.error('❌ Failed to decode Base64 Firebase Key');
        }
      }

      // 3. Ensure the result is a clean PEM with proper newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
      
      if (privateKey.includes('-----BEGIN PRIVATE KEY-----') && !privateKey.includes('\n')) {
          privateKey = privateKey.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
                                 .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
      }

      // Final Guard: Check length after all cleaning
      if (privateKey && privateKey.trim().length > 100) {
        try {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: privateKey
            })
          });
          console.log('✅ Firebase Admin initialized via Environment Variables.');
        } catch (certError) {
          console.error('❌ Firebase Cert Error (ENV):', certError.message);
          // Don't throw here, let it fallback or just skip
        }
      } else {
        console.warn('⚠️ FIREBASE_PRIVATE_KEY too short after cleaning. Skipping ENV initialization.');
      }
    } 
    // 2. Fallback to local JSON file
    else if (fs.existsSync(serviceAccountPath)) {
      try {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log('✅ Firebase Admin initialized via firebase-key.json');
      } catch (jsonCertError) {
        console.error('❌ Firebase Cert Error (JSON):', jsonCertError.message);
      }
    } else {
      console.warn('⚠️ No Firebase credentials found (ENV or JSON). Real-time push notifications will be disabled.');
    }
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error.message);
  }
}

module.exports = admin;
