const fs = require('fs');
const path = require('path');
const os = require('os');

// cookieNames: multiple names → OR logic (any one present = logged in)
// domains: multiple domains → OR logic (check any domain)
const DEFAULT_SOCIAL_SITES = [
  {
    id: 'facebook',  name: 'Facebook',
    domain: 'facebook.com',
    cookieName: 'c_user',
    cookieNames: ['c_user', 'xs'],
  },
  {
    id: 'instagram', name: 'Instagram',
    domain: 'instagram.com',
    cookieName: 'sessionid',
  },
  {
    id: 'x',         name: 'X (Twitter)',
    domain: 'x.com',
    cookieName: 'auth_token',
    // Twitter renamed to X — old cookies may still be stored under twitter.com
    domains: ['x.com', 'twitter.com'],
  },
  {
    id: 'tiktok',   name: 'TikTok',
    domain: 'tiktok.com',
    cookieName: 'sessionid',
    cookieNames: ['sessionid', 'sid_tt', 'ttwid'],
  },
  {
    id: 'threads',  name: 'Threads',
    domain: 'threads.net',
    cookieName: 'sessionid',
  },
  {
    id: 'linkedin', name: 'LinkedIn',
    domain: 'linkedin.com',
    cookieName: 'li_at',
  },
  {
    id: 'chotot',   name: 'Chợ Tốt',
    domain: 'chotot.com',
    cookieName: 'access_token',
    cookieNames: ['access_token', 'at', 'chotot_token', 'session_token', '_session'],
  },
];

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

function openDb(profilePath) {
  const cookieFile = [
    path.join(profilePath, 'Network', 'Cookies'),
    path.join(profilePath, 'Cookies'),
  ].find(p => fs.existsSync(p));
  return cookieFile || null;
}

async function withDb(profilePath, fn) {
  const cookieFile = openDb(profilePath);
  if (!cookieFile) return null;

  const tmpFile = path.join(os.tmpdir(), `csm_ck_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
  try {
    fs.copyFileSync(cookieFile, tmpFile);
    const SQL = await getSql();
    const buf = fs.readFileSync(tmpFile);
    const db = new SQL.Database(buf);
    try {
      return await fn(db);
    } finally {
      db.close();
    }
  } catch { return null; } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

async function getSocialStatus(profilePath, sites) {
  const result = {};
  for (const site of sites) {
    result[site.id] = { loggedIn: false, name: site.name, id: site.id };
  }

  const status = await withDb(profilePath, db => {
    const out = {};
    for (const site of sites) {
      try {
        const domains = site.domains || [site.domain];
        const cookieNames = site.cookieNames || [site.cookieName];

        // Build: WHERE (host_key LIKE ? OR ...) AND name IN (?, ...)
        const domainConds = domains.map(() => 'host_key LIKE ?').join(' OR ');
        const namePH = cookieNames.map(() => '?').join(', ');
        const sql = `SELECT 1 FROM cookies WHERE (${domainConds}) AND name IN (${namePH}) LIMIT 1`;
        const params = [...domains.map(d => `%${d}%`), ...cookieNames];

        const stmt = db.prepare(sql);
        stmt.bind(params);
        const found = stmt.step();
        stmt.free();
        out[site.id] = { loggedIn: found, name: site.name, id: site.id };
      } catch { /* skip site */ }
    }
    return out;
  });

  return status || result;
}

// Diagnostic: list all cookie names found for a given domain in a profile
async function getCookiesForDomain(profilePath, domain) {
  const rows = await withDb(profilePath, db => {
    try {
      const res = db.exec(
        `SELECT DISTINCT name, host_key FROM cookies WHERE host_key LIKE ? ORDER BY name LIMIT 200`,
        [`%${domain}%`]
      );
      if (!res.length || !res[0].values.length) return [];
      return res[0].values.map(([name, host]) => ({ name, host }));
    } catch { return []; }
  });
  return rows || [];
}

module.exports = { getSocialStatus, getCookiesForDomain, DEFAULT_SOCIAL_SITES };
