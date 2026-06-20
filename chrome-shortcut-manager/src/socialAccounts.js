const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_SOCIAL_SITES = [
  { id: 'facebook',  name: 'Facebook',     domain: 'facebook.com',  cookieName: 'c_user' },
  { id: 'instagram', name: 'Instagram',    domain: 'instagram.com', cookieName: 'sessionid' },
  { id: 'x',         name: 'X (Twitter)', domain: 'x.com',          cookieName: 'auth_token' },
  { id: 'tiktok',   name: 'TikTok',       domain: 'tiktok.com',    cookieName: 'sessionid' },
  { id: 'threads',  name: 'Threads',      domain: 'threads.net',   cookieName: 'sessionid' },
  { id: 'linkedin', name: 'LinkedIn',     domain: 'linkedin.com',  cookieName: 'li_at' },
  { id: 'chotot',   name: 'Chợ Tốt',     domain: 'chotot.com',    cookieName: 'session' },
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

async function getSocialStatus(profilePath, sites) {
  const result = {};
  for (const site of sites) {
    result[site.id] = { loggedIn: false, name: site.name, id: site.id };
  }

  const cookieFile = [
    path.join(profilePath, 'Network', 'Cookies'),
    path.join(profilePath, 'Cookies'),
  ].find(p => fs.existsSync(p));

  if (!cookieFile) return result;

  const tmpFile = path.join(os.tmpdir(), `csm_cookies_${Date.now()}.db`);
  try {
    fs.copyFileSync(cookieFile, tmpFile);
    const SQL = await getSql();
    const buf = fs.readFileSync(tmpFile);
    const db = new SQL.Database(buf);

    for (const site of sites) {
      try {
        const stmt = db.prepare(
          `SELECT 1 FROM cookies WHERE host_key LIKE ? AND name = ? LIMIT 1`
        );
        stmt.bind([`%${site.domain}%`, site.cookieName]);
        const found = stmt.step();
        stmt.free();
        result[site.id] = { loggedIn: found, name: site.name, id: site.id };
      } catch { /* skip */ }
    }

    db.close();
  } catch { /* ignore */ } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }

  return result;
}

module.exports = { getSocialStatus, DEFAULT_SOCIAL_SITES };
