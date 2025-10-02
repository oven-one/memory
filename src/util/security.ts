/**
 * Security utilities
 * Password generation and other security helpers
 */

import { randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure random password
 *
 * Password characteristics:
 * - 32 characters long
 * - Includes uppercase, lowercase, numbers, and special characters
 * - Cryptographically random using Node.js crypto module
 *
 * @returns Secure random password
 *
 * @example
 * ```typescript
 * const password = generateSecurePassword();
 * // Example output: "aB3$xY9@pQ2#mN7&kL5!wR8%hF4^jD1*"
 * ```
 */
export const generateSecurePassword = (): string => {
  // Character sets
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;

  // Generate random bytes
  const length = 32;
  const randomValues = randomBytes(length);

  // Build password ensuring at least one character from each set
  let password = '';

  // Add at least one from each set
  password += uppercase[randomValues[0] % uppercase.length];
  password += lowercase[randomValues[1] % lowercase.length];
  password += numbers[randomValues[2] % numbers.length];
  password += special[randomValues[3] % special.length];

  // Fill the rest with random characters from all sets
  for (let i = 4; i < length; i++) {
    password += allChars[randomValues[i] % allChars.length];
  }

  // Shuffle the password to avoid predictable pattern
  return shuffleString(password);
};

/**
 * Shuffle a string randomly
 *
 * @param str - String to shuffle
 * @returns Shuffled string
 */
const shuffleString = (str: string): string => {
  const arr = str.split('');
  const randomValues = randomBytes(arr.length);

  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomValues[i] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr.join('');
};
