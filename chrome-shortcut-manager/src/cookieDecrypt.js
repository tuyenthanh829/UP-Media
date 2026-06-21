/**
 * Chrome cookie decryption for Windows.
 *
 * Chrome 80+ encrypts cookie values with AES-256-GCM.
 * The AES master key is stored (DPAPI-encrypted) in Local State.
 *
 * Flow:
 *   1. Read Local State → get base64-encoded DPAPI-wrapped key
 *   2. Strip the "DPAPI" 5-byte prefix
 *   3. Decrypt with Windows DPAPI (CurrentUser scope) via PowerShell
 *   4. Use resulting 32-byte AES key to decrypt cookie values (AES-256-GCM)
 */

const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Cache per userDataPath — one PowerShell call per Chrome installation
const _keyCache = new Map();

/**
 * Extract and decrypt Chrome's AES master key from Local State.
 * @param {string} userDataPath  e.g. C:\Users\...\Chrome\User Data
 * @returns {Buffer|null}        32-byte AES key, or null if unavailable
 */
function getChromeMasterKey(userDataPath) {
  if (_keyCache.has(userDataPath)) return _keyCache.get(userDataPath);

  const localStatePath = path.join(userDataPath, 'Local State');
  if (!fs.existsSync(localStatePath)) { _keyCache.set(userDataPath, null); return null; }

  try {
    const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
    const encB64 = localState?.os_crypt?.encrypted_key;
    if (!encB64) { _keyCache.set(userDataPath, null); return null; }

    // Remove 5-byte "DPAPI" ASCII prefix prepended by Chrome before storing
    const encKey = Buffer.from(encB64, 'base64').slice(5);
    const encKeyB64 = encKey.toString('base64'); // safe: only A-Za-z0-9+/=

    // Decrypt with Windows DPAPI (CurrentUser scope) via PowerShell
    const ps = [
      'Add-Type -AssemblyName System.Security;',
      `$d=[System.Security.Cryptography.ProtectedData]::Unprotect(`,
      `[System.Convert]::FromBase64String('${encKeyB64}'),`,
      `$null,`,
      `[System.Security.Cryptography.DataProtectionScope]::CurrentUser);`,
      `Write-Output ([System.Convert]::ToBase64String($d))`
    ].join(' ');

    const result = execSync(
      `powershell -NoProfile -NonInteractive -Command "${ps}"`,
      { encoding: 'utf8', timeout: 6000 }
    ).trim();

    const masterKey = Buffer.from(result, 'base64');
    if (masterKey.length !== 32) { _keyCache.set(userDataPath, null); return null; }

    _keyCache.set(userDataPath, masterKey);
    return masterKey;
  } catch {
    _keyCache.set(userDataPath, null);
    return null;
  }
}

/**
 * Decrypt a Chrome AES-256-GCM encrypted cookie value.
 * Encrypted blobs start with "v10" or "v11" followed by 12-byte nonce.
 *
 * @param {Buffer|Uint8Array} encryptedBlob  raw encrypted_value bytes from SQLite
 * @param {Buffer}            masterKey      32-byte AES key from getChromeMasterKey
 * @returns {string|null}                    decrypted string, or null on failure
 */
function decryptCookieValue(encryptedBlob, masterKey) {
  if (!masterKey || !encryptedBlob) return null;

  const buf = Buffer.isBuffer(encryptedBlob)
    ? encryptedBlob
    : Buffer.from(encryptedBlob instanceof Uint8Array ? encryptedBlob : Object.values(encryptedBlob));

  if (buf.length < 19) return null; // 3 (prefix) + 12 (nonce) + 0+ (data) + 16 (tag) = min 31 for any real value

  const prefix = buf.slice(0, 3).toString('ascii');
  if (prefix !== 'v10' && prefix !== 'v11') return null;

  try {
    const nonce      = buf.slice(3, 15);            // 12 bytes
    const ciphertext = buf.slice(15, buf.length - 16);
    const tag        = buf.slice(buf.length - 16);  // 16 bytes GCM auth tag

    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/** Clear the key cache (e.g. after user switches Chrome installation). */
function clearKeyCache() { _keyCache.clear(); }

module.exports = { getChromeMasterKey, decryptCookieValue, clearKeyCache };
