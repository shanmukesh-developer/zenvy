const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  try {
    const serviceAccountPath = path.join(__dirname, '..', 'firebase-key.json');
    
    // 1. Try environment variables first
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      let rawKey = process.env.FIREBASE_PRIVATE_KEY;
      console.log(`[FIREBASE_DEBUG] Raw Key length: ${rawKey?.length}`);

      const attemptInit = (key, label) => {
        try {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: key
            })
          });
          console.log(`✅ Firebase Admin initialized via ${label}.`);
          return true;
        } catch (e) {
          console.error(`❌ Firebase Init Failed (${label}):`, e.message);
          return false;
        }
      };

      // 1. Double Unescape / JSON Parse attempt
      let processedKey = rawKey;
      if (processedKey.startsWith('"') || processedKey.startsWith('{')) {
        try { 
          const parsed = JSON.parse(processedKey);
          processedKey = typeof parsed === 'object' ? (parsed.private_key || parsed.privateKey) : parsed;
          console.log('[FIREBASE_DEBUG] Parsed JSON-encoded key.');
        } catch (_) {}
      }

      // 2. Handle Base64 encoding
      if (processedKey.startsWith('LS0tLS1') || (processedKey.length > 0 && !processedKey.includes('-----BEGIN PRIVATE KEY-----'))) {
        try {
          processedKey = Buffer.from(processedKey.replace(/\s+/g, ''), 'base64').toString('utf8');
          console.log('[FIREBASE_DEBUG] Decoded Base64 key.');
        } catch (_) {}
      }

      // 3. Robust Newline Normalization (The most common fix)
      const normalizedKey = processedKey.replace(/\\n/g, '\n');

      // 4. Ultimate Reconstruction Fallback (The aggressive fix)
      const header = '-----BEGIN PRIVATE KEY-----';
      const footer = '-----END PRIVATE KEY-----';
      const body = processedKey
        .replace(/-----BEGIN[^-]*-----/gi, '')
        .replace(/-----END[^-]*-----/gi, '')
        .replace(/\\n/g, '')
        .replace(/\s+/g, '')
        .trim();

      const chunkedKey = body.length > 0 
        ? `${header}\n${body.match(/.{1,64}/g).join('\n')}\n${footer}`
        : null;

      // Try initializations in order of likelihood
      if (attemptInit(normalizedKey, 'ENV (Normalized)')) return;
      if (chunkedKey && attemptInit(chunkedKey, 'ENV (Reconstructed)')) return;
      if (attemptInit(rawKey, 'ENV (Raw)')) return;

      console.error('[FIREBASE_DEBUG] All ENV initialization attempts failed.');
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
