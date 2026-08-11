const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execFile } = require('child_process');
const crypto = require('crypto');
const XLSX = require('xlsx');

// Chờ cookie do extension gửi về, khớp theo token
const pendingCookieCaptures = new Map();

function copyDirRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

const chromeProfiles = require('./src/chromeProfiles');
const shortcuts = require('./src/shortcuts');
const configStore = require('./src/configStore');
const storage = require('./src/storage');
const extensions = require('./src/extensions');
const extHost = require('./src/extHost');
const history = require('./src/history');
const accounts = require('./src/accounts');
const social = require('./src/socialAccounts');

let mainWindow;

// ── Tự chạy dưới quyền Administrator (khắc phục lỗi thỉnh thoảng không bắt được Unikey) ──
// Windows chỉ cho tiến trình gõ tiếng Việt vào cửa sổ CÙNG hoặc THẤP hơn mức toàn vẹn (UAC).
// Chạy app ở mức Administrator giúp nó nhận được ký tự Unikey ổn định hơn.
function isElevated() {
  return new Promise(resolve => {
    // "net session" chỉ chạy được khi có quyền Administrator → mã lỗi khác 0 nghĩa là chưa nâng quyền
    exec('net session', { windowsHide: true }, err => resolve(!err));
  });
}

// Trả về true nếu được phép tiếp tục chạy tiến trình hiện tại; false nếu đã relaunch bản nâng quyền và cần thoát.
async function ensureElevated() {
  if (process.platform !== 'win32') return true;
  if (!app.isPackaged) return true;              // môi trường dev: bỏ qua để không lặp UAC
  if (process.argv.includes('--elevated')) return true; // đã là bản được relaunch
  // Cho phép người dùng tắt tính năng trong Cài đặt
  const settings = configStore.getConfig().settings || {};
  if (settings.autoElevate === false) return true;
  if (await isElevated()) return true;

  return new Promise(resolve => {
    const exe = process.execPath.replace(/'/g, "''");
    const psCmd = `Start-Process -FilePath '${exe}' -ArgumentList '--elevated' -Verb RunAs`;
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCmd], err => {
      if (err) {
        // Người dùng bấm "No" ở UAC (hoặc lỗi) → vẫn chạy tiếp bản thường để không mất phần mềm
        resolve(true);
      } else {
        // Đã mở bản nâng quyền → đóng bản thường này
        app.quit();
        resolve(false);
      }
    });
  });
}

// Menu tối giản: chỉ giữ nhóm "Chỉnh sửa" để phím Sao chép/Dán vẫn hoạt động,
// đồng thời BỎ các phím tắt mặc định (Ctrl+R nạp lại, Ctrl+Q thoát) để nhường cho phím tắt trong app.
function setupAppMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Chỉnh sửa',
      submenu: [
        { role: 'undo', label: 'Hoàn tác' },
        { role: 'redo', label: 'Làm lại' },
        { type: 'separator' },
        { role: 'cut', label: 'Cắt' },
        { role: 'copy', label: 'Sao chép' },
        { role: 'paste', label: 'Dán' },
        { role: 'selectAll', label: 'Chọn tất cả' },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'Chrome Manager by UP Media',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    autoHideMenuBar: true,   // Ẩn thanh menu (vẫn giữ phím Sao chép/Dán)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#f8fafc',
    show: false
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();   // Mở toàn màn hình theo mặc định
    mainWindow.show();
  });
}

