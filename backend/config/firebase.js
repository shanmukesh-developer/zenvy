const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  try {
    const serviceAccountPath = path.join(__dirname, '..', 'firebase-key.json');
    
    // 0. Base64 Encoded Full Service Account JSON (SAFEST METHOD)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      try {
        const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
        const serviceAccount = JSON.parse(decoded);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log('✅ Firebase Admin initialized via FIREBASE_SERVICE_ACCOUNT_BASE64');
        module.exports = admin;
        return;
      } catch (err) {
        console.error('❌ Failed to initialize via FIREBASE_SERVICE_ACCOUNT_BASE64:', err.message);
      }
    }

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
        s = s.replace(/\\n/g, '\n').replace(/\\r/g, '');
        
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

        // 3. Extract core PEM body (Hyper-precise Split)
        const header = '-----BEGIN PRIVATE KEY-----';
        const footer = '-----END PRIVATE KEY-----';
        
        // Split by dashes and find the large block that isn't a header/footer
        const parts = s.split('-----').map(p => p.trim()).filter(p => 
          p.length > 500 && 
          !p.includes('BEGIN') && 
          !p.includes('END') && 
          !p.includes('PRIVATE')
        );
        
        let body = parts[0] || '';

        // Common fix for + being converted to space
        if (body.includes(' ')) {
          const spaceCount = (body.match(/ /g) || []).length;
          console.log(`[FIREBASE_FIX] Replacing ${spaceCount} spaces with +`);
          body = body.replace(/ /g, '+');
        }

        body = body.replace(/[^a-zA-Z0-9+/=]/g, '').trim();

        if (body.length < 500) return null;
        console.log(`[FIREBASE_BODY] Cleaned body length: ${body.length}`);
        console.log(`[FIREBASE_BODY_TAIL] Tail: ...${body.substring(body.length - 20)}`);
        
        // 4. Final Reconstruction Helper
        const buildPemHelper = (b) => {
          return `${header}\n${(b.match(/.{1,64}/g) || []).join('\n')}\n${footer}\n`;
        }
        return buildPemHelper(body);
      };

      const finalKey = cleanKey(rawKey);
      let initialized = false;

      // Try 1: Final Pillar (Optimized)
      if (finalKey && tryCert(finalKey, 'Final Pillar')) {
        initialized = true;
      } 
      
      // Try 2 & 3: Padding Repair (Common for truncated ENV vars)
      if (!initialized && finalKey) {
        // Extract body by stripping headers and space
        const header = '-----BEGIN PRIVATE KEY-----';
        const footer = '-----END PRIVATE KEY-----';
        const bodyOnly = finalKey
          .replace(header, '')
          .replace(footer, '')
          .replace(/\s/g, '');

        const buildPemHelper = (b) => `${header}\n${(b.match(/.{1,64}/g) || []).join('\n')}\n${footer}\n`;
        const buildRsaPem = (b) => `-----BEGIN RSA PRIVATE KEY-----\n${(b.match(/.{1,64}/g) || []).join('\n')}\n-----END RSA PRIVATE KEY-----\n`;

        if (tryCert(buildPemHelper(bodyOnly + '='), 'Pillar +1 Padding')) initialized = true;
        if (!initialized && tryCert(buildPemHelper(bodyOnly + '=='), 'Pillar +2 Padding')) initialized = true;
        if (!initialized && tryCert(buildRsaPem(bodyOnly), 'RSA Variant (PKCS1)')) initialized = true;
      }

      // Try 5: Literal Fallback
      if (!initialized) {
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
