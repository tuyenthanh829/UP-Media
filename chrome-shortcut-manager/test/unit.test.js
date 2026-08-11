// Bộ test khởi đầu — chỉ kiểm thử các HÀM LOGIC THUẦN (không phụ thuộc Windows/Electron/Chrome).
// Chạy: npm test   (dùng node:test có sẵn, không cần thư viện ngoài)
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── src/utils.js ──────────────────────────────────────────
const { sanitizeFileName } = require('../src/utils');

test('sanitizeFileName: thay ký tự cấm của Windows bằng _', () => {
  assert.strictEqual(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j'), 'a_b_c_d_e_f_g_h_i_j');
});
test('sanitizeFileName: giữ nguyên tên hợp lệ (có dấu tiếng Việt) + trim', () => {
  assert.strictEqual(sanitizeFileName('  Seeding Facebook 01  '), 'Seeding Facebook 01');
  assert.strictEqual(sanitizeFileName('Khách hàng - Thiên Phú'), 'Khách hàng - Thiên Phú');
});

// ── src/storage.js — formatBytes ──────────────────────────
const { formatBytes } = require('../src/storage');

test('formatBytes: đổi đơn vị đúng ngưỡng', () => {
  assert.strictEqual(formatBytes(0), '0 B');
  assert.strictEqual(formatBytes(512), '512 B');
  assert.strictEqual(formatBytes(1024), '1.0 KB');
  assert.strictEqual(formatBytes(1024 * 1024), '1.0 MB');
  assert.strictEqual(formatBytes(1024 * 1024 * 1024), '1.00 GB');
});

// ── src/configStore.js — load & migration ────────────────
const configStore = require('../src/configStore');

function withTempConfig(configObj, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upm-cfg-'));
  try {
    if (configObj !== undefined) {
      fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(configObj), 'utf8');
    }
    configStore.init(dir);
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('configStore.load: file trống → trả groups mặc định', () => {
  withTempConfig(undefined, () => {
    const cfg = configStore.load();
    assert.ok(Array.isArray(cfg.groups) && cfg.groups.length > 0);
    assert.deepStrictEqual(cfg.profiles, {});
  });
});

test('configStore.load: migrate profile.group (string) → groups (array)', () => {
  withTempConfig({ profiles: { 'Profile 1': { group: 'Seeding' } } }, () => {
    const p = configStore.load().profiles['Profile 1'];
    assert.deepStrictEqual(p.groups, ['Seeding']);
    assert.strictEqual(p.group, undefined);
    assert.strictEqual(p.notes, '');
    assert.deepStrictEqual(p.subGroups, {});
  });
});

test('configStore.load: migrate subGroups value string → array', () => {
  withTempConfig({ profiles: { 'Profile 2': { groups: ['Ads'], subGroups: { Ads: 'Meta' } } } }, () => {
    const p = configStore.load().profiles['Profile 2'];
    assert.deepStrictEqual(p.subGroups.Ads, ['Meta']);
  });
});

test('configStore: saveProfileConfig rồi đọc lại giữ đúng dữ liệu', () => {
  withTempConfig({}, () => {
    configStore.saveProfileConfig('Profile 3', { shortcutName: 'Test 3', notes: 'ghi chú' });
    const p = configStore.load().profiles['Profile 3'];
    assert.strictEqual(p.shortcutName, 'Test 3');
    assert.strictEqual(p.notes, 'ghi chú');
  });
});
