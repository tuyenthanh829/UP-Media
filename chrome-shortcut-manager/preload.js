const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('app', {
  scanProfiles: () => ipcRenderer.invoke('scan-profiles'),
  saveProfileConfig: (dir, data) => ipcRenderer.invoke('save-profile-config', dir, data),
  createShortcut: (dir, name) => ipcRenderer.invoke('create-shortcut', dir, name),
  deleteShortcut: (name) => ipcRenderer.invoke('delete-shortcut', name),
  openProfile: (dir) => ipcRenderer.invoke('open-profile', dir),
  openDesktop: () => ipcRenderer.invoke('open-desktop'),
  checkShortcutExists: (name) => ipcRenderer.invoke('check-shortcut-exists', name),
  pickUserDataFolder: () => ipcRenderer.invoke('pick-user-data-folder'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getGroups: () => ipcRenderer.invoke('get-groups'),
  saveGroups: (groups) => ipcRenderer.invoke('save-groups', groups),
  createChromeProfile: () => ipcRenderer.invoke('create-chrome-profile'),
  getAvatarDataUrl: (p) => ipcRenderer.invoke('get-avatar-data-url', p),
  getCacheSize: (profilePath) => ipcRenderer.invoke('get-cache-size', profilePath),
  getAllCacheSizes: () => ipcRenderer.invoke('get-all-cache-sizes'),
  clearCache: (profilePath) => ipcRenderer.invoke('clear-cache', profilePath),
  clearAllCache: () => ipcRenderer.invoke('clear-all-cache'),
});
