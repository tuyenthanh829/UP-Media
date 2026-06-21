const fs = require('fs');
const path = require('path');
const os = require('os');
const cookieDecrypt = require('./cookieDecrypt');

/**
 * Cookie detection strategy per site:
 *  - cookieNames: the name(s) that definitively indicate a logged-in session.
 *    We verify both existence AND that the decrypted value is non-empty.
 *  - domains: all host variants Chrome may store the cookie under.
 *
 * REMOVED ttwid from TikTok — it persists after logout (device identifier, not session).
 */
const DEFAULT_SOCIAL_SITES = [
  {
    id: 'facebook',  name: 'Facebook',
    domain: 'facebook.com',
    cookieName: 'c_user',
    // c_user = numeric Facebook UID (non-empty only when logged in)
    cookieNames: ['c_user'],
  },
  {
    id: 'instagram', name: 'Instagram',
    domain: 'instagram.com',
    cookieName: 'sessionid',
    // ds_user_id = numeric IG UID; sessionid = session token
    cookieNames: ['sessionid', 'ds_user_id'],
  },
  {
    id: 'x',         name: 'X (Twitter)',
    domain: 'x.com',
    cookieName: 'auth_token',
    // Check both x.com AND twitter.com — old sessions still stored under twitter.com
    domains: ['x.com', 'twitter.com'],
    cookieNames: ['auth_token'],
  },
  {
    id: 'tiktok',   name: 'TikTok',
    domain: 'tiktok.com',
    cookieName: 'sessionid',
    // sid_tt is an alternative session key; ttwid is NOT included (persists after logout)
    cookieNames: ['sessionid', 'sid_tt'],
  },
  {
    id: 'threads',  name: 'Threads',
    domain: 'threads.net',
    cookieName: 'sessionid',
    cookieNames: ['sessionid'],
  },
  {
    id: 'linkedin', name: 'LinkedIn',
    domain: 'linkedin.com',
    cookieName: 'li_at',
    // li_at is THE LinkedIn session cookie — non-empty = logged in
    cookieNames: ['li_at'],
  },
  {
    id: 'chotot',   name: 'Chợ Tốt',
    domain: 'chotot.com',
    cookieName: 'access_token',
    cookieNames: ['access_token', 'at', 'token', 'user_token', 'chotot_token', 'auth_token', 'session'],
  },
];

// Chrome stores time as microseconds since 1601-01-01
// JS Date.now() is ms since 1970; offset between the two epochs is 11644473600 seconds
const CHROME_EPOCH_OFFSET_US = BigInt(11644473600) * BigInt(1_000_000);

function nowChromeTime() {
  // Use BigInt to avoid precision loss for large microsecond values
  return Number(BigInt(Date.now()) * BigInt(1000) + CHROME_EPOCH_OFFSET_US);
}

// ── sql.js singleton ─────────────────────────────────────
let _SQL = null;
async function getSql() {
  if (_SQL) return _SQL;
  const { app } = require('electron');
  const wasmDir = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist')
    : path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist');
  const initSqlJs = require('sql.js');
  _SQL = await initSqlJs({ locateFile: f => path.join(wasmDir, f) });
  return _SQL;
}

// ── SQLite WAL merger ─────────────────────────────────────
/**
 * Merge WAL file into main DB buffer so sql.js sees the latest data.
 * SQLite WAL format: 32-byte header + frames of (24-byte header + pageSize bytes).
 * We iterate frames, validate salt matches WAL header, apply latest page per page#.
 */
function mergeWalIntoDb(dbBuf, walBuf) {
  if (!walBuf || walBuf.length < 32) return dbBuf;

  const magic = walBuf.readUInt32BE(0);
  if (magic !== 0x377f0682 && magic !== 0x377f0683) return dbBuf;

  const pageSize = walBuf.readUInt32BE(8);
  if (pageSize < 512 || pageSize > 65536) return dbBuf;

  const salt1 = walBuf.readUInt32BE(16);
  const salt2 = walBuf.readUInt32BE(20);

  // Collect last valid frame per page number
  const pageMap = new Map(); // pageNum → Buffer(page data)
  let maxPageNum = 0;
  const frameSize = 24 + pageSize;
  let offset = 32;

  while (offset + frameSize <= walBuf.length) {
    const pageNum    = walBuf.readUInt32BE(offset);
    const frameSalt1 = walBuf.readUInt32BE(offset + 8);
    const frameSalt2 = walBuf.readUInt32BE(offset + 12);

    // Frames with mismatched salt are from a stale WAL cycle — stop
    if (frameSalt1 !== salt1 || frameSalt2 !== salt2) break;
    if (pageNum < 1) { offset += frameSize; continue; }

    pageMap.set(pageNum, walBuf.slice(offset + 24, offset + 24 + pageSize));
    if (pageNum > maxPageNum) maxPageNum = pageNum;
    offset += frameSize;
  }

  if (pageMap.size === 0) return dbBuf;

  // Expand result buffer if WAL introduces pages beyond current DB size
  const neededSize = maxPageNum * pageSize;
  const result = neededSize > dbBuf.length
    ? Buffer.concat([dbBuf, Buffer.alloc(neededSize - dbBuf.length)])
    : Buffer.from(dbBuf);

  for (const [pageNum, pageData] of pageMap) {
    pageData.copy(result, (pageNum - 1) * pageSize);
  }

  return result;
}

