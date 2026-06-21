/**
 * Minimal Chrome DevTools Protocol (CDP) client.
 * Uses a fixed debug port (9223) to avoid relying on DevToolsActivePort file,
 * which Chrome 149+ may not create reliably with --remote-debugging-port=0.
 */

const http  = require('http');
const net   = require('net');
const crypto = require('crypto');
const path  = require('path');
const fs    = require('fs');

const FIXED_DEBUG_PORT = 9223;

// ── Port discovery ────────────────────────────────────────
/**
 * Check if Chrome's debug server is reachable via TCP on the given port.
 * Much more reliable than checking DevToolsActivePort file.
 */
function isPortOpen(port, timeoutMs = 600) {
  return new Promise(resolve => {
    const sock = net.createConnection(port, '127.0.0.1');
    sock.setTimeout(timeoutMs);
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('error',   () => resolve(false));
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

/**
 * Find Chrome's CDP port. Tries:
 *   1. Our fixed port (9223)
 *   2. DevToolsActivePort file (for --remote-debugging-port=0 case)
 *   3. Common ports 9222, 9224
 * Returns port number or null if Chrome debug server not found.
 */
async function getCdpPort(userDataPath) {
  // Try fixed port first
  if (await isPortOpen(FIXED_DEBUG_PORT)) return FIXED_DEBUG_PORT;

  // Try DevToolsActivePort file (old --remote-debugging-port=0 approach)
  try {
    const portFile = path.join(userDataPath, 'DevToolsActivePort');
    if (fs.existsSync(portFile)) {
      const port = parseInt(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
      if (!isNaN(port) && port !== FIXED_DEBUG_PORT && await isPortOpen(port)) return port;
    }
  } catch { /* ignore */ }

  // Try common ports as last resort
  for (const p of [9222, 9224]) {
    if (await isPortOpen(p)) return p;
  }

  return null;
}

// ── HTTP helper ───────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('CDP HTTP timeout')); });
  });
}

// ── Minimal WebSocket client (no external deps) ───────────
function wsEncode(payload) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const len  = data.length;
  const mask = crypto.randomBytes(4);
  let hdrLen = 2 + 4; // base + mask bytes
  if (len >= 65536) hdrLen += 8;
  else if (len >= 126) hdrLen += 2;

  const frame = Buffer.alloc(hdrLen + len);
  frame[0] = 0x81; // FIN + text opcode
  let offset = 2;
  if (len >= 65536) {
    frame[1] = 0x80 | 127;
    frame.writeBigUInt64BE(BigInt(len), 2);
    offset = 10;
  } else if (len >= 126) {
    frame[1] = 0x80 | 126;
    frame.writeUInt16BE(len, 2);
    offset = 4;
  } else {
    frame[1] = 0x80 | len;
  }
  mask.copy(frame, offset);
  offset += 4;
  for (let i = 0; i < len; i++) frame[offset + i] = data[i] ^ mask[i % 4];
  return frame;
}

function wsDecode(buf) {
  if (buf.length < 2) return null;
  const masked = (buf[1] & 0x80) !== 0;
  let payLen = buf[1] & 0x7f;
  let offset = 2;
  if (payLen === 126) { if (buf.length < 4) return null; payLen = buf.readUInt16BE(2); offset = 4; }
  else if (payLen === 127) { if (buf.length < 10) return null; payLen = Number(buf.readBigUInt64BE(2)); offset = 10; }
  if (masked) offset += 4;
  if (buf.length < offset + payLen) return null;
  return buf.slice(offset, offset + payLen).toString('utf8');
}

