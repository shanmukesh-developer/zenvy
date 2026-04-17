/**
 * Normalizes phone numbers to a consistent 10-digit format for database storage
 * and a prefixed +91 format for Firebase verification.
 * 
 * Update: If the input contains letters (e.g. "driver-1"), it is treated as a 
 * legacy or test identifier and returned as-is without stripping non-digits.
 */
const normalizePhone = (phone) => {
  if (!phone) return '';
  
  // If it contains letters, don't strip anything (e.g. "driver-1", "rider")
  if (/[a-zA-Z]/.test(phone)) {
    return phone;
  }
  
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-10);
};

const formatForFirebase = (phone) => {
  const digits = normalizePhone(phone);
  // If normalization returned letters, it's not a valid firebase phone anyway
  return `+91${digits}`;
};

module.exports = { normalizePhone, formatForFirebase };
