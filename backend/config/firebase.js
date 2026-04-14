const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  try {
    const serviceAccountPath = path.join(__dirname, '..', 'firebase-key.json');
    
    // 1. Try environment variables first
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      let k = process.env.FIREBASE_PRIVATE_KEY;
      console.log(`[FIREBASE_LEVEL5] Received key. length: ${k?.length}, startsWith: ${k?.substring(0, 20)}`);

      const tryCert = (keyStr, label) => {
        if (!keyStr || keyStr.length < 100) return false;
        try {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: keyStr
            })
          }, label); // Added label to distinguish apps if needed, though usually just one
          console.log(`✅ Firebase Success: ${label}`);
          return true;
        } catch (e) {
          // console.error(`❌ Firebase Fail: ${label} - ${e.message}`);
          return false;
        }
      };

      // --- Multi-Pass Cleaning Pipeline ---
      
      // Pass 1: JSON/Quote stripping
      if (k.startsWith('"') || k.startsWith('{')) {
        try { const p = JSON.parse(k); k = typeof p === 'object' ? (p.private_key || p.privateKey) : p; } catch(_) { /* ignore */ }
      }
      k = k.replace(/^["']|["']$/g, '').trim();

      // Pass 2: Base64 multi-pass decoding
      let base64Decoded = k;
      for (let i = 0; i < 3; i++) {
        if (base64Decoded.startsWith('LS0tLS1') || (base64Decoded.length > 500 && !base64Decoded.includes('---'))) {
          try {
            const next = Buffer.from(base64Decoded.replace(/\s+/g, ''), 'base64').toString('utf8');
            if (next.length > 100) base64Decoded = next;
          } catch (_) { break; }
        } else break;
      }

      // Pass 3: Newline/Escape Normalization
      const normalized = base64Decoded
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\r/g, '')
        .trim();

      // Pass 4: Reconstruction (The Forge-friendly format)
      const header = '-----BEGIN PRIVATE KEY-----';
      const footer = '-----END PRIVATE KEY-----';
      const body = normalized
        .replace(/-----BEGIN[^-]*-----/gi, '')
        .replace(/-----END[^-]*-----/gi, '')
        .replace(/[^a-zA-Z0-9+/=]/g, '') // Stripping ALL non-base64 noise
        .trim();

      const reconstructed = body.length > 100 
        ? `${header}\n${body.match(/.{1,64}/g).join('\n')}\n${footer}`
        : null;

      // Final Attempt Chain
      if (tryCert(normalized, 'Pipeline (Normalized)')) return;
      if (reconstructed && tryCert(reconstructed, 'Pipeline (Reconstructed)')) return;
      if (tryCert(base64Decoded, 'Pipeline (B64-Decoded)')) return;
      if (tryCert(k, 'Pipeline (Pre-Cleaned)')) return;
      if (tryCert(process.env.FIREBASE_PRIVATE_KEY, 'Pipeline (Raw)')) return;

      console.error('❌ FIREBASE_FATAL: All 5 initialization layers failed for the provided environment variable.');
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
