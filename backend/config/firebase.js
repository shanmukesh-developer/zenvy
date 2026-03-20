const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  try {
    const serviceAccountPath = path.join(__dirname, '..', 'firebase-key.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized successfully from JSON file.');
    } else {
      console.warn('firebase-key.json not found. Skipping Firebase initialization.');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error (Skipping):', error.message);
  }
}

module.exports = admin;
