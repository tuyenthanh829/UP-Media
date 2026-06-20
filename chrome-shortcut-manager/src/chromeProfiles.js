const fs = require('fs');
const path = require('path');
const os = require('os');

function getPossibleUserDataPaths() {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const home = os.homedir();
  const drives = ['C', 'D', 'E', 'F'];

  const paths = [
    path.join(localAppData, 'Google', 'Chrome', 'User Data'),
    path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data'),
  ];

  for (const drive of drives) {
    paths.push(`${drive}:\\No Delete\\Google\\Chrome\\User Data`);
    paths.push(`${drive}:\\Google\\Chrome\\User Data`);
    paths.push(`${drive}:\\Chrome\\User Data`);
    paths.push(`${drive}:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\User Data`);
  }

  return paths;
}

function findUserDataPath(customPath) {
  if (customPath && fs.existsSync(customPath)) return customPath;
  for (const p of getPossibleUserDataPaths()) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function readPreferences(profilePath) {
  try {
    const prefsPath = path.join(profilePath, 'Preferences');
    if (!fs.existsSync(prefsPath)) return {};
    const raw = fs.readFileSync(prefsPath, 'utf8');
    const prefs = JSON.parse(raw);
    return {
      name: prefs?.profile?.name || null,
      avatarIndex: prefs?.profile?.avatar_index ?? null,
      gaiaName: prefs?.profile?.gaia_name || null,
      email: prefs?.profile?.user_name || null
    };
  } catch {
    return {};
  }
}

// Tìm ảnh avatar thực của profile (Google Profile Picture)
function findProfileAvatar(profilePath) {
  const candidates = [
    path.join(profilePath, 'Google Profile Picture.png'),
    path.join(profilePath, 'Google Profile.png'),
    path.join(profilePath, 'Avatar.png')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function getNextProfileDirectory(userDataPath) {
  const entries = fs.readdirSync(userDataPath);
  let max = 0;
  for (const e of entries) {
    const m = e.match(/^Profile (\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1]));
  }
  return `Profile ${max + 1}`;
}

function scanProfiles(customUserDataPath) {
  const userDataPath = findUserDataPath(customUserDataPath);
  if (!userDataPath) throw new Error('NOT_FOUND_USER_DATA');

  const entries = fs.readdirSync(userDataPath);
  const profiles = [];

  for (const entry of entries) {
    const isDefault = entry === 'Default';
    const isProfile = /^Profile \d+$/.test(entry);
    if (!isDefault && !isProfile) continue;

    const profilePath = path.join(userDataPath, entry);
    try {
      if (!fs.statSync(profilePath).isDirectory()) continue;
    } catch { continue; }

    const prefsPath = path.join(profilePath, 'Preferences');
    if (!fs.existsSync(prefsPath)) continue;

    const prefs = readPreferences(profilePath);
    const avatarPath = findProfileAvatar(profilePath);

    profiles.push({
      profileDirectory: entry,
      profilePath,
      chromeProfileName: prefs.name || entry,
      gaiaName: prefs.gaiaName || null,
      email: prefs.email || null,
      avatarIndex: prefs.avatarIndex,
      avatarPath: avatarPath || null,
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

  return { profiles, userDataPath };
}

module.exports = { scanProfiles, findUserDataPath, getPossibleUserDataPaths, getNextProfileDirectory };
