const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const chromeProfiles = require('./src/chromeProfiles');
const shortcuts = require('./src/shortcuts');
const configStore = require('./src/configStore');
const storage = require('./src/storage');
const extensions = require('./src/extensions');
const history = require('./src/history');
const accounts = require('./src/accounts');
const social = require('./src/socialAccounts');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'Chrome Manager by UP Media',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#f8fafc',
    show: false
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
  configStore.init(app.getPath('userData'));
  createWindow();
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

ipcMain.handle('open-profile', async (_, profileDirectory) => {
  try {
    const config = configStore.getConfig();
    const userDataPath = config.settings?.chromeUserDataPath || null;
    shortcuts.openProfile(profileDirectory, userDataPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message === 'CHROME_NOT_FOUND' ? 'Không tìm thấy Google Chrome.' : 'Không mở được profile.' };
  }
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
  let ok = 0, fail = 0;
  for (const dir of profileDirectories) {
    try { shortcuts.openProfile(dir, userDataPath); ok++; await new Promise(r => setTimeout(r, 350)); }
    catch { fail++; }
  }
  return { success: true, ok, fail };
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

ipcMain.handle('remove-bad-extensions', async () => {
  const config = configStore.getConfig();
  const customPath = config.settings?.chromeUserDataPath || null;
  const { profiles } = chromeProfiles.scanProfiles(customPath);
  let totalRemoved = 0, skipped = 0;
  const results = [];

  for (const p of profiles) {
    const saved = config.profiles?.[p.profileDirectory] || {};
    const shortcutName = saved.shortcutName || p.chromeProfileName || p.profileDirectory;
    const isExempt = extensions.EXEMPT_NAMES.some(e => shortcutName === e);
    if (isExempt) { skipped++; continue; }
    const { removed } = extensions.removeExtensionsFromProfile(p.profilePath);
    totalRemoved += removed;
    if (removed > 0) results.push({ name: shortcutName, removed });
  }

  extensions.removeFromRegistryAsync().catch(() => {});
  return { success: true, totalRemoved, skipped, results };
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

ipcMain.handle('get-social-status-batch', async (_, profilePaths, sites) => {
  const results = {};
  for (const { dir, profilePath } of profilePaths) {
    results[dir] = await social.getSocialStatus(profilePath, sites);
  }
  return results;
});
