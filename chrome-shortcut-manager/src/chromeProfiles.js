const fs = require('fs');
const path = require('path');
const os = require('os');

function getChromeUserDataPath() {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return path.join(localAppData, 'Google', 'Chrome', 'User Data');
}

function readPreferences(profilePath) {
  try {
    const prefsPath = path.join(profilePath, 'Preferences');
    if (!fs.existsSync(prefsPath)) return null;
    const raw = fs.readFileSync(prefsPath, 'utf8');
    const prefs = JSON.parse(raw);
    return prefs?.profile?.name || null;
  } catch {
    return null;
  }
}

function scanProfiles() {
  const userDataPath = getChromeUserDataPath();

  if (!fs.existsSync(userDataPath)) {
    throw new Error('NOT_FOUND_USER_DATA');
  }

  const entries = fs.readdirSync(userDataPath);
  const profiles = [];

  for (const entry of entries) {
    const isDefault = entry === 'Default';
    const isProfile = /^Profile \d+$/.test(entry);
    if (!isDefault && !isProfile) continue;

    const profilePath = path.join(userDataPath, entry);
    try {
      const stat = fs.statSync(profilePath);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }

    const prefsPath = path.join(profilePath, 'Preferences');
    if (!fs.existsSync(prefsPath)) continue;

    const chromeProfileName = readPreferences(profilePath) || entry;

    profiles.push({
      profileDirectory: entry,
      profilePath,
      chromeProfileName,
      shortcutName: '',
      group: 'Khác',
      hasShortcut: false
    });
  }

  profiles.sort((a, b) => {
    if (a.profileDirectory === 'Default') return -1;
    if (b.profileDirectory === 'Default') return 1;
    const numA = parseInt(a.profileDirectory.replace('Profile ', '')) || 0;
    const numB = parseInt(b.profileDirectory.replace('Profile ', '')) || 0;
    return numA - numB;
  });

  return profiles;
}

module.exports = { scanProfiles, getChromeUserDataPath };
