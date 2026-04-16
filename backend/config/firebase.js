const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  try {
    const serviceAccountPath = path.join(__dirname, '..', 'firebase-key.json');
    
    // 1. Try environment variables with Greed/Robust cleaning
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      let rawKey = process.env.FIREBASE_PRIVATE_KEY;
      console.log(`[FIREBASE_LEVEL5] Received key. length: ${rawKey?.length}, startsWith: ${rawKey?.substring(0, 30)}`);

      const tryCert = (keyStr, label) => {
        if (!keyStr || keyStr.length < 100) return false;
        try {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: keyStr
            })
          }, label);
          console.log(`✅ Firebase Success: ${label}`);
          return true;
        } catch (e) {
          console.warn(`[FIREBASE_TRY_FAIL] ${label}: ${e.message}`);
          return false;
        }
      };

      // --- ULTRAROBUST EXTRACTION ENGINE ---
      let k = rawKey;

      // X. Base64 Detection & Decoding
      if (!k.includes('-----') && k.length > 500) {
        try {
          const decoded = Buffer.from(k, 'base64').toString('utf8');
          if (decoded.includes('-----') || decoded.includes('{')) {
             console.log('[FIREBASE_BASE64] Base64 key detected and decoded.');
             k = decoded;
          }
        } catch (_) { /* not base64 */ }
      }

      // A. Extract JSON if wrapped in noise (Handles 6000+ char noise)
      if (k.includes('{') && k.includes('}')) {
        try {
          const start = k.indexOf('{');
          const end = k.lastIndexOf('}') + 1;
          const jsonSection = k.substring(start, end);
          const parsed = JSON.parse(jsonSection);
          const extracted = parsed.private_key || parsed.privateKey;
          if (extracted) k = extracted;
        } catch (_) { /* fallback to PEM extraction */ }
      }

      // B. Extract PEM if wrapped in noise
      const headerMarker = '-----BEGIN PRIVATE KEY-----';
      const footerMarker = '-----END PRIVATE KEY-----';
      if (k.includes(headerMarker) && k.includes(footerMarker)) {
        const start = k.indexOf(headerMarker);
        const end = k.indexOf(footerMarker) + footerMarker.length;
        k = k.substring(start, end);
      }

      // C. Universal Normalization
      k = k.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/^["']|["']$/g, '').trim();

      // D. Reconstruction (The Final Shield)
      const body = k
        .replace(/-----BEGIN[^-]*-----/gi, '')
        .replace(/-----END[^-]*-----/gi, '')
        .replace(/[^a-zA-Z0-9+/=]/g, '')
        .trim();
      
      const reconstructed = body.length > 100 
        ? `${headerMarker}\n${body.match(/.{1,64}/g).join('\n')}\n${footerMarker}`
        : null;

      // Execution Pipeline
      let initialized = false;
      if (!initialized && tryCert(k, 'Pipeline (Stripped)')) initialized = true;
      if (!initialized && reconstructed && tryCert(reconstructed, 'Pipeline (Reconstructed)')) initialized = true;
      if (!initialized && tryCert(rawKey.replace(/\\n/g, '\n'), 'Pipeline (Literal-Fix)')) initialized = true;
      
      if (!initialized) {
        console.warn('⚠️ FIREBASE_ENV_FAIL: Environment variables provided but invalid. Checking JSON fallback...');
      } else {
        return; // Success
      }
    } 
    
    // 2. Fallback to local JSON file
    if (fs.existsSync(serviceAccountPath)) {
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
