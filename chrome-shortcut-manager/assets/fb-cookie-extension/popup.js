// Popup: đọc cookie facebook.com (Chrome tự giải mã, gồm cả httpOnly như xs) và copy.
function $(id) { return document.getElementById(id); }

function getCookies(cb) {
  // Gộp cookie từ nhiều store (bình thường + incognito) theo domain facebook.com
  chrome.cookies.getAll({ domain: 'facebook.com' }, function (cs) { cb(cs || []); });
}

function toEditorFormat(cookies) {
  return cookies.map(function (c) {
    return {
      domain: c.domain,
      expirationDate: c.expirationDate,
      hostOnly: c.hostOnly,
      httpOnly: c.httpOnly,
      name: c.name,
      path: c.path,
      sameSite: c.sameSite || 'unspecified',
      secure: c.secure,
      session: c.session,
      storeId: c.storeId || '0',
      value: c.value,
    };
  });
}

function toHeaderString(cookies) {
  return cookies.map(function (c) { return c.name + '=' + c.value; }).join('; ');
}

function setStatus(msg, type) {
  var s = $('status'); s.textContent = msg; s.className = type || '';
}

async function copyText(text, label) {
  try { await navigator.clipboard.writeText(text); setStatus('✔ Đã copy ' + label, 'ok'); }
  catch (e) { setStatus('✖ Không copy được', 'err'); }
}

document.addEventListener('DOMContentLoaded', function () {
  getCookies(function (cs) {
    var cUser = cs.filter(function (c) { return c.name === 'c_user'; })[0];
    $('count').textContent = cs.length;
    $('uid').textContent = cUser ? cUser.value : '(chưa đăng nhập?)';

    $('btn-json').addEventListener('click', function () {
      if (!cs.length) { setStatus('Không có cookie Facebook', 'err'); return; }
      copyText(JSON.stringify(toEditorFormat(cs)), 'JSON (' + cs.length + ' cookie)');
    });
    $('btn-header').addEventListener('click', function () {
      if (!cs.length) { setStatus('Không có cookie Facebook', 'err'); return; }
      copyText(toHeaderString(cs), 'chuỗi cookie');
    });
  });
});