app.whenReady().then(async () => {
  configStore.init(app.getPath('userData'));

  if (!(await ensureElevated())) return;   // đã relaunch bản Administrator → thoát bản thường

  setupAppMenu();
  createWindow();

  // Khởi động localhost host cho tiện ích tự đóng gói; cập nhật lại URL theo port mới
  try {
    extHost.init(app.getPath('userData'));
    extHost.onCookies(data => {
      if (!data || !data.token) return;
      const pend = pendingCookieCaptures.get(data.token);
      if (pend) { pendingCookieCaptures.delete(data.token); clearTimeout(pend.timer); pend.resolve(data.cookies || []); }
    });
    const p = await extHost.start(47810);
    extHost.writeTrigger();
    const exts = configStore.getExternalExtensions();
    if (p && exts.length) {
      extHost.rehostAll(exts);
      const pol = configStore.getExtPolicy();
      for (const e of exts) pol.updateUrls[e.id] = extHost.updateUrlFor(e.id);
      configStore.saveExtPolicy(pol);
      await extensions.applyExtensionPolicy(pol.forcelist, pol.blocklist, pol.updateUrls);
    }
  } catch { /* ignore */ }
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// Scan
ipcMain.handle('scan-profiles', async () => {
  const config = configStore.getConfig();
  const customPath = config.settings?.chromeUserDataPath || null;
  const { profiles, userDataPath } = chromeProfiles.scanProfiles(customPath);
  configStore.saveSettings({ chromeUserDataPath: userDataPath });

  return {
    profiles: profiles.map((p, idx) => {
      const saved = config.profiles?.[p.profileDirectory] || {};
      const groups = saved.groups || (saved.group ? [saved.group] : []);
      const shortcutName = saved.shortcutName || p.chromeProfileName || p.profileDirectory;
      return {
        ...p,
        displayIndex: p.profileDirectory === 'Default' ? 0 : (parseInt(p.profileDirectory.replace('Profile ', '')) || idx + 1),
        shortcutName,
        groups,
        subGroups: saved.subGroups || {},
        notes: saved.notes || '',
        hasShortcut: shortcuts.shortcutExists(shortcutName),
        cacheSize: null,
        googleAccounts: accounts.getGoogleAccounts(p.profilePath),
      };
    }),
    userDataPath
  };
});

ipcMain.handle('save-profile-config', async (_, profileDirectory, data) => {
  return configStore.saveProfileConfig(profileDirectory, data);
});

ipcMain.handle('check-duplicate-name', async (_, profileDirectory, name) => {
  if (!name || !name.trim()) return { isDuplicate: false };
  const config = configStore.getConfig();
  const profiles = config.profiles || {};
  for (const [dir, p] of Object.entries(profiles)) {
    if (dir === profileDirectory) continue;
    if ((p.shortcutName || '').trim().toLowerCase() === name.trim().toLowerCase()) {
      return { isDuplicate: true, conflictDir: dir, conflictName: p.shortcutName };
    }
  }
  return { isDuplicate: false };
});

function isChromeRunningForProfile(profileDirectory) {
  return new Promise(resolve => {
    exec('wmic process where "name=\'chrome.exe\'" get CommandLine /format:list', (err, stdout) => {
      if (err || !stdout) { resolve(false); return; }
      const lower = stdout.toLowerCase();
      const dir = profileDirectory.toLowerCase();
      resolve(lower.includes(`--profile-directory=${dir}`) || lower.includes(`profile-directory="${dir}"`));
    });
  });
}

// Lấy tập hợp các profile-directory hiện đang được Chrome mở (một lần gọi wmic).
// Dùng để không mở chồng Chrome đã mở sẵn (tránh mở trùng qua mỗi lần thao tác / reload).
function getRunningProfileDirs() {
  return new Promise(resolve => {
    exec('wmic process where "name=\'chrome.exe\'" get CommandLine /format:list', { windowsHide: true }, (err, stdout) => {
      const set = new Set();
      if (err || !stdout) { resolve(set); return; }
      const re = /--profile-directory=("([^"]+)"|([^\s"]+))/gi;
      let m;
      while ((m = re.exec(stdout)) !== null) {
        const dir = (m[2] || m[3] || '').trim();
        if (dir) set.add(dir.toLowerCase());
      }
      resolve(set);
    });
  });
}

ipcMain.handle('delete-chrome-profile', async (_, profilePath, profileDirectory, displayName) => {
  const running = await isChromeRunningForProfile(profileDirectory);
  if (running) {
    await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Chrome đang mở',
      message: `Không thể xóa — Chrome đang chạy profile "${displayName}"`,
      detail: 'Vui lòng đóng Chrome trước rồi thử lại.\nBấm nút "Đóng tất cả Chrome" trên toolbar để tắt tất cả.',
      buttons: ['OK']
    });
    return { success: false, cancelled: true };
  }

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Xác nhận xóa profile',
    message: `Xóa tài khoản Chrome "${displayName}"?`,
    detail: `Hành động này sẽ XÓA VĨNH VIỄN tất cả dữ liệu của tài khoản này bao gồm: lịch sử duyệt web, cookie, mật khẩu đã lưu, bookmark...\n\nThư mục: ${profilePath}`,
    buttons: ['Hủy bỏ', 'XÓA VĨNH VIỄN'],
    defaultId: 0,
    cancelId: 0
  });

  if (response !== 1) return { success: false, cancelled: true };

  try {
    if (fs.existsSync(profilePath)) fs.rmSync(profilePath, { recursive: true, force: true });
    configStore.deleteProfileConfig(profileDirectory);
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Không xóa được: ' + err.message };
  }
});

ipcMain.handle('kill-all-chrome', async () => {
  return new Promise(resolve => {
    exec('taskkill /F /IM chrome.exe /T', (err, stdout, stderr) => {
      const output = (stdout + stderr).toLowerCase();
      const notFound = output.includes('not found') || output.includes('không tìm thấy') || (err && err.code === 128);
      resolve({ success: true, notFound });
    });
  });
});

