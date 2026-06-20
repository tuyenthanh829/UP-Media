const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const chromeProfiles = require('./src/chromeProfiles');
const shortcuts = require('./src/shortcuts');
const configStore = require('./src/configStore');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1060,
    height: 780,
    minWidth: 860,
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC: Scan profiles ─────────────────────────────────────
ipcMain.handle('scan-profiles', async () => {
  const config = configStore.getConfig();
  const customPath = config.settings?.chromeUserDataPath || null;

  const { profiles, userDataPath } = chromeProfiles.scanProfiles(customPath);
  configStore.saveSettings({ chromeUserDataPath: userDataPath });

  return {
    profiles: profiles.map(p => {
      const saved = config.profiles?.[p.profileDirectory] || {};
      const shortcutName = saved.shortcutName || p.chromeProfileName || p.profileDirectory;
      return {
        ...p,
        shortcutName,
        group: saved.group || 'Khác',
        hasShortcut: shortcuts.shortcutExists(shortcutName)
      };
    }),
    userDataPath
  };
});

// ── IPC: Profile config ────────────────────────────────────
ipcMain.handle('save-profile-config', async (_, profileDirectory, data) => {
  return configStore.saveProfileConfig(profileDirectory, data);
});

// ── IPC: Shortcut actions ──────────────────────────────────
ipcMain.handle('create-shortcut', async (_, profileDirectory, shortcutName) => {
  try {
    const lnkPath = shortcuts.createShortcut({ profileDirectory, shortcutName });
    return { success: true, path: lnkPath };
  } catch (err) {
    if (err.message === 'CHROME_NOT_FOUND')
      return { success: false, error: 'Không tìm thấy Google Chrome trên máy. Vui lòng kiểm tra lại Chrome đã được cài chưa.' };
    return { success: false, error: 'Không tạo được shortcut. Vui lòng thử chạy app bằng quyền Administrator.' };
  }
});

ipcMain.handle('delete-shortcut', async (_, shortcutName) => {
  try {
    const deleted = shortcuts.deleteShortcut(shortcutName);
    return { success: true, deleted };
  } catch {
    return { success: false, error: 'Không xóa được shortcut.' };
  }
});

ipcMain.handle('open-profile', async (_, profileDirectory) => {
  try {
    shortcuts.openProfile(profileDirectory);
    return { success: true };
  } catch (err) {
    if (err.message === 'CHROME_NOT_FOUND')
      return { success: false, error: 'Không tìm thấy Google Chrome trên máy.' };
    return { success: false, error: 'Không mở được profile Chrome.' };
  }
});

ipcMain.handle('open-desktop', async () => {
  shell.openPath(shortcuts.getDesktopPath());
});

ipcMain.handle('check-shortcut-exists', async (_, shortcutName) => {
  return shortcuts.shortcutExists(shortcutName);
});

// ── IPC: Chọn thư mục Chrome User Data thủ công ───────────
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

ipcMain.handle('get-settings', async () => {
  return configStore.getConfig().settings || {};
});

// ── IPC: Quản lý nhóm ─────────────────────────────────────
ipcMain.handle('get-groups', async () => {
  return configStore.getGroups();
});

ipcMain.handle('save-groups', async (_, groups) => {
  return configStore.saveGroups(groups);
});

// ── IPC: Tạo Chrome profile mới ───────────────────────────
ipcMain.handle('create-chrome-profile', async () => {
  try {
    const config = configStore.getConfig();
    const userDataPath = config.settings?.chromeUserDataPath || null;
    const { userDataPath: foundPath } = chromeProfiles.scanProfiles(userDataPath);

    const newDir = chromeProfiles.getNextProfileDirectory(foundPath);
    shortcuts.openProfile(newDir); // Chrome tự tạo profile mới khi dir chưa tồn tại
    return { success: true, profileDirectory: newDir };
  } catch (err) {
    if (err.message === 'CHROME_NOT_FOUND')
      return { success: false, error: 'Không tìm thấy Google Chrome trên máy.' };
    return { success: false, error: 'Không tạo được profile mới: ' + err.message };
  }
});

// ── IPC: Đọc ảnh avatar profile ───────────────────────────
ipcMain.handle('get-avatar-data-url', async (_, avatarPath) => {
  try {
    if (!avatarPath || !fs.existsSync(avatarPath)) return null;
    const data = fs.readFileSync(avatarPath);
    return 'data:image/png;base64,' + data.toString('base64');
  } catch {
    return null;
  }
});
