const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  try {
    const serviceAccountPath = path.join(__dirname, '..', 'firebase-key.json');
    
    // 1. Try environment variables first
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      console.log(`[FIREBASE_DEBUG] Raw Key length: ${privateKey?.length}`);

      // 1. Double Unescape / JSON Parse attempt
      // If the key is wrapped in quotes or looks like a JSON string, try to parse it
      if (privateKey.startsWith('"') || privateKey.startsWith('{')) {
        try { 
          const parsed = JSON.parse(privateKey);
          privateKey = typeof parsed === 'object' ? parsed.private_key : parsed;
          console.log('[FIREBASE_DEBUG] Key was JSON-encoded, parsed successfully.');
        } catch (_) { /* not valid JSON, proceed with normal string cleaning */ }
      }

      // 2. Handle Base64 encoding
      if (privateKey.startsWith('LS0tLS1') || (privateKey.length > 0 && !privateKey.includes('-----BEGIN PRIVATE KEY-----'))) {
        try {
          privateKey = Buffer.from(privateKey.replace(/\s+/g, ''), 'base64').toString('utf8');
          console.log('[FIREBASE_DEBUG] Deduced Base64 encoding, decoded successfully.');
        } catch (e) {
          console.error('❌ Failed to decode Base64 Firebase Key');
        }
      }

      // 3. Ultimate PEM Reconstruction
      const header = '-----BEGIN PRIVATE KEY-----';
      const footer = '-----END PRIVATE KEY-----';
      
      // Extract only the core base64 body, discarding any headers, footers, literal \n, or actual newlines
      let body = privateKey
        .replace(/-----BEGIN[^-]*-----/gi, '')
        .replace(/-----END[^-]*-----/gi, '')
        .replace(/\\n/g, '') 
        .replace(/\r?\n|\r/g, '')
        .replace(/\s+/g, '')
        .trim();

      if (body.length > 0) {
        // Re-chunk exactly 64 characters per line (Canonical PEM format)
        const chunks = body.match(/.{1,64}/g);
        const formattedKey = `${header}\n${chunks.join('\n')}\n${footer}`;
        
        try {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: formattedKey
            })
          });
          console.log('✅ Firebase Admin initialized via Environment Variables (Robust Mode).');
        } catch (certError) {
          console.error('❌ Firebase Cert Error (ENV):', certError.message);
          console.error(`[FIREBASE_DEBUG] Failed Key Structure: Start="${formattedKey.substring(0, 30)}..." End="..." Length=${formattedKey.length}`);
        }
      } else {
        console.warn('⚠️ FIREBASE_PRIVATE_KEY body empty after cleaning. Check your environment variables.');
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