ipcMain.handle('create-shortcut', async (_, profileDirectory, shortcutName) => {
  try {
    const lnkPath = shortcuts.createShortcut({ profileDirectory, shortcutName });
    return { success: true, path: lnkPath };
  } catch (err) {
    if (err.message === 'CHROME_NOT_FOUND')
      return { success: false, error: 'Không tìm thấy Google Chrome trên máy.' };
    return { success: false, error: 'Không tạo được shortcut. Thử chạy app bằng quyền Administrator.' };
  }
});

ipcMain.handle('delete-shortcut', async (_, shortcutName) => {
  try {
    return { success: true, deleted: shortcuts.deleteShortcut(shortcutName) };
  } catch {
    return { success: false, error: 'Không xóa được shortcut.' };
  }
});

ipcMain.handle('open-profile', async (_, profileDirectory, opts) => {
  try {
    // Nếu Chrome đã mở sẵn profile này thì không mở chồng lần 2 (trừ khi ép mở)
    if (!(opts && opts.force) && await isChromeRunningForProfile(profileDirectory)) {
      return { success: true, alreadyOpen: true };
    }
    const config = configStore.getConfig();
    const userDataPath = config.settings?.chromeUserDataPath || null;
    shortcuts.openProfile(profileDirectory, userDataPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message === 'CHROME_NOT_FOUND' ? 'Không tìm thấy Google Chrome.' : 'Không mở được profile.' };
  }
});

// Trả về danh sách profile-directory đang được Chrome mở (chữ thường)
ipcMain.handle('get-running-profiles', async () => {
  return Array.from(await getRunningProfileDirs());
});

ipcMain.handle('open-profile-url', async (_, profileDirectory, url) => {
  try {
    const config = configStore.getConfig();
    const userDataPath = config.settings?.chromeUserDataPath || null;
    shortcuts.openProfileWithUrl(profileDirectory, url, userDataPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-profiles-batch', async (_, profileDirectories) => {
  const config = configStore.getConfig();
  const userDataPath = config.settings?.chromeUserDataPath || null;
  const running = await getRunningProfileDirs();   // bỏ qua profile đã mở sẵn
  let ok = 0, fail = 0, skipped = 0;
  for (const dir of profileDirectories) {
    if (running.has(String(dir).toLowerCase())) { skipped++; continue; }
    try { shortcuts.openProfile(dir, userDataPath); ok++; await new Promise(r => setTimeout(r, 350)); }
    catch { fail++; }
  }
  return { success: true, ok, fail, skipped };
});

ipcMain.handle('check-shortcut-exists', async (_, name) => shortcuts.shortcutExists(name));

ipcMain.handle('pick-user-data-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Chọn thư mục Chrome User Data',
    properties: ['openDirectory'],
    buttonLabel: 'Chọn thư mục này'
  });
  if (result.canceled || !result.filePaths.length) return null;
  const chosen = result.filePaths[0];
  configStore.saveSettings({ chromeUserDataPath: chosen });
  return chosen;
});

ipcMain.handle('get-version', async () => app.getVersion());
ipcMain.handle('get-settings', async () => configStore.getConfig().settings || {});

ipcMain.handle('get-groups', async () => configStore.getGroups());
ipcMain.handle('save-groups', async (_, groups) => configStore.saveGroups(groups));
ipcMain.handle('get-group-subs', async () => configStore.getGroupSubs());
ipcMain.handle('save-group-subs', async (_, groupSubs) => configStore.saveGroupSubs(groupSubs));

ipcMain.handle('create-chrome-profile', async (_, friendlyName, groups, subGroups, notes) => {
  try {
    const config = configStore.getConfig();
    const { userDataPath } = chromeProfiles.scanProfiles(config.settings?.chromeUserDataPath || null);
    const newDir = chromeProfiles.getNextProfileDirectory(userDataPath);
    const saveData = {};
    if (friendlyName && friendlyName.trim()) saveData.shortcutName = friendlyName.trim();
    if (Array.isArray(groups) && groups.length) saveData.groups = groups;
    if (subGroups && Object.keys(subGroups).length) saveData.subGroups = subGroups;
    if (notes && notes.trim()) saveData.notes = notes.trim();
    if (Object.keys(saveData).length) configStore.saveProfileConfig(newDir, saveData);
    shortcuts.openProfile(newDir, userDataPath);
    return { success: true, profileDirectory: newDir };
  } catch (err) {
    return { success: false, error: err.message === 'CHROME_NOT_FOUND' ? 'Không tìm thấy Google Chrome.' : err.message };
  }
});

ipcMain.handle('get-avatar-data-url', async (_, avatarPath) => {
  try {
    if (!avatarPath || !fs.existsSync(avatarPath)) return null;
    return 'data:image/png;base64,' + fs.readFileSync(avatarPath).toString('base64');
  } catch { return null; }
});

ipcMain.handle('get-cache-size', async (_, profilePath) => storage.getProfileCacheSize(profilePath));

