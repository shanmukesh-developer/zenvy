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
      const cleanKey = (raw) => {
        if (!raw) return null;
        let s = raw.replace(/^["']|["']$/g, '').trim();
        
        // 1. Detect and decode base64 wrapper if present
        if (!s.includes('-----') && s.length > 500) {
          try {
            const decoded = Buffer.from(s, 'base64').toString('utf8');
            if (decoded.includes('-----') || decoded.includes('{')) {
              console.log('[FIREBASE_B64] Decoding detected.');
              s = decoded;
            }
          } catch (_) {}
        }

        // 2. Extract from JSON noise if needed
        if (s.includes('{') && s.includes('}')) {
          try {
            const start = s.indexOf('{');
            const end = s.lastIndexOf('}') + 1;
            const parsed = JSON.parse(s.substring(start, end));
            s = parsed.private_key || parsed.privateKey || s;
          } catch (_) {}
        }

        // 3. Extract core PEM body
        const header = '-----BEGIN PRIVATE KEY-----';
        const footer = '-----END PRIVATE KEY-----';
        const body = s.replace(/-----BEGIN[^-]*-----/gi, '')
                      .replace(/-----END[^-]*-----/gi, '')
                      .replace(/[^a-zA-Z0-9+/=]/g, '')
                      .trim();

        if (body.length < 500) return null;
        console.log(`[FIREBASE_BODY] Cleaned body length: ${body.length}`);
        
        // 4. Final Reconstruction
        return `${header}\n${body.match(/.{1,64}/g).join('\n')}\n${footer}\n`;
      };

      const finalKey = cleanKey(rawKey);
      let initialized = false;

      if (finalKey && tryCert(finalKey, 'Final Pillar')) {
        initialized = true;
      } else {
        // One last-ditch effort: maybe it's just raw literal
        const literal = rawKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '');
        if (tryCert(literal, 'Literal Fallback')) initialized = true;
      }
      
      if (!initialized) {
        console.warn('⚠️ FIREBASE_ENV_FAIL: All environment attempts failed. Checking JSON...');
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
