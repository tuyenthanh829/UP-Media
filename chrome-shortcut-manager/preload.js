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
  // Nhóm
  getGroups: () => ipcRenderer.invoke('get-groups'),
  saveGroups: (groups) => ipcRenderer.invoke('save-groups', groups),
  // Tạo Chrome profile mới
  createChromeProfile: () => ipcRenderer.invoke('create-chrome-profile'),
  // Avatar
  getAvatarDataUrl: (avatarPath) => ipcRenderer.invoke('get-avatar-data-url', avatarPath)
});
