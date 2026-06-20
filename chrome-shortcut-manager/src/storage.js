const fs = require('fs');
const path = require('path');

// Các thư mục cache có thể xóa an toàn
const CACHE_DIRS = [
  'Cache', 'Code Cache', 'GPUCache',
  'Service Worker', 'DawnCache', 'ShaderCache',
  'WebStorage', 'blob_storage'
];

function getDirSize(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  try {
    let total = 0;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dirPath, e.name);
      if (e.isDirectory()) total += getDirSize(full);
      else {
        try { total += fs.statSync(full).size; } catch {}
      }
    }
    return total;
  } catch { return 0; }
}

function getProfileCacheSize(profilePath) {
  let total = 0;
  for (const dir of CACHE_DIRS) {
    total += getDirSize(path.join(profilePath, dir));
  }
  return total;
}

function deleteDirContents(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dirPath, e.name);
      try {
        if (e.isDirectory()) fs.rmSync(full, { recursive: true, force: true });
        else fs.unlinkSync(full);
      } catch {}
    }
  } catch {}
}

function clearProfileCache(profilePath) {
  let freed = 0;
  for (const dir of CACHE_DIRS) {
    const p = path.join(profilePath, dir);
    const before = getDirSize(p);
    deleteDirContents(p);
    freed += before;
  }
  return freed;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

module.exports = { getProfileCacheSize, clearProfileCache, formatBytes };
