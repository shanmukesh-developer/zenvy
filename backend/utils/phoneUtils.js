/**
 * Normalizes phone numbers to a consistent 10-digit format for database storage
 * and a prefixed +91 format for Firebase verification.
 */
const normalizePhone = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-10);
};

const formatForFirebase = (phone) => {
  const digits = normalizePhone(phone);
  return `+91${digits}`;
};

module.exports = { normalizePhone, formatForFirebase };
