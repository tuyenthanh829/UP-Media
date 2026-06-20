const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('app', {
  scanProfiles: () => ipcRenderer.invoke('scan-profiles'),
  saveProfileConfig: (profileDirectory, data) => ipcRenderer.invoke('save-profile-config', profileDirectory, data),
  createShortcut: (profileDirectory, shortcutName) => ipcRenderer.invoke('create-shortcut', profileDirectory, shortcutName),
  deleteShortcut: (shortcutName) => ipcRenderer.invoke('delete-shortcut', shortcutName),
  openProfile: (profileDirectory) => ipcRenderer.invoke('open-profile', profileDirectory),
  openDesktop: () => ipcRenderer.invoke('open-desktop'),
  checkShortcutExists: (shortcutName) => ipcRenderer.invoke('check-shortcut-exists', shortcutName)
});
