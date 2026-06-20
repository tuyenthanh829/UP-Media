const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const chromeProfiles = require('./src/chromeProfiles');
const shortcuts = require('./src/shortcuts');
const configStore = require('./src/configStore');
const storage = require('./src/storage');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    title: 'Chrome Shortcut Manager',
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

// ── Scan ───────────────────────────────────────────────────
ipcMain.handle('scan-profiles', async () => {
  const config = configStore.getConfig();
  const customPath = config.settings?.chromeUserDataPath || null;
  const { profiles, userDataPath } = chromeProfiles.scanProfiles(customPath);
  configStore.saveSettings({ chromeUserDataPath: userDataPath });

  return {
    profiles: profiles.map((p, idx) => {
      const saved = config.profiles?.[p.profileDirectory] || {};
      // groups migration
      const groups = saved.groups || (saved.group ? [saved.group] : []);
      const shortcutName = saved.shortcutName || p.chromeProfileName || p.profileDirectory;
      return {
        ...p,
        // Tên hiển thị khoa học: dùng số thứ tự dựa trên profileDirectory
        displayIndex: p.profileDirectory === 'Default' ? 0 : (parseInt(p.profileDirectory.replace('Profile ', '')) || idx + 1),
        shortcutName,
        groups,
        notes: saved.notes || '',
        hasShortcut: shortcuts.shortcutExists(shortcutName),
        cacheSize: null // load lazy
      };
    }),
    userDataPath
  };
});

// ── Profile config ─────────────────────────────────────────
ipcMain.handle('save-profile-config', async (_, profileDirectory, data) => {
  return configStore.saveProfileConfig(profileDirectory, data);
});

// ── Shortcuts ──────────────────────────────────────────────
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
    shortcuts.openProfile(profileDirectory);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message === 'CHROME_NOT_FOUND' ? 'Không tìm thấy Google Chrome.' : 'Không mở được profile.' };
  }
});

ipcMain.handle('open-desktop', async () => shell.openPath(shortcuts.getDesktopPath()));
ipcMain.handle('check-shortcut-exists', async (_, name) => shortcuts.shortcutExists(name));

// ── Chọn thư mục thủ công ─────────────────────────────────
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

// ── Nhóm ──────────────────────────────────────────────────
ipcMain.handle('get-groups', async () => configStore.getGroups());
ipcMain.handle('save-groups', async (_, groups) => configStore.saveGroups(groups));

// ── Tạo Chrome profile mới ─────────────────────────────────
ipcMain.handle('create-chrome-profile', async () => {
  try {
    const config = configStore.getConfig();
    const { userDataPath } = chromeProfiles.scanProfiles(config.settings?.chromeUserDataPath || null);
    const newDir = chromeProfiles.getNextProfileDirectory(userDataPath);
    shortcuts.openProfile(newDir);
    return { success: true, profileDirectory: newDir };
  } catch (err) {
    return { success: false, error: err.message === 'CHROME_NOT_FOUND' ? 'Không tìm thấy Google Chrome.' : err.message };
  }
});

// ── Avatar ─────────────────────────────────────────────────
ipcMain.handle('get-avatar-data-url', async (_, avatarPath) => {
  try {
    if (!avatarPath || !fs.existsSync(avatarPath)) return null;
    return 'data:image/png;base64,' + fs.readFileSync(avatarPath).toString('base64');
  } catch { return null; }
});

// ── Storage / Cache ────────────────────────────────────────
ipcMain.handle('get-cache-size', async (_, profilePath) => {
  return storage.getProfileCacheSize(profilePath);
});

ipcMain.handle('get-all-cache-sizes', async () => {
  const config = configStore.getConfig();
  const customPath = config.settings?.chromeUserDataPath || null;
  const { profiles } = chromeProfiles.scanProfiles(customPath);
  const result = {};
  for (const p of profiles) {
    result[p.profileDirectory] = storage.getProfileCacheSize(p.profilePath);
  }
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
  let totalFreed = 0;
  let errorCount = 0;
  for (const p of profiles) {
    try { totalFreed += storage.clearProfileCache(p.profilePath); }
    catch { errorCount++; }
  }
  return { success: true, freed: totalFreed, freedText: storage.formatBytes(totalFreed), errorCount };
});
