const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');

const chromeProfiles = require('./src/chromeProfiles');
const shortcuts = require('./src/shortcuts');
const configStore = require('./src/configStore');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 800,
    minHeight: 600,
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

// IPC handlers
ipcMain.handle('scan-profiles', async () => {
  try {
    const config = configStore.getConfig();
    const customPath = config.settings?.chromeUserDataPath || null;

    const { profiles, userDataPath } = chromeProfiles.scanProfiles(customPath);

    // Lưu lại đường dẫn đã tìm thấy để UI hiển thị
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
  } catch (err) {
    if (err.message === 'NOT_FOUND_USER_DATA') {
      throw new Error('NOT_FOUND_USER_DATA');
    }
    throw err;
  }
});

ipcMain.handle('save-profile-config', async (_, profileDirectory, data) => {
  return configStore.saveProfileConfig(profileDirectory, data);
});

ipcMain.handle('create-shortcut', async (_, profileDirectory, shortcutName) => {
  try {
    const lnkPath = shortcuts.createShortcut({ profileDirectory, shortcutName });
    return { success: true, path: lnkPath };
  } catch (err) {
    if (err.message === 'CHROME_NOT_FOUND') {
      return { success: false, error: 'Không tìm thấy Google Chrome trên máy. Vui lòng kiểm tra lại Chrome đã được cài chưa.' };
    }
    return { success: false, error: 'Không tạo được shortcut. Vui lòng thử chạy app bằng quyền Administrator hoặc kiểm tra quyền ghi Desktop.' };
  }
});

ipcMain.handle('delete-shortcut', async (_, shortcutName) => {
  try {
    const deleted = shortcuts.deleteShortcut(shortcutName);
    return { success: true, deleted };
  } catch (err) {
    return { success: false, error: 'Không xóa được shortcut.' };
  }
});

ipcMain.handle('open-profile', async (_, profileDirectory) => {
  try {
    shortcuts.openProfile(profileDirectory);
    return { success: true };
  } catch (err) {
    if (err.message === 'CHROME_NOT_FOUND') {
      return { success: false, error: 'Không tìm thấy Google Chrome trên máy.' };
    }
    return { success: false, error: 'Không mở được profile Chrome.' };
  }
});

ipcMain.handle('open-desktop', async () => {
  shell.openPath(shortcuts.getDesktopPath());
});

ipcMain.handle('check-shortcut-exists', async (_, shortcutName) => {
  return shortcuts.shortcutExists(shortcutName);
});

// Cho user chọn thư mục Chrome User Data thủ công
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
  const config = configStore.getConfig();
  return config.settings || {};
});