ipcMain.handle('get-all-cache-sizes', async () => {
  const config = configStore.getConfig();
  const customPath = config.settings?.chromeUserDataPath || null;
  const { profiles } = chromeProfiles.scanProfiles(customPath);
  const result = {};
  for (const p of profiles) result[p.profileDirectory] = storage.getProfileCacheSize(p.profilePath);
  return result;
});

ipcMain.handle('clear-cache', async (_, profilePath) => {
  try {
    const freed = storage.clearProfileCache(profilePath);
    return { success: true, freed, freedText: storage.formatBytes(freed) };
  } catch (err) {
    return { success: false, error: 'Không xóa được cache: ' + err.message };
  }
});

ipcMain.handle('clear-all-cache', async () => {
  const config = configStore.getConfig();
  const customPath = config.settings?.chromeUserDataPath || null;
  const { profiles } = chromeProfiles.scanProfiles(customPath);
  let totalFreed = 0, errorCount = 0;
  for (const p of profiles) {
    try { totalFreed += storage.clearProfileCache(p.profilePath); }
    catch { errorCount++; }
  }
  return { success: true, freed: totalFreed, freedText: storage.formatBytes(totalFreed), errorCount };
});

// ── Quản lý tiện ích ──────────────────────────────────────
// 1. Liệt kê tiện ích của 1 profile
ipcMain.handle('list-profile-extensions', async (_, profilePath) => {
  try { return { success: true, items: extensions.listProfileExtensions(profilePath) }; }
  catch (err) { return { success: false, error: err.message, items: [] }; }
});

// Đếm số tiện ích của tất cả profile (cho chế độ hàng tinh gọn)
ipcMain.handle('count-all-extensions', async () => {
  const config = configStore.getConfig();
  const customPath = config.settings?.chromeUserDataPath || null;
  const { profiles } = chromeProfiles.scanProfiles(customPath);
  const result = {};
  for (const p of profiles) {
    try { result[p.profileDirectory] = extensions.listProfileExtensions(p.profilePath).length; }
    catch { result[p.profileDirectory] = 0; }
  }
  return result;
});

// 3. Xóa 1 tiện ích khỏi TẤT CẢ profile + chặn tự cài lại (kể cả hàng chờ)
ipcMain.handle('delete-extension-everywhere', async (_, extId) => {
  if (!/^[a-p]{32}$/.test(extId || '')) return { success: false, error: 'ID tiện ích không hợp lệ' };
  // Đóng Chrome để mở khóa Preferences trước khi sửa
  await new Promise(resolve => { exec('taskkill /F /IM chrome.exe /T', () => resolve()); });
  await new Promise(r => setTimeout(r, 800));

  const config = configStore.getConfig();
  const customPath = config.settings?.chromeUserDataPath || null;
  const { profiles } = chromeProfiles.scanProfiles(customPath);
  let totalRemoved = 0, profilesAffected = 0;
  for (const p of profiles) {
    const { removed } = extensions.removeExtensionIdsFromProfile(p.profilePath, [extId]);
    if (removed > 0) { totalRemoved += removed; profilesAffected++; }
  }

  await extensions.removeQueueForIds([extId]);

  // Cập nhật chính sách: bỏ khỏi forcelist, thêm vào blocklist
  const pol = configStore.getExtPolicy();
  pol.forcelist = pol.forcelist.filter(id => id !== extId);
  delete pol.updateUrls[extId];
  if (!pol.blocklist.includes(extId)) pol.blocklist.push(extId);
  configStore.saveExtPolicy(pol);
  // Gỡ khỏi danh sách tiện ích tự host nếu có
  const exts = configStore.getExternalExtensions().filter(e => e.id !== extId);
  configStore.saveExternalExtensions(exts);
  await extensions.applyExtensionPolicy(pol.forcelist, pol.blocklist, pol.updateUrls);

  return { success: true, totalRemoved, profilesAffected };
});

// 2B. Nhân bản 1 tiện ích ra TẤT CẢ Chrome qua chính sách force-install
ipcMain.handle('copy-extension-to-all', async (_, extId) => {
  if (!/^[a-p]{32}$/.test(extId || '')) return { success: false, error: 'ID tiện ích không hợp lệ' };
  const pol = configStore.getExtPolicy();
  pol.blocklist = pol.blocklist.filter(id => id !== extId);
  if (!pol.forcelist.includes(extId)) pol.forcelist.push(extId);
  configStore.saveExtPolicy(pol);
  const verify = await extensions.applyExtensionPolicy(pol.forcelist, pol.blocklist, pol.updateUrls);
  const written = (verify.idsWritten || []).includes(extId);
  return {
    success: written,
    hkcuOk: verify.hkcuOk, hklmOk: verify.hklmOk,
    error: written ? null : 'Không ghi được policy vào registry. Thử chạy phần mềm bằng quyền Administrator.',
  };
});

