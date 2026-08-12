// ============================================================
// Ordinex — Hash Utility
// SHA-256 hashing for blockchain record integrity.
// ============================================================
import crypto from 'crypto';

/**
 * Create a SHA-256 hash of the given data.
 * @param {string|object} data - String or object to hash
 * @returns {string} Hex-encoded SHA-256 hash
 */
export function sha256(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Generate a random 6-digit OTP code.
 * @returns {string} 6-digit string (zero-padded)
 */
export function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

