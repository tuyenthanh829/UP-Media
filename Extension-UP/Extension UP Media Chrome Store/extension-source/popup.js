// Công cụ cookie Facebook: LẤY (get) và NHẬP/ĐĂNG NHẬP (set) cookie.
function $(id) { return document.getElementById(id); }
function fmt() { return document.querySelector('input[name="fmt"]:checked').value; }
function setStatus(msg, type) { var s = $('status'); s.textContent = msg; s.className = type || ''; }

// Lấy toàn bộ cookie facebook.com, khử trùng lặp theo tên (ưu tiên domain .facebook.com)
function getCookies(cb) {
  chrome.cookies.getAll({ domain: 'facebook.com' }, function (cs) {
    var map = {};
    (cs || []).forEach(function (c) {
      var prev = map[c.name];
      var better = !prev
        || (c.domain.indexOf('.facebook.com') !== -1 && prev.domain.indexOf('.facebook.com') === -1)
        || (c.domain === prev.domain && (c.value || '').length > (prev.value || '').length);
      if (better) map[c.name] = c;
    });
    cb(Object.keys(map).map(function (k) { return map[k]; }));
  });
}

function toHeaderString(cookies) {
  return cookies.map(function (c) { return c.name + '=' + c.value; }).join('; ');
}
function toEditorJson(cookies) {
  return JSON.stringify(cookies.map(function (c) {
    return {
      domain: c.domain, expirationDate: c.expirationDate, hostOnly: c.hostOnly,
      httpOnly: c.httpOnly, name: c.name, path: c.path,
      sameSite: c.sameSite || 'unspecified', secure: c.secure,
      session: c.session, storeId: c.storeId || '0', value: c.value,
    };
  }));
}

function fillBox(cookies) {
  $('box').value = fmt() === 'json' ? toEditorJson(cookies) : toHeaderString(cookies);
}

function refreshInfo() {
  getCookies(function (cs) {
    $('count').textContent = cs.length;
    var cu = cs.filter(function (c) { return c.name === 'c_user'; })[0];
    $('uid').textContent = cu ? cu.value : '(chưa đăng nhập?)';
  });
}

// ── Parse cookie do người dùng dán vào (JSON hoặc chuỗi name=value) ──
function parseInput(text) {
  text = (text || '').trim();
  if (!text) return [];
  if (text.charAt(0) === '[' || text.charAt(0) === '{') {
    try {
      var arr = JSON.parse(text);
      if (!Array.isArray(arr)) arr = [arr];
      return arr.map(function (c) { return { name: c.name, value: String(c.value), domain: c.domain, path: c.path, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite, expirationDate: c.expirationDate }; })
        .filter(function (c) { return c.name; });
    } catch (e) { return null; }
  }
  // Chuỗi header: name=value; name2=value2
  return text.split(';').map(function (p) {
    var i = p.indexOf('=');
    if (i === -1) return null;
    return { name: p.slice(0, i).trim(), value: p.slice(i + 1).trim() };
  }).filter(function (c) { return c && c.name; });
}

function setCookies(cookies, done) {
  var pending = cookies.length, ok = 0;
  if (!pending) { done(0); return; }
  cookies.forEach(function (c) {
    var domain = c.domain || '.facebook.com';
    var host = domain.charAt(0) === '.' ? domain.slice(1) : domain;
    var details = {
      url: 'https://' + host + (c.path || '/'),
      name: c.name,
      value: c.value,
      domain: domain,
      path: c.path || '/',
      secure: c.secure !== undefined ? c.secure : true,
      httpOnly: c.httpOnly || false,
    };
    if (c.expirationDate) details.expirationDate = c.expirationDate;
    else details.expirationDate = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365; // 1 năm
    if (c.sameSite && c.sameSite !== 'unspecified') details.sameSite = c.sameSite;
    try {
      chrome.cookies.set(details, function (res) {
        if (res) ok++;
        if (--pending === 0) done(ok);
      });
    } catch (e) { if (--pending === 0) done(ok); }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  refreshInfo();

  $('btn-get').addEventListener('click', function () {
    getCookies(function (cs) {
      if (!cs.length) { setStatus('Không có cookie Facebook', 'err'); return; }
      fillBox(cs);
      setStatus('Đã lấy ' + cs.length + ' cookie', 'ok');
    });
  });

  $('btn-copy').addEventListener('click', async function () {
    var t = $('box').value.trim();
    if (!t) { setStatus('Ô cookie đang trống — bấm "Lấy cookie" trước', 'err'); return; }
    try { await navigator.clipboard.writeText(t); setStatus('✔ Đã copy vào clipboard', 'ok'); }
    catch (e) { setStatus('Không copy được', 'err'); }
  });

  $('btn-login').addEventListener('click', function () {
    var cookies = parseInput($('box').value);
    if (cookies === null) { setStatus('Cookie không đúng định dạng', 'err'); return; }
    if (!cookies.length) { setStatus('Dán cookie vào ô rồi thử lại', 'err'); return; }
    setStatus('Đang đăng nhập bằng cookie…', '');
    setCookies(cookies, function (ok) {
      setStatus('✔ Đã ghi ' + ok + '/' + cookies.length + ' cookie. Đang mở Facebook…', 'ok');
      chrome.tabs.create({ url: 'https://www.facebook.com' });
    });
  });

  // Đổi định dạng thì vẽ lại nếu ô đang có cookie lấy từ trình duyệt
  Array.prototype.forEach.call(document.querySelectorAll('input[name="fmt"]'), function (r) {
    r.addEventListener('change', function () {
      var cur = $('box').value.trim();
      if (cur && cur.indexOf('=') === -1 && cur.charAt(0) !== '[') return;
      getCookies(function (cs) { if (cs.length && $('box').value.trim()) fillBox(cs); });
    });
  });
});