// Danh sách chính sách hiện tại (để UI hiển thị / gỡ)
ipcMain.handle('get-ext-policy', async () => configStore.getExtPolicy());
ipcMain.handle('clear-ext-policy-entry', async (_, extId) => {
  const pol = configStore.getExtPolicy();
  pol.forcelist = pol.forcelist.filter(id => id !== extId);
  pol.blocklist = pol.blocklist.filter(id => id !== extId);
  delete pol.updateUrls[extId];
  configStore.saveExtPolicy(pol);
  await extensions.applyExtensionPolicy(pol.forcelist, pol.blocklist, pol.updateUrls);
  return { success: true };
});

// P2: Nhập tiện ích NGOÀI STORE hàng loạt — đóng gói thư mục → host → force-install
ipcMain.handle('install-external-extension', async () => {
  const chromePath = shortcuts.findChrome();
  if (!chromePath) return { success: false, error: 'Không tìm thấy Google Chrome.' };
  if (!extHost.getPort()) return { success: false, error: 'Máy chủ nội bộ chưa sẵn sàng. Mở lại phần mềm rồi thử lại.' };

  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Chọn thư mục tiện ích (đã giải nén, có manifest.json)',
    properties: ['openDirectory'],
    buttonLabel: 'Chọn thư mục này',
  });
  if (res.canceled || !res.filePaths.length) return { success: false, cancelled: true };

  let packed;
  try { packed = await extHost.packAndHost(chromePath, res.filePaths[0]); }
  catch (err) { return { success: false, error: err.message }; }

  // Lưu vào danh sách tự host + policy force-install với update URL nội bộ
  const exts = configStore.getExternalExtensions().filter(e => e.id !== packed.id);
  exts.push({ id: packed.id, version: packed.version, folder: res.filePaths[0], name: path.basename(res.filePaths[0]) });
  configStore.saveExternalExtensions(exts);

  const pol = configStore.getExtPolicy();
  pol.blocklist = pol.blocklist.filter(id => id !== packed.id);
  if (!pol.forcelist.includes(packed.id)) pol.forcelist.push(packed.id);
  pol.updateUrls[packed.id] = packed.updateUrl;
  configStore.saveExtPolicy(pol);
  const verify = await extensions.applyExtensionPolicy(pol.forcelist, pol.blocklist, pol.updateUrls);

  const written = (verify.idsWritten || []).includes(packed.id);
  return {
    success: written,
    id: packed.id, version: packed.version,
    error: written ? null : 'Không ghi được policy vào registry. Thử chạy phần mềm bằng quyền Administrator.',
  };
});

// ── Export / Import dữ liệu cấu hình profile (Excel) ──────
const COL = { dir: 'Thư mục', name: 'Tên profile', groups: 'Nhóm', subs: 'Danh mục con', notes: 'Ghi chú' };

function encodeSubGroups(subGroups) {
  return Object.entries(subGroups || {})
    .filter(([, arr]) => arr && arr.length)
    .map(([g, arr]) => `${g}: ${arr.join(', ')}`)
    .join('; ');
}
function decodeSubGroups(str) {
  const out = {};
  String(str || '').split(';').forEach(part => {
    const idx = part.indexOf(':');
    if (idx === -1) return;
    const g = part.slice(0, idx).trim();
    const subs = part.slice(idx + 1).split(',').map(s => s.trim()).filter(Boolean);
    if (g && subs.length) out[g] = subs;
  });
  return out;
}
function splitList(str) { return String(str || '').split(/[,;]/).map(s => s.trim()).filter(Boolean); }
// Lấy giá trị ô theo tên cột, chấp nhận cả có dấu lẫn không dấu / hoa thường
function pick(row, label) {
  if (row[label] != null) return row[label];
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,'');
  const want = norm(label);
  for (const k of Object.keys(row)) if (norm(k) === want) return row[k];
  return '';
}