function wsCall(host, port, wsPath, method, params) {
  return new Promise((resolve, reject) => {
    const key    = crypto.randomBytes(16).toString('base64');
    const socket = net.createConnection(port, host);
    let   headDone = false;
    let   frameBuf = Buffer.alloc(0);
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('CDP WS timeout')); }, 8000);

    socket.on('error', (e) => { clearTimeout(timer); reject(e); });

    socket.on('connect', () => {
      socket.write([
        `GET ${wsPath} HTTP/1.1`,
        `Host: ${host}:${port}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '', ''
      ].join('\r\n'));
    });

    socket.on('data', (chunk) => {
      if (!headDone) {
        const s = chunk.toString('ascii');
        if (!s.includes('101')) return; // wait for upgrade
        headDone = true;
        // Send CDP command
        socket.write(wsEncode(JSON.stringify({ id: 1, method, params })));
        // remaining bytes after HTTP headers are WS frame data
        const bodyStart = s.indexOf('\r\n\r\n');
        if (bodyStart >= 0) {
          const rest = chunk.slice(Buffer.byteLength(s.slice(0, bodyStart + 4), 'ascii'));
          if (rest.length) frameBuf = Buffer.concat([frameBuf, rest]);
        }
        return;
      }
      frameBuf = Buffer.concat([frameBuf, chunk]);
      const text = wsDecode(frameBuf);
      if (text === null) return; // incomplete frame
      try {
        const msg = JSON.parse(text);
        if (msg.id === 1) {
          clearTimeout(timer);
          socket.destroy();
          if (msg.result) resolve(msg.result);
          else reject(new Error('CDP error: ' + JSON.stringify(msg.error)));
        }
      } catch { /* wait for more */ }
    });
  });
}

// ── Public API ────────────────────────────────────────────
/**
 * Get all cookies from a running Chrome instance via CDP.
 * @param {number} port CDP port from DevToolsActivePort
 * @returns {Array} cookies: [{name, value, domain, path, expires, ...}]
 */
async function getAllCookies(port) {
  const versionJson = await httpGet(`http://127.0.0.1:${port}/json/version`);
  const { webSocketDebuggerUrl } = JSON.parse(versionJson);
  // Parse ws://host:port/path
  const m = webSocketDebuggerUrl.match(/ws:\/\/([^:/]+):?(\d*)(\/.*)/);
  if (!m) throw new Error('Bad WS URL: ' + webSocketDebuggerUrl);
  const [, wsHost, wsPortStr, wsPath] = m;
  const wsPort = wsPortStr ? parseInt(wsPortStr) : 80;
  const result = await wsCall(wsHost, wsPort, wsPath, 'Network.getAllCookies', {});
  return result.cookies || [];
}

/**
 * Check social login status via CDP (Chrome must be running with --remote-debugging-port).
 * @param {string} userDataPath  e.g. C:\...\Chrome\User Data
 * @param {object[]} sites       same format as DEFAULT_SOCIAL_SITES
 * @returns {{ siteId: { loggedIn, name, id, via:'cdp' } } | null}  null if CDP unavailable
 */
async function getSocialStatusViaCdp(userDataPath, sites) {
  const port = await getCdpPort(userDataPath);
  if (!port) return null;

  let cookies;
  try { cookies = await getAllCookies(port); }
  catch { return null; }

  const nowSec = Date.now() / 1000;
  const result = {};

  for (const site of sites) {
    const domains     = site.domains || [site.domain];
    const cookieNames = (site.cookieNames || [site.cookieName]).filter(Boolean);

    const found = cookies.some(c => {
      if (!cookieNames.includes(c.name)) return false;
      // c.domain may be ".facebook.com" or "facebook.com"
      const host = c.domain.replace(/^\./, '');
      if (!domains.some(d => host === d || host.endsWith('.' + d) || d.endsWith('.' + host))) return false;
      if (c.expires > 0 && c.expires < nowSec) return false; // expired
      return c.value && c.value.length > 0;
    });

    result[site.id] = { loggedIn: found, name: site.name, id: site.id, via: 'cdp' };
  }

  return result;
}

module.exports = { getCdpPort, getAllCookies, getSocialStatusViaCdp };
