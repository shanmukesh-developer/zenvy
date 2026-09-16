const crypto = require('crypto');

// Ensure key is exactly 32 bytes (SHA-256 of JWT_SECRET)
const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('[CRYPTO_FATAL] JWT_SECRET is not configured. Encryption will fail.');
}
const ENCRYPTION_KEY = crypto.createHash('sha256').update(secret || 'MISSING_SECRET_WILL_FAIL').digest(); 
const IV_LENGTH = 16; // For AES-256-CBC

/**
 * Encrypt cleartext into formatted string 'iv_hex:ciphertext_hex'
 * @param {string} text 
 * @returns {string}
 */
function encryptText(text) {
  if (!text) return '';
  
  // Prevent double-encryption by checking if it already matches our format
  if (text.includes(':')) {
    const parts = text.split(':');
    if (parts[0].length === 32 && /^[0-9a-fA-F]+$/.test(parts[0])) {
      return text;
    }
  }

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('[CRYPTO_ENCRYPT_FAIL] Failed to encrypt message:', error.message);
    return text; // Fallback to plain text on encryption failure
  }
}

/**
 * Decrypt formatted cipherText 'iv_hex:ciphertext_hex' back into cleartext
 * @param {string} cipherText 
 * @returns {string}
 */
function decryptText(cipherText) {
  if (!cipherText) return '';
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 2) {
      // Fallback if message wasn't encrypted (e.g. legacy/system messages)
      return cipherText;
    }
    const ivHex = parts[0];
    // IV must be exactly 16 bytes = 32 hex chars; otherwise treat as unencrypted
    if (ivHex.length !== 32 || !/^[0-9a-fA-F]+$/.test(ivHex)) {
      return cipherText;
    }
    // Check if ciphertext part is valid hex
    if (!/^[0-9a-fA-F]*$/.test(parts[1])) {
      return cipherText;
    }

    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[CRYPTO_DECRYPT_FAIL] Failed to decrypt message:', err.message);
    return '[Decryption Failed - Encryption Keys Out of Sync]';
  }
}

module.exports = {
  encryptText,
  decryptText
};
