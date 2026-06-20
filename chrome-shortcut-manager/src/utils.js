function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

function formatDateTime(date) {
  return new Date(date).toLocaleString('vi-VN');
}

module.exports = { sanitizeFileName, formatDateTime };
