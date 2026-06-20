const fs = require('fs');
const path = require('path');
const os = require('os');

// Chrome epoch offset: microseconds from 1601-01-01 to 1970-01-01
const CHROME_EPOCH_OFFSET_MS = 11644473600000;

async function getProfileHistory(profilePath, limit = 25) {
  const historyFile = path.join(profilePath, 'History');
  if (!fs.existsSync(historyFile)) {
    return { ok: false, error: 'Chưa có lịch sử duyệt web', items: [] };
  }

  const tmpFile = path.join(os.tmpdir(), `csm_hist_${Date.now()}.db`);
  try {
    fs.copyFileSync(historyFile, tmpFile);
  } catch {
    return { ok: false, error: 'Không đọc được file lịch sử (Chrome đang mở — đóng Chrome rồi thử lại)', items: [] };
  }

  try {
    const { app } = require('electron');
    const wasmDir = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist')
      : path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist');

    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs({ locateFile: f => path.join(wasmDir, f) });
    const buf = fs.readFileSync(tmpFile);
    const db = new SQL.Database(buf);

    const res = db.exec(
      `SELECT url, title, last_visit_time FROM urls WHERE hidden = 0 ORDER BY last_visit_time DESC LIMIT ${limit}`
    );
    db.close();

    if (!res.length || !res[0].values.length) return { ok: true, items: [] };

    const items = res[0].values.map(([url, title, lastVisit]) => {
      const ms = Math.round(lastVisit / 1000) - CHROME_EPOCH_OFFSET_MS;
      return { url, title: (title || url).substring(0, 100), visitTime: ms };
    });

    return { ok: true, items };
  } catch (e) {
    return { ok: false, error: 'Lỗi đọc lịch sử: ' + e.message, items: [] };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

module.exports = { getProfileHistory };
