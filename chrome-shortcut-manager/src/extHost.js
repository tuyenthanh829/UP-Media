// Localhost host cho tiện ích tự đóng gói (self-hosted CRX) + endpoint nhận cookie.
// Phục vụ file .crx và update.xml qua http://127.0.0.1:<port>/ để Chrome force-install.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

let hostDir = '';
let server = null;
let port = 0;
let cookieSink = null;   // callback nhận dữ liệu cookie từ extension

function init(userDataPath) {
  hostDir = path.join(userDataPath, 'ext-host');
  if (!fs.existsSync(hostDir)) fs.mkdirSync(hostDir, { recursive: true });
}
function getHostDir() { return hostDir; }
function getPort() { return port; }
function onCookies(cb) { cookieSink = cb; }

function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

  // Nhận cookie do extension gửi về
  if (req.method === 'POST' && urlPath === '/cookies') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 8e6) req.destroy(); });
    req.on('end', () => {
      try { const data = JSON.parse(body); if (cookieSink) cookieSink(data); res.statusCode = 200; res.end('ok'); }
      catch { res.statusCode = 400; res.end('bad'); }
    });
    return;
  }

  // Phục vụ file trong hostDir (GET) — .crx và .xml
  const f = path.join(hostDir, path.basename(urlPath));
  if (req.method === 'GET' && fs.existsSync(f) && fs.statSync(f).isFile()) {
    const ct = f.endsWith('.crx') ? 'application/x-chrome-extension'
      : f.endsWith('.xml') ? 'application/xml' : 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    fs.createReadStream(f).pipe(res);
    return;
  }
  res.statusCode = 404; res.end('not found');
}

function start(preferred = 47810) {
  return new Promise(resolve => {
    if (server) { resolve(port); return; }
    const tryPort = (p, left) => {
      const srv = http.createServer(handler);
      srv.once('error', () => { if (left > 0) tryPort(p + 1, left - 1); else resolve(0); });
      srv.listen(p, '127.0.0.1', () => { server = srv; port = p; resolve(p); });
    };
    tryPort(preferred, 25);
  });
}

// ── Tính extension ID từ public key ───────────────────────
function idFromPublicKeyDer(der) {
  const hash = crypto.createHash('sha256').update(der).digest();
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += String.fromCharCode(97 + (hash[i] >> 4));
    id += String.fromCharCode(97 + (hash[i] & 0xf));
  }
  return id;
}
function idFromPrivatePem(pemPath) {
  const pub = crypto.createPublicKey(fs.readFileSync(pemPath));
  return idFromPublicKeyDer(pub.export({ type: 'spki', format: 'der' }));
}

// Khóa cố định cho từng tiện ích (giữ ID không đổi qua các lần đóng gói)
function keyPathFor(slug) {
  const keyDir = path.join(hostDir, 'keys');
  if (!fs.existsSync(keyDir)) fs.mkdirSync(keyDir, { recursive: true });
  return path.join(keyDir, slug + '.pem');
}
function ensureKey(keyPath) {
  if (fs.existsSync(keyPath)) return;
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  fs.writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
}

function readManifestVersion(folderPath) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(folderPath, 'manifest.json'), 'utf8'));
    return m.version || '1.0';
  } catch { return '1.0'; }
}

// Đóng gói 1 thư mục tiện ích thành .crx bằng Chrome, rồi host + sinh update.xml.
// Trả về { id, version, updateUrl }.
function packAndHost(chromePath, folderPath) {
  return new Promise((resolve, reject) => {
    if (!chromePath) return reject(new Error('Không tìm thấy Chrome để đóng gói.'));
    if (!fs.existsSync(path.join(folderPath, 'manifest.json')))
      return reject(new Error('Thư mục không phải tiện ích (thiếu manifest.json).'));

    const slug = crypto.createHash('md5').update(folderPath).digest('hex').slice(0, 12);
    const keyPath = keyPathFor(slug);
    ensureKey(keyPath);
    const id = idFromPrivatePem(keyPath);
    const version = readManifestVersion(folderPath);

    const tmpUserDir = path.join(os.tmpdir(), 'upm-pack-' + slug);
    const args = [
      `--pack-extension=${folderPath}`,
      `--pack-extension-key=${keyPath}`,
      '--no-message-box',
      `--user-data-dir=${tmpUserDir}`,
    ];
    const child = spawn(chromePath, args, { stdio: 'ignore' });

    // Chrome tạo file <folder>.crx cạnh thư mục; chờ nó xuất hiện
    const crxSrc = folderPath.replace(/[\\/]+$/, '') + '.crx';
    const started = Date.now();
    const poll = setInterval(() => {
      if (fs.existsSync(crxSrc)) {
        clearInterval(poll);
        try {
          const crxDest = path.join(hostDir, `${id}.crx`);
          fs.copyFileSync(crxSrc, crxDest);
          try { fs.unlinkSync(crxSrc); } catch {}
          writeUpdateXml(id, version);
          resolve({ id, version, updateUrl: updateUrlFor(id) });
        } catch (e) { reject(e); }
      } else if (Date.now() - started > 20000) {
        clearInterval(poll);
        reject(new Error('Chrome không đóng gói được tiện ích (quá 20 giây).'));
      }
    }, 400);
    child.on('error', () => { /* vẫn dựa vào poll file */ });
  });
}

function updateUrlFor(id) { return `http://127.0.0.1:${port}/${id}.xml`; }

function writeUpdateXml(id, version) {
  const xml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${id}'>
    <updatecheck codebase='http://127.0.0.1:${port}/${id}.crx' version='${version}' />
  </app>
</gupdate>`;
  fs.writeFileSync(path.join(hostDir, `${id}.xml`), xml, 'utf8');
}

// Trang trigger để extension cookie-exporter chạy content script trên đó
function writeTrigger() {
  const html = `<!doctype html><meta charset='utf-8'><title>UP Media</title>
<body style='font-family:sans-serif;padding:24px;color:#0E5A2A;line-height:1.6'>
<h3>Đang xuất cookie…</h3>
<p id='msg'>Đang lấy cookie, vui lòng đợi 1–2 giây. Nếu lấy xong, tab này sẽ tự đóng.</p>
<p id='warn' style='display:none;color:#b45309'>⚠ Chưa nhận được cookie. Có thể extension <b>UP Media Cookie Exporter</b> chưa được cài.<br>
Kiểm tra tại <b>chrome://extensions</b>. Nếu chưa có: mở phần mềm → Cài đặt → bật lại "Xuất cookie Facebook" → đóng hẳn rồi mở lại Chrome.</p>
<script>
  setTimeout(function(){ try{ window.close(); }catch(e){} }, 3000);
  setTimeout(function(){ var w=document.getElementById('warn'); if(w) w.style.display=''; }, 5000);
</script>
</body>`;
  try { fs.writeFileSync(path.join(hostDir, 'trigger.html'), html, 'utf8'); } catch {}
}

// Ghi lại update.xml cho các tiện ích đã host (khi port đổi lúc khởi động lại)
function rehostAll(externalExts) {
  for (const e of externalExts || []) {
    if (e.id && e.version && fs.existsSync(path.join(hostDir, `${e.id}.crx`))) {
      writeUpdateXml(e.id, e.version);
    }
  }
}

module.exports = {
  init, start, getPort, getHostDir, onCookies,
  packAndHost, updateUrlFor, writeUpdateXml, rehostAll, writeTrigger,
};
