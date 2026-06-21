const fs = require('fs');
const path = require('path');
const os = require('os');
const cookieDecrypt = require('./cookieDecrypt');
const chromeCdp = require('./chromeCdp');

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
    // Threads is built on Instagram auth — sessionid/ds_user_id may be stored under
    // instagram.com (shared Meta session) rather than threads.net itself.
    domains: ['threads.net', 'instagram.com'],
    cookieName: 'sessionid',
    cookieNames: ['sessionid', 'ds_user_id'],
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
    cookieName: 'u.ac',
    // u.ac = numeric user ID (clearest login indicator, similar to Facebook's c_user)
    // idToken / privateToken = JWT session tokens
    cookieNames: ['u.ac', 'idToken', 'privateToken'],
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

// ── Copy locked file via PowerShell (Windows) ────────────
/**
 * On Windows, Chrome holds an exclusive SQLite lock on Cookies while running.
 * Node's fs.readFileSync fails with EBUSY. PowerShell Copy-Item uses
 * FILE_SHARE_READ|WRITE|DELETE flags and can copy the file anyway.
 */
function readFileBypassed(filePath) {
  const { spawnSync } = require('child_process');

  // ── 1. Direct read with explicit size (fast path) ──
  // Uses fs.open + fs.read to read exactly statSync.size bytes, avoiding issues
  // where fs.readFileSync returns 0 because Chrome holds file in a specific mode.
  try {
    const statSize = fs.statSync(filePath).size;
    if (statSize > 0) {
      const fd = fs.openSync(filePath, 'r');
      try {
        const buf = Buffer.alloc(statSize);
        let totalRead = 0;
        while (totalRead < statSize) {
          const n = fs.readSync(fd, buf, totalRead, statSize - totalRead, totalRead);
          if (n === 0) break;
          totalRead += n;
        }
        if (totalRead > 0) return buf.slice(0, totalRead);
      } finally {
        fs.closeSync(fd);
      }
    }
  } catch (e) {
    if (e.code !== 'EBUSY' && e.code !== 'EPERM' && e.code !== 'EACCES') throw e;
  }

  // ── 2. robocopy /B (Backup mode — uses SE_BACKUP_NAME privilege) ──
  const srcDir = path.dirname(filePath);
  const srcFile = path.basename(filePath);
  const dstDir = path.join(os.tmpdir(), `upm_rb_${Date.now()}`);
  try {
    fs.mkdirSync(dstDir, { recursive: true });
    spawnSync('robocopy', [srcDir, dstDir, srcFile, '/B', '/R:0', '/W:0', '/NP', '/NJH', '/NJS'], { timeout: 8000 });
    const rbDst = path.join(dstDir, srcFile);
    if (fs.existsSync(rbDst)) {
      const buf = fs.readFileSync(rbDst);
      if (buf.length > 0) return buf;
    }
  } catch { /* fall through */ } finally {
    try { fs.rmSync(dstDir, { recursive: true, force: true }); } catch { /* cleanup */ }
  }

  // ── 3. .NET FileStream — reads $fs.Length bytes explicitly ──
  // Explicitly reads file.Length bytes rather than CopyTo (which reads until EOF
  // and may return 0 if Chrome's handle reports 0 at the stream level).
  const tmp = path.join(os.tmpdir(), `upm_cookies_${Date.now()}.db`);
  const psScript = `
$src='${filePath.replace(/'/g, "''")}';
$dst='${tmp.replace(/'/g, "''")}';
$share=[System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete;
$fs=[System.IO.File]::Open($src,[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,$share);
$len=$fs.Length;
if($len -gt 0){
  $bytes=New-Object byte[] $len;
  $fs.Seek(0,[System.IO.SeekOrigin]::Begin)|Out-Null;
  $n=$fs.Read($bytes,0,$len);
  $fs.Close();
  if($n -gt 0){
    $out=[System.IO.File]::Create($dst);
    $out.Write($bytes,0,$n);
    $out.Close();
    Write-Output "ok:$n";
  } else { Write-Output "zero_read:$len"; }
} else { $fs.Close(); Write-Output "zero_len"; }
`.trim();
  try {
    const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript], { timeout: 10000 });
    const stdout = (r.stdout || '').toString().trim();
    if (r.status !== 0) throw new Error('PS failed: ' + (r.stderr || r.stdout || ''));
    if (stdout.startsWith('ok:')) {
      const buf = fs.readFileSync(tmp);
      if (buf.length > 0) return buf;
    }
    // Return diagnostic info as error so caller can surface it
    throw new Error(`PS_DIAG:${stdout || '(no output)'}:stderr=${(r.stderr||'').toString().trim().slice(0,200)}`);
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* cleanup best-effort */ }
  }
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
    let dbBuf = readFileBypassed(cookieFile);

    // Merge WAL if Chrome is currently running (WAL mode)
    if (fs.existsSync(walSrc)) {
      try {
        const walBuf = readFileBypassed(walSrc);
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

  const prefix = buf.slice(0, 3).toString('ascii');

  // v20 = App-Bound Encryption (Chrome 127+). This uses a key stored inside Chrome's
  // process and cannot be decrypted externally even with the DPAPI master key.
  // Presence of a v20-prefixed non-expired session cookie IS proof of login
  // (session cookies are cleared on logout; v20 is not a device fingerprint).
  if (prefix === 'v20') return true;

  // v10/v11: AES-256-GCM encrypted with DPAPI master key (Chrome 80–126)
  if (masterKey) {
    const decrypted = cookieDecrypt.decryptCookieValue(buf, masterKey);
    return decrypted !== null && decrypted.length > 0;
  }

  // No master key — existence of v10/v11 prefix means cookie is present (likely logged in)
  return prefix === 'v10' || prefix === 'v11';
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

  const userDataPath = path.dirname(profilePath);

  // ── Primary: CDP (Chrome 130+ consumer build has disabled this) ──
  try {
    const cdpResult = await chromeCdp.getSocialStatusViaCdp(userDataPath, sites);
    if (cdpResult) return cdpResult;
  } catch { /* fall through to SQLite */ }

  // ── Fallback: SQLite cookie file (Chrome closed or no debug port) ──
  // First probe if the file is locked by Chrome (FILE_SHARE_NONE).
  // If locked, return _chromeLocked flag so the UI can offer kill-read-reopen.
  const cookieFile = [
    path.join(profilePath, 'Network', 'Cookies'),
    path.join(profilePath, 'Cookies'),
  ].find(p => fs.existsSync(p));

  if (cookieFile) {
    let isLocked = false;
    try {
      const statSz = fs.statSync(cookieFile).size;
      if (statSz > 0) {
        const fd = fs.openSync(cookieFile, 'r');
        try {
          const testBuf = Buffer.alloc(16);
          const n = fs.readSync(fd, testBuf, 0, 16, 0);
          if (n === 0) isLocked = true;
        } finally {
          fs.closeSync(fd);
        }
      }
    } catch { isLocked = true; }
    if (isLocked) { result._chromeLocked = true; return result; }
  }

  let masterKey = null;
  try { masterKey = cookieDecrypt.getChromeMasterKey(userDataPath); } catch { /* no DPAPI */ }

  const nowUs = nowChromeTime();

  const status = await withDb(profilePath, db => {
    const out = {};

    // Discover actual cookie table name (Chrome 127+ may rename it)
    let cookieTable = 'cookies';
    try {
      const tablesRes = db.exec(`SELECT name FROM sqlite_master WHERE type='table'`);
      if (tablesRes.length) {
        for (const [tName] of tablesRes[0].values) {
          const cols = db.exec(`PRAGMA table_info("${tName}")`);
          if (cols.length && cols[0].values.some(r => r[1] === 'host_key')) {
            cookieTable = tName;
            break;
          }
        }
      }
    } catch { /* keep default */ }

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
          FROM "${cookieTable}"
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

  // Detect file lock early — Chrome running with FILE_SHARE_NONE or byte-range lock
  const cookieFileForLockCheck = [
    path.join(profilePath, 'Network', 'Cookies'),
    path.join(profilePath, 'Cookies'),
  ].find(p => fs.existsSync(p));

  if (cookieFileForLockCheck) {
    let isLocked = false;
    let statSizeForCheck = 0;
    try { statSizeForCheck = fs.statSync(cookieFileForLockCheck).size; } catch { /* ignore */ }
    try {
      if (statSizeForCheck > 0) {
        const fd = fs.openSync(cookieFileForLockCheck, 'r');
        try {
          // Read first 16 bytes — if Chrome is running, byte-range lock returns 0 bytes
          // even though the file can be opened (Chrome uses FILE_SHARE_READ but locks data)
          const testBuf = Buffer.alloc(16);
          const n = fs.readSync(fd, testBuf, 0, 16, 0);
          if (n === 0) isLocked = true;
        } finally {
          fs.closeSync(fd);
        }
      }
    } catch (e) {
      isLocked = true; // open failed (true FILE_SHARE_NONE)
    }
    if (isLocked) {
      return {
        _chromeLocked: true,
        cookieFile: cookieFileForLockCheck,
        cdpPort: null, cdpAvailable: false,
        dpapiWorking: false,
        chromeDiag: { processes: ['(Chrome đang chạy — file bị khóa)'], portsOpen: [], rawCmdLine: '' },
        rawDiag: { statSize: statSizeForCheck, fileSize: 0, error: 'Chrome đang chạy: file cookie bị khóa — không đọc được' },
        sites: {},
      };
    }
  }

  // ── Try CDP first ──────────────────────────────────────────
  const cdpPortFile = path.join(userDataPath, 'DevToolsActivePort');
  const cdpPortFileExists = fs.existsSync(cdpPortFile);
  const cdpPort = await chromeCdp.getCdpPort(userDataPath);
  let cdpCookies = null;
  let cdpError = null;
  if (cdpPort) {
    try { cdpCookies = await chromeCdp.getAllCookies(cdpPort); }
    catch (e) { cdpError = String(e.message || e); }
  }

  // ── Chrome process diagnostic ──────────────────────────────
  let chromeDiag = { processes: [], portsOpen: [], rawCmdLine: '' };
  try {
    const { spawnSync } = require('child_process');
    const r = spawnSync('wmic', ['process', 'where', "name='chrome.exe'", 'get', 'CommandLine', '/format:list'], { timeout: 5000, encoding: 'utf8' });
    if (r.stdout) {
      const lines = r.stdout.split(/\r?\n/).filter(l => l.startsWith('CommandLine='));
      if (lines.length) {
        // Show the FULL first command line (not regex-truncated) so paths with spaces are visible
        const rawLine = lines[0].replace(/^CommandLine=/, '').trim();
        chromeDiag.rawCmdLine = rawLine.slice(0, 400); // limit for display
        // Extract relevant --flags; keep full value by matching to next -- or end
        const parts = rawLine.split(/(?=--)/);
        chromeDiag.processes = parts
          .map(s => s.trim())
          .filter(s => s.match(/^--(debug|profile|remote|user-data)/));
        if (!chromeDiag.processes.length) chromeDiag.processes = ['(no debug flags found)'];
      } else {
        chromeDiag.processes = ['(no chrome.exe running)'];
      }
    }
  } catch { chromeDiag.processes = ['(wmic check failed)']; }

  // Scan ports 9220-9230 to find any debug server
  const { isPortOpen } = chromeCdp;
  if (isPortOpen) {
    const portChecks = await Promise.all(
      Array.from({ length: 11 }, (_, i) => 9220 + i).map(async p => (await isPortOpen(p)) ? p : null)
    );
    chromeDiag.portsOpen = portChecks.filter(Boolean);
  }

  const cookieFile = [
    path.join(profilePath, 'Network', 'Cookies'),
    path.join(profilePath, 'Cookies'),
  ].find(p => fs.existsSync(p)) || null;

  let masterKey = null;
  let dpapiError = null;
  const cookieDecrypt = require('./cookieDecrypt');
  try { masterKey = cookieDecrypt.getChromeMasterKey(userDataPath); }
  catch (e) { dpapiError = String(e.message || e); }

  // Read raw file bytes for magic-byte check BEFORE sql.js (sql.js silently creates empty DB on bad input)
  let rawDiag = { fileSize: 0, magic: '', sqliteMagic: false, networkFiles: [], error: null, psDiag: null, statSize: 0 };
  if (cookieFile) {
    try { rawDiag.statSize = fs.statSync(cookieFile).size; } catch { /* ignore */ }
    try {
      const rawBuf = readFileBypassed(cookieFile);
      rawDiag.fileSize = rawBuf.length;
      rawDiag.magic = rawBuf.slice(0, 16).toString('hex');
      rawDiag.sqliteMagic = rawBuf.slice(0, 6).toString('ascii') === 'SQLite';

      // Scan Network/ folder — show file sizes to find where Chrome actually stores data
      const networkDir = path.dirname(cookieFile);
      try {
        rawDiag.networkFiles = fs.readdirSync(networkDir).map(f => {
          try { return `${f}(${fs.statSync(path.join(networkDir, f)).size}B)`; }
          catch { return f; }
        }).slice(0, 25);
      } catch { rawDiag.networkFiles = []; }

      // Also scan Profile root for SQLite files with actual content
      try {
        const profileFiles = fs.readdirSync(profilePath);
        rawDiag.sqliteInProfile = profileFiles
          .filter(f => !f.includes('-journal') && !f.includes('-wal') && !f.includes('-shm'))
          .map(f => {
            const fp = path.join(profilePath, f);
            try {
              const stat = fs.statSync(fp);
              if (!stat.isFile() || stat.size < 100) return null;
              const hdr = Buffer.alloc(6);
              const fd = fs.openSync(fp, 'r');
              fs.readSync(fd, hdr, 0, 6, 0);
              fs.closeSync(fd);
              if (hdr.toString('ascii') === 'SQLite') return `${f}(${stat.size}B)`;
            } catch { /* skip */ }
            return null;
          }).filter(Boolean).slice(0, 15);
      } catch { rawDiag.sqliteInProfile = []; }

      // Check Cookies-journal size (rollback journal — may have old pages)
      const journalFile = cookieFile + '-journal';
      if (fs.existsSync(journalFile)) {
        try { rawDiag.journalSize = fs.statSync(journalFile).size; } catch { rawDiag.journalSize = -1; }
      }
    } catch (e) {
      rawDiag.error = String(e.message || e);
      // PS_DIAG prefix means readFileBypassed returned diagnostic info — surface it
      if (rawDiag.error.startsWith('PS_DIAG:')) rawDiag.psDiag = rawDiag.error;
    }
  }

  const rawDbDiag = await withDb(profilePath, db => {
    try {
      const tablesRes = db.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
      const tables = tablesRes.length ? tablesRes[0].values.map(r => r[0]) : [];

      let cookieCount = null;
      let sampleHosts = [];
      let cookieTable = null;
      for (const t of tables) {
        try {
          const cols = db.exec(`PRAGMA table_info("${t}")`);
          const colNames = cols.length ? cols[0].values.map(r => r[1]) : [];
          if (colNames.includes('host_key')) {
            cookieTable = t;
            const cnt = db.exec(`SELECT COUNT(*) FROM "${t}"`);
            cookieCount = cnt.length ? cnt[0].values[0][0] : 0;
            const hosts = db.exec(`SELECT DISTINCT host_key FROM "${t}" LIMIT 10`);
            sampleHosts = hosts.length ? hosts[0].values.map(r => r[0]) : [];
            break;
          }
        } catch { /* skip */ }
      }
      return { tables, cookieTable, cookieCount, sampleHosts };
    } catch (e) {
      return { error: String(e.message || e) };
    }
  });

  Object.assign(rawDiag, rawDbDiag || {});

  const siteDiag = await withDb(profilePath, db => {
    const out = {};
    // Use discovered table name if different from 'cookies'
    const tbl = (rawDiag && rawDiag.cookieTable) ? rawDiag.cookieTable : 'cookies';
    for (const site of sites) {
      try {
        const domains     = site.domains     || [site.domain];
        const cookieNames = (site.cookieNames || [site.cookieName]).filter(Boolean);
        if (!cookieNames.length) { out[site.id] = { error: 'no cookieNames' }; continue; }

        const domainConds = domains.map(() => 'host_key LIKE ?').join(' OR ');
        const namePH      = cookieNames.map(() => '?').join(', ');
        const sql = `
          SELECT name, host_key, value, encrypted_value, expires_utc
          FROM "${tbl}"
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
            if (prefix === 'v20') {
              decryptOk = true; // App-Bound Encryption — presence = valid
            } else if (masterKey) {
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

  // Merge CDP results into siteDiag (CDP takes priority when available)
  const mergedSites = {};
  for (const site of sites) {
    const sqliteDiag = siteDiag ? (siteDiag[site.id] || {}) : {};
    if (cdpCookies) {
      const domains     = site.domains || [site.domain];
      const cookieNames = (site.cookieNames || [site.cookieName]).filter(Boolean);
      const nowSec = Date.now() / 1000;
      const cdpRows = cdpCookies.filter(c => {
        if (!cookieNames.includes(c.name)) return false;
        const host = (c.domain || '').replace(/^\./, '');
        return domains.some(d => host === d || host.endsWith('.' + d) || d.endsWith('.' + host));
      }).map(c => ({
        name: c.name,
        host: c.domain,
        hasPlainValue: !!(c.value && c.value.length > 0),
        prefix: 'cdp',
        decryptOk: true,
        expired: c.expires > 0 && c.expires < nowSec,
        via: 'cdp',
      }));
      mergedSites[site.id] = { ...sqliteDiag, rows: cdpRows, via: 'cdp' };
    } else {
      mergedSites[site.id] = sqliteDiag;
    }
  }

  return {
    cookieFile,
    walExists,
    dpapiWorking: masterKey !== null,
    dpapiError,
    cdpPort,
    cdpPortFileExists,
    cdpPortFilePath: cdpPortFile,
    cdpAvailable: !!cdpCookies,
    cdpError,
    cdpCookieCount: cdpCookies ? cdpCookies.length : null,
    chromeDiag,
    rawDiag: rawDiag || {},
    sites: mergedSites,
  };
}

module.exports = { getSocialStatus, getCookiesForDomain, debugSocialStatus, DEFAULT_SOCIAL_SITES };