// ── Open cookie DB via temp copy (WAL-aware) ─────────────
async function withDb(profilePath, fn) {
  const cookieFile = [
    path.join(profilePath, 'Network', 'Cookies'),
    path.join(profilePath, 'Cookies'),
  ].find(p => fs.existsSync(p));

  if (!cookieFile) return null;

  const walSrc = cookieFile + '-wal';

  try {
    let dbBuf = fs.readFileSync(cookieFile);

    // Merge WAL if Chrome is currently running (WAL mode)
    if (fs.existsSync(walSrc)) {
      try {
        const walBuf = fs.readFileSync(walSrc);
        dbBuf = mergeWalIntoDb(dbBuf, walBuf);
      } catch { /* WAL merge failed, use main DB as-is */ }
    }

    const SQL = await getSql();
    const db = new SQL.Database(new Uint8Array(dbBuf));
    try { return await fn(db); }
    finally { db.close(); }
  } catch { return null; }
}

/**
 * Check if an encrypted_value blob from Chrome's cookie DB represents a valid (non-empty) session.
 * Returns true if:
 *   - masterKey available → decrypt and verify value is non-empty string
 *   - masterKey unavailable → blob is a v10/v11 Chrome-encrypted value (existence = session active)
 */
function isCookieValueValid(rawEncrypted, masterKey) {
  if (!rawEncrypted) return false;

  const buf = Buffer.isBuffer(rawEncrypted)
    ? rawEncrypted
    : Buffer.from(rawEncrypted instanceof Uint8Array ? rawEncrypted : Object.values(rawEncrypted));

  if (buf.length < 4) return false;

  if (masterKey) {
    const decrypted = cookieDecrypt.decryptCookieValue(buf, masterKey);
    return decrypted !== null && decrypted.length > 0;
  }

  // Fallback without decryption: check Chrome encryption prefix
  // v10/v11 = AES-256-GCM (Chrome 80-126), v20 = App-Bound Encryption (Chrome 127+)
  const prefix = buf.slice(0, 3).toString('ascii');
  return prefix === 'v10' || prefix === 'v11' || prefix === 'v20';
}

// ── Main detection ────────────────────────────────────────
/**
 * Check which social sites are logged in for a given Chrome profile.
 *
 * Detection quality (best → worst):
 *   1. DPAPI available → decrypt cookie value → verify non-empty → same accuracy as Gmail
 *   2. DPAPI unavailable → v10/v11 prefix + not expired → very good
 *   3. Fallback plaintext value (old Chrome / no encryption) → good
 *
 * @param {string}   profilePath  e.g. .../User Data/Profile 1
 * @param {object[]} sites        list of site configs (DEFAULT_SOCIAL_SITES or user-saved)
 * @returns {object} { siteId: { loggedIn, name, id, decrypted? } }
 */
async function getSocialStatus(profilePath, sites) {
  const result = {};
  for (const site of sites) {
    result[site.id] = { loggedIn: false, name: site.name, id: site.id };
  }

  // Derive User Data path from profile path (one level up)
  const userDataPath = path.dirname(profilePath);

  // Attempt DPAPI decryption — silent failure, falls back gracefully
  let masterKey = null;
  try { masterKey = cookieDecrypt.getChromeMasterKey(userDataPath); } catch { /* no DPAPI */ }

  const nowUs = nowChromeTime();

  const status = await withDb(profilePath, db => {
    const out = {};

    for (const site of sites) {
      try {
        const domains     = site.domains     || [site.domain];
        const cookieNames = (site.cookieNames || [site.cookieName]).filter(Boolean);
        if (!cookieNames.length) continue;

        const domainConds = domains.map(() => 'host_key LIKE ?').join(' OR ');
        const namePH      = cookieNames.map(() => '?').join(', ');

        // Select value AND encrypted_value; exclude expired cookies
        // expires_utc = 0  → session cookie (valid as long as browser is open)
        // expires_utc > 0  → persistent; must be in the future
        const sql = `
          SELECT name, value, encrypted_value, expires_utc
          FROM cookies
          WHERE (${domainConds})
            AND name IN (${namePH})
            AND (expires_utc = 0 OR expires_utc > ?)
          ORDER BY expires_utc DESC
          LIMIT 10
        `;
        const params = [...domains.map(d => `%${d}%`), ...cookieNames, nowUs];

        const stmt = db.prepare(sql);
        stmt.bind(params);

        let found = false;
        while (stmt.step()) {
          const row = stmt.getAsObject();

          // 1. Plaintext value (old Chrome or unencrypted cookies)
          if (row.value && String(row.value).length > 0) {
            found = true;
            break;
          }

          // 2. Encrypted value — decrypt or check signature
          if (row.encrypted_value) {
            if (isCookieValueValid(row.encrypted_value, masterKey)) {
              found = true;
              break;
            }
          }
        }
        stmt.free();

        out[site.id] = {
          loggedIn: found,
          name: site.name,
          id: site.id,
          decrypted: masterKey !== null, // whether we used full decryption
        };
      } catch { /* skip this site */ }
    }

    return out;
  });

  return status || result;
}