ipcMain.handle('export-data', async () => {
  const config = configStore.getConfig();
  const { profiles } = chromeProfiles.scanProfiles(config.settings?.chromeUserDataPath || null);
  const rows = profiles.map(p => {
    const saved = config.profiles?.[p.profileDirectory] || {};
    return {
      [COL.dir]: p.profileDirectory,
      [COL.name]: saved.shortcutName || p.chromeProfileName || p.profileDirectory,
      [COL.groups]: (saved.groups || []).join(', '),
      [COL.subs]: encodeSubGroups(saved.subGroups),
      [COL.notes]: saved.notes || '',
    };
  });

  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Xuất dữ liệu ra Excel',
    defaultPath: `upmedia-chrome-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (res.canceled || !res.filePath) return { success: false, cancelled: true };
  try {
    const ws = XLSX.utils.json_to_sheet(rows, { header: [COL.dir, COL.name, COL.groups, COL.subs, COL.notes] });
    ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 22 }, { wch: 32 }, { wch: 42 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Profiles');
    XLSX.writeFile(wb, res.filePath);
    return { success: true, path: res.filePath, count: rows.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Tải file Excel mẫu để điền thông tin nhập hàng loạt
ipcMain.handle('export-template', async () => {
  const rows = [
    { [COL.dir]: '(để trống — tự tạo)', [COL.name]: 'Seeding FB 01', [COL.groups]: 'Seeding, BM', [COL.subs]: 'Seeding: Facebook', [COL.notes]: 'Ví dụ tài khoản seeding' },
    { [COL.dir]: '(để trống — tự tạo)', [COL.name]: 'Ads Meta 02', [COL.groups]: 'Ads', [COL.subs]: 'Ads: Meta, Google', [COL.notes]: '' },
    { [COL.dir]: '(để trống — tự tạo)', [COL.name]: '', [COL.groups]: '', [COL.subs]: '', [COL.notes]: '' },
  ];
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Lưu file Excel mẫu',
    defaultPath: 'upmedia-mau-nhap-profile.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (res.canceled || !res.filePath) return { success: false, cancelled: true };
  try {
    const ws = XLSX.utils.json_to_sheet(rows, { header: [COL.dir, COL.name, COL.groups, COL.subs, COL.notes] });
    ws['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 22 }, { wch: 32 }, { wch: 42 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mau nhap');
    XLSX.writeFile(wb, res.filePath);
    return { success: true, path: res.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Import từ Excel → tự tạo Chrome profile mới cho từng dòng
ipcMain.handle('import-data', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Nhập dữ liệu từ Excel',
    properties: ['openFile'],
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls', 'csv'] }],
  });
  if (res.canceled || !res.filePaths.length) return { success: false, cancelled: true };

  let rows;
  try {
    const wb = XLSX.readFile(res.filePaths[0]);
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  } catch { return { success: false, error: 'File Excel không đọc được.' }; }
  if (!rows.length) return { success: false, error: 'File không có dòng dữ liệu nào.' };

  const config = configStore.getConfig();
  const { userDataPath } = chromeProfiles.scanProfiles(config.settings?.chromeUserDataPath || null);

  // Gộp nhóm mới xuất hiện vào cấu hình
  const curGroups = new Set(configStore.getGroups() || []);
  const curSubs = configStore.getGroupSubs() || {};

  let nextIdx = 0;
  try {
    for (const e of fs.readdirSync(userDataPath)) {
      const m = e.match(/^Profile (\d+)$/);
      if (m) nextIdx = Math.max(nextIdx, parseInt(m[1]));
    }
  } catch {}

  let created = 0, failed = 0;
  for (const row of rows) {
    const name = String(pick(row, COL.name) || '').trim();
    const groups = splitList(pick(row, COL.groups));
    const subGroups = decodeSubGroups(pick(row, COL.subs));
    const notes = String(pick(row, COL.notes) || '').trim();
    if (!name && !groups.length && !notes) continue;   // bỏ dòng trống

    groups.forEach(g => curGroups.add(g));
    for (const [g, subs] of Object.entries(subGroups)) {
      curSubs[g] = Array.from(new Set([...(curSubs[g] || []), ...subs]));
    }

    nextIdx++;
    const newDir = `Profile ${nextIdx}`;
    const saveData = {};
    if (name) saveData.shortcutName = name;
    if (groups.length) saveData.groups = groups;
    if (Object.keys(subGroups).length) saveData.subGroups = subGroups;
    if (notes) saveData.notes = notes;
    try {
      if (Object.keys(saveData).length) configStore.saveProfileConfig(newDir, saveData);
      shortcuts.openProfile(newDir, userDataPath);
      created++;
      await new Promise(r => setTimeout(r, 600));
    } catch { failed++; }
  }

  configStore.saveGroups(Array.from(curGroups));
  configStore.saveGroupSubs(curSubs);
  return { success: true, created, failed, total: rows.length };
});

// Xuất extension "Lấy cookie Facebook" ra Desktop để cài thủ công (load unpacked)
ipcMain.handle('export-cookie-extension', async () => {
  const srcDir = path.join(__dirname, 'assets', 'fb-cookie-extension');
  const destDir = path.join(shortcuts.getDesktopPath(), 'UP Media - FB Cookie Extension');
  try {
    copyDirRecursive(srcDir, destDir);
    shell.openPath(destDir);
    return { success: true, path: destDir };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Đóng gói extension Cookie Facebook thành ZIP sẵn sàng upload lên Chrome Web Store.
ipcMain.handle('zip-cookie-extension', async () => {
  const srcDir = path.join(__dirname, 'assets', 'fb-cookie-extension');
  const destZip = path.join(shortcuts.getDesktopPath(), 'fb-cookie-extension.zip');
  const psQuote = value => `'${String(value).replace(/'/g, "''")}'`;
  const command = [
    `$src = ${psQuote(srcDir)}`,
    `$dest = ${psQuote(destZip)}`,
    "Compress-Archive -Path (Join-Path $src '*') -DestinationPath $dest -Force",
  ].join('; ');

  try {
    await new Promise((resolve, reject) => {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], (error, _stdout, stderr) => {
        if (error) reject(new Error((stderr || error.message).trim()));
        else resolve();
      });
    });
    shell.showItemInFolder(destZip);
    return { success: true, path: destZip };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-cookie-store-id', async (_, extId) => {
  const id = String(extId || '').trim();
  if (id && !/^[a-p]{32}$/.test(id)) {
    return { success: false, error: 'Extension ID phải gồm 32 ký tự từ a đến p.' };
  }
  const success = configStore.saveSettings({ cookieStoreExtId: id });
  return { success, error: success ? null : 'Không lưu được Extension ID.' };
});

