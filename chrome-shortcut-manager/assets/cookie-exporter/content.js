// Chạy trên trang trigger nội bộ (http://127.0.0.1:<port>/trigger.html).
// Đọc token + dir từ URL rồi nhờ background thu thập cookie và gửi về phần mềm.
(function () {
  try {
    var u = new URL(location.href);
    if (u.pathname.indexOf('/trigger') !== 0) return;
    var token = u.searchParams.get('token');
    var dir = u.searchParams.get('dir') || '';
    if (!token) return;
    chrome.runtime.sendMessage({
      type: 'upm-export-cookies',
      token: token,
      dir: dir,
      origin: location.origin,
    });
  } catch (e) {}
})();