// ── Diagnostic: list all cookies for a domain ─────────────
/**
 * Return all cookie names and hosts found for a domain.
 * Used by the "Dò cookie" diagnostic panel.
 */
async function getCookiesForDomain(profilePath, domain) {
  const rows = await withDb(profilePath, db => {
    try {
      const res = db.exec(
        `SELECT DISTINCT name, host_key, expires_utc
         FROM cookies WHERE host_key LIKE ? ORDER BY name LIMIT 300`,
        [`%${domain}%`]
      );
      if (!res.length || !res[0].values.length) return [];
      const nowUs = nowChromeTime();
      return res[0].values.map(([name, host, exp]) => ({
        name,
        host,
        expired: exp > 0 && exp < nowUs,
      }));
    } catch { return []; }
  });
  return rows || [];
}

// ── Deep diagnostic ───────────────────────────────────────
/**
 * Returns detailed diagnostic info for each site:
 * cookieFile, dpapi, per-site: rowCount, rows (name, host, prefix, valueLen, expired)
 */
async function debugSocialStatus(profilePath, sites) {
  const userDataPath = path.dirname(profilePath);
  const nowUs = nowChromeTime();

  const cookieFile = [
    path.join(profilePath, 'Network', 'Cookies'),
    path.join(profilePath, 'Cookies'),
  ].find(p => fs.existsSync(p)) || null;

  let masterKey = null;
  let dpapiError = null;
  const cookieDecrypt = require('./cookieDecrypt');
  try { masterKey = cookieDecrypt.getChromeMasterKey(userDataPath); }
  catch (e) { dpapiError = String(e.message || e); }

  const siteDiag = await withDb(profilePath, db => {
    const out = {};
    for (const site of sites) {
      try {
        const domains     = site.domains     || [site.domain];
        const cookieNames = (site.cookieNames || [site.cookieName]).filter(Boolean);
        if (!cookieNames.length) { out[site.id] = { error: 'no cookieNames' }; continue; }

        const domainConds = domains.map(() => 'host_key LIKE ?').join(' OR ');
        const namePH      = cookieNames.map(() => '?').join(', ');
        const sql = `
          SELECT name, host_key, value, encrypted_value, expires_utc
          FROM cookies
          WHERE (${domainConds}) AND name IN (${namePH})
          ORDER BY expires_utc DESC LIMIT 20
        `;
        const params = [...domains.map(d => `%${d}%`), ...cookieNames];
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          const row = stmt.getAsObject();
          const expired = row.expires_utc > 0 && row.expires_utc < nowUs;
          let prefix = '';
          let decryptOk = null;
          if (row.encrypted_value) {
            const buf = Buffer.isBuffer(row.encrypted_value)
              ? row.encrypted_value
              : Buffer.from(row.encrypted_value instanceof Uint8Array
                  ? row.encrypted_value : Object.values(row.encrypted_value));
            if (buf.length >= 3) prefix = buf.slice(0, 3).toString('ascii');
            if (masterKey) {
              const val = cookieDecrypt.decryptCookieValue(buf, masterKey);
              decryptOk = val !== null && val.length > 0;
            }
          }
          rows.push({
            name: row.name,
            host: row.host_key,
            hasPlainValue: !!(row.value && String(row.value).length > 0),
            prefix,
            decryptOk,
            expired,
            expires_utc: row.expires_utc,
          });
        }
        stmt.free();
        out[site.id] = { rows };
      } catch (e) {
        out[site.id] = { error: String(e.message || e) };
      }
    }
    return out;
  });

  const walExists = cookieFile ? fs.existsSync(cookieFile + '-wal') : false;

  return {
    cookieFile,
    walExists,
    dpapiWorking: masterKey !== null,
    dpapiError,
    sites: siteDiag || {},
  };
}

module.exports = { getSocialStatus, getCookiesForDomain, debugSocialStatus, DEFAULT_SOCIAL_SITES };