// ── Xuất cookie Facebook qua localhost (opt-in) ───────────
ipcMain.handle('get-cookie-export-enabled', async () => ({
  enabled: !!(configStore.getConfig().settings || {}).cookieExportEnabled,
}));

ipcMain.handle('set-cookie-export-enabled', async (_, enabled) => {
  const pol = configStore.getExtPolicy();
  let exts = configStore.getExternalExtensions();
  const settings = configStore.getConfig().settings || {};

  if (enabled) {
    const chromePath = shortcuts.findChrome();
    if (!chromePath) return { success: false, error: 'Không tìm thấy Google Chrome.' };
    if (!extHost.getPort()) return { success: false, error: 'Máy chủ nội bộ chưa sẵn sàng.' };
    const srcDir = path.join(__dirname, 'assets', 'cookie-exporter');
    const dstDir = path.join(app.getPath('userData'), 'ext-host', 'cookie-exporter');
    try { copyDirRecursive(srcDir, dstDir); }
    catch (e) { return { success: false, error: 'Không sao chép được extension: ' + e.message }; }

    let packed;
    try { packed = await extHost.packAndHost(chromePath, dstDir); }
    catch (e) { return { success: false, error: e.message }; }
    extHost.writeTrigger();

    exts = exts.filter(e => e.id !== packed.id);
    exts.push({ id: packed.id, version: packed.version, folder: dstDir, name: 'UP Media Cookie Exporter', cookieExporter: true });
    configStore.saveExternalExtensions(exts);

    pol.blocklist = pol.blocklist.filter(id => id !== packed.id);
    if (!pol.forcelist.includes(packed.id)) pol.forcelist.push(packed.id);
    pol.updateUrls[packed.id] = packed.updateUrl;
    configStore.saveExtPolicy(pol);
    const verify = await extensions.applyExtensionPolicy(pol.forcelist, pol.blocklist, pol.updateUrls);
    if (!(verify.idsWritten || []).includes(packed.id))
      return { success: false, error: 'Không ghi được policy vào registry. Thử chạy bằng quyền Administrator.' };

    configStore.saveSettings({ cookieExportEnabled: true, cookieExporterId: packed.id });
    return { success: true, id: packed.id };
  } else {
    const id = settings.cookieExporterId;
    if (id) {
      pol.forcelist = pol.forcelist.filter(x => x !== id);
      delete pol.updateUrls[id];
      configStore.saveExtPolicy(pol);
      configStore.saveExternalExtensions(exts.filter(e => e.id !== id));
      await extensions.applyExtensionPolicy(pol.forcelist, pol.blocklist, pol.updateUrls);
    }
    configStore.saveSettings({ cookieExportEnabled: false });
    return { success: true };
  }
});

ipcMain.handle('export-facebook-cookies', async (_, profileDirectory) => {
  const settings = configStore.getConfig().settings || {};
  if (!settings.cookieExportEnabled) return { success: false, error: 'Chưa bật xuất cookie trong Cài đặt.' };
  const port = extHost.getPort();
  if (!port) return { success: false, error: 'Máy chủ nội bộ chưa sẵn sàng.' };

  const token = crypto.randomBytes(8).toString('hex');
  const url = `http://127.0.0.1:${port}/trigger.html?token=${token}&dir=${encodeURIComponent(profileDirectory)}`;
  const cookiesP = new Promise(resolve => {
    const timer = setTimeout(() => { pendingCookieCaptures.delete(token); resolve(null); }, 20000);
    pendingCookieCaptures.set(token, { resolve, timer });
  });
  try { shortcuts.openProfileWithUrl(profileDirectory, url, settings.chromeUserDataPath || null); }
  catch (e) { return { success: false, error: e.message }; }

  const cookies = await cookiesP;
  if (!cookies) return { success: false, error: 'Không nhận được phản hồi từ extension. Vào chrome://extensions kiểm tra "UP Media Cookie Exporter" đã được cài chưa. Nếu chưa: vào Cài đặt bật lại xuất cookie → ĐÓNG HẲN toàn bộ Chrome (cả khay đồng hồ) rồi mở lại.' };
  if (!cookies.length) return { success: false, error: 'Không tìm thấy cookie Facebook trong profile này.' };
  return { success: true, cookies };
});

