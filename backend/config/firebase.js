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
          // If we already have a default app from a previous attempt, delete it to retry
          if (admin.apps.length > 0) {
            // We only want to delete if it's the default app or if we're trying to set a new one
            // Easier: just wrap the whole thing.
          }

          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: keyStr
            })
          });
          console.log(`✅ Firebase Success: ${label} (Initialized as Default App)`);
          return true;
        } catch (e) {
          console.warn(`[FIREBASE_TRY_FAIL] ${label}: ${e.message}`);
          // Clear apps if it failed so next attempt is fresh
          while (admin.apps.length > 0) {
             admin.app().delete().catch(() => {});
          }
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

      // D. Reconstruction (The Final Shield)
      // We'll try to extract JUST the base64 body and rebuild it with clean headers
      const headerMarker = '-----BEGIN PRIVATE KEY-----';
      const footerMarker = '-----END PRIVATE KEY-----';
      const body = k
        .replace(/-----BEGIN[^-]*-----/gi, '')
        .replace(/-----END[^-]*-----/gi, '')
        .replace(/[^a-zA-Z0-9+/=]/g, '')
        .trim();
      
      const reconstructed = body.length > 100 
        ? `${headerMarker}\n${(body.match(/.{1,64}/g) || []).join('\n')}\n${footerMarker}\n`
        : null;

      // Execution Pipeline
      let initialized = false;
      // Preference 1: Reconstructed (Cleanest)
      if (!initialized && reconstructed && tryCert(reconstructed, 'Pipeline (Reconstructed)')) initialized = true;
      // Preference 2: Stripped/Normalized
      if (!initialized && tryCert(k, 'Pipeline (Stripped)')) initialized = true;
      // Preference 3: Raw Literal Fix
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
