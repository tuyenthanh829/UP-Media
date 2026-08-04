// Service worker: nhận yêu cầu từ content script, đọc cookie facebook (đã giải mã sẵn
// bởi Chrome, gồm cả httpOnly như xs), rồi POST về phần mềm qua localhost.
chrome.runtime.onMessage.addListener(function (msg) {
  if (!msg || msg.type !== 'upm-export-cookies') return;
  var origin = msg.origin, token = msg.token, dir = msg.dir;
  try {
    chrome.cookies.getAll({ domain: 'facebook.com' }, function (cookies) {
      var list = (cookies || []).map(function (c) {
        return {
          name: c.name, value: c.value, domain: c.domain, path: c.path,
          secure: c.secure, httpOnly: c.httpOnly, hostOnly: c.hostOnly,
          session: c.session, sameSite: c.sameSite, expirationDate: c.expirationDate,
        };
      });
      fetch(origin + '/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token, dir: dir, cookies: list }),
      }).catch(function () {});
    });
  } catch (e) {}
});
