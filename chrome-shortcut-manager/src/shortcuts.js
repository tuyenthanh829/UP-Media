const fs = require('fs');
const path = require('path');
const { shell, app } = require('electron');
const { sanitizeFileName } = require('./utils');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];

function findChrome() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function getDesktopPath() {
  return app.getPath('desktop');
}

function getShortcutPath(shortcutName) {
  const safe = sanitizeFileName(shortcutName);
  return path.join(getDesktopPath(), safe + '.lnk');
}

function shortcutExists(shortcutName) {
  return fs.existsSync(getShortcutPath(shortcutName));
}

function createShortcut({ profileDirectory, shortcutName }) {
  const chromePath = findChrome();
  if (!chromePath) throw new Error('CHROME_NOT_FOUND');

  const safe = sanitizeFileName(shortcutName);
  const lnkPath = path.join(getDesktopPath(), safe + '.lnk');

  const result = shell.writeShortcutLink(lnkPath, 'create', {
    target: chromePath,
    args: `--profile-directory="${profileDirectory}"`,
    icon: chromePath,
    iconIndex: 0,
    description: `Mở Chrome profile: ${shortcutName}`
  });

  if (!result) throw new Error('WRITE_FAILED');
  return lnkPath;
}

function deleteShortcut(shortcutName) {
  const lnkPath = getShortcutPath(shortcutName);
  if (fs.existsSync(lnkPath)) {
    fs.unlinkSync(lnkPath);
    return true;
  }
  return false;
}

function openProfile(profileDirectory) {
  const chromePath = findChrome();
  if (!chromePath) throw new Error('CHROME_NOT_FOUND');
  const { spawn } = require('child_process');
  spawn(chromePath, [`--profile-directory=${profileDirectory}`], { detached: true, stdio: 'ignore' }).unref();
}

function openProfileWithUrl(profileDirectory, url) {
  const chromePath = findChrome();
  if (!chromePath) throw new Error('CHROME_NOT_FOUND');
  const { spawn } = require('child_process');
  spawn(chromePath, [`--profile-directory=${profileDirectory}`, url], { detached: true, stdio: 'ignore' }).unref();
}

module.exports = { findChrome, createShortcut, deleteShortcut, shortcutExists, openProfile, openProfileWithUrl, getDesktopPath };