// Bật/tắt khởi động cùng Windows
ipcMain.handle('get-auto-launch', async () => {
  try { return app.getLoginItemSettings().openAtLogin; }
  catch { return false; }
});
ipcMain.handle('set-auto-launch', async (_, enabled) => {
  try {
    app.setLoginItemSettings({ openAtLogin: !!enabled, path: process.execPath });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Bật/tắt tự chạy dưới quyền Administrator (mặc định BẬT)
ipcMain.handle('get-auto-elevate', async () => {
  const settings = configStore.getConfig().settings || {};
  return settings.autoElevate !== false;
});
ipcMain.handle('set-auto-elevate', async (_, enabled) => {
  const success = configStore.saveSettings({ autoElevate: !!enabled });
  return { success };
});

ipcMain.handle('get-profile-history', async (_, profilePath) => {
  return history.getProfileHistory(profilePath, 25);
});

ipcMain.handle('get-google-accounts', async (_, profilePath) => {
  return accounts.getGoogleAccounts(profilePath);
});

ipcMain.handle('get-social-status', async (_, profilePath, sites) => {
  return social.getSocialStatus(profilePath, sites);
});

ipcMain.handle('get-social-sites', async () => {
  return configStore.getSocialSites() || social.DEFAULT_SOCIAL_SITES;
});

ipcMain.handle('get-cookies-for-domain', async (_, profilePath, domain) => {
  return social.getCookiesForDomain(profilePath, domain);
});

ipcMain.handle('save-social-sites', async (_, sites) => {
  configStore.saveSocialSites(sites);
  return true;
});

ipcMain.handle('rename-group-in-profiles', async (_, oldName, newName) => {
  return configStore.renameGroupInProfiles(oldName, newName);
});

ipcMain.handle('debug-social-status', async (_, profilePath, sites) => {
  return social.debugSocialStatus(profilePath, sites);
});

// Kill all Chrome, open a specific profile fresh with debug port, wait for port to open.
// Used by the "Mở Chrome Debug" button in social diagnostic panel.
ipcMain.handle('kill-and-open-debug', async (_, profileDirectory) => {
  const { isPortOpen } = require('./src/chromeCdp');
  const config = configStore.getConfig();
  const userDataPath = config.settings?.chromeUserDataPath || null;

  // Kill Chrome and verify all processes are dead (up to 5s)
  await new Promise(resolve => { exec('taskkill /F /IM chrome.exe /T', () => resolve()); });
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 500));
    const alive = await new Promise(resolve => {
      exec('wmic process where "name=\'chrome.exe\'" get ProcessId /format:list', (err, stdout) => {
        resolve(!err && stdout && stdout.includes('ProcessId=') && /ProcessId=\d+/.test(stdout));
      });
    });
    if (!alive) break;
    if (i === 9) {
      // Force kill again if still running after 5s
      await new Promise(resolve => { exec('taskkill /F /IM chrome.exe /T', () => resolve()); });
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Open profile with debug port
  try {
    shortcuts.openProfile(profileDirectory, userDataPath);
  } catch (err) {
    return { success: false, error: err.message };
  }

  // Poll for port 9223 to open (up to 20s — Chrome can be slow to start)
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await isPortOpen(9223)) return { success: true, port: 9223 };
  }
  return { success: false, error: 'CDP port 9223 không mở sau 20 giây. Chrome 130+ consumer build có thể đã tắt remote debugging. Thử đọc cookie khi Chrome đóng.' };
});

// Kill Chrome (all processes), read social status from unlocked file, reopen Chrome.
// Chrome releases the file lock immediately when the process exits.
ipcMain.handle('social-status-kill-reopen', async (_, profileDirectory, profilePath, sites) => {
  const config = configStore.getConfig();
  const userDataPath = config.settings?.chromeUserDataPath || null;

  // Kill all Chrome processes
  await new Promise(resolve => { exec('taskkill /F /IM chrome.exe /T', () => resolve()); });

  // Wait briefly — file lock releases as soon as chrome.exe exits
  await new Promise(r => setTimeout(r, 800));

  // Read cookies (Chrome is dead, no lock)
  const status = await social.getSocialStatus(profilePath, sites);

  // Reopen Chrome with the same profile
  try { shortcuts.openProfile(profileDirectory, userDataPath); } catch { /* ignore */ }

  return status;
});

ipcMain.handle('get-social-status-batch', async (_, profilePaths, sites) => {
  const results = {};
  for (const { dir, profilePath } of profilePaths) {
    results[dir] = await social.getSocialStatus(profilePath, sites);
  }
  return results;
});
