const fs = require('fs');
const path = require('path');
const os = require('os');

// Tất cả đường dẫn có thể có của Chrome User Data
function getPossibleUserDataPaths() {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const home = os.homedir();
  const drives = ['C', 'D', 'E', 'F'];

  const paths = [
    // Mặc định
    path.join(localAppData, 'Google', 'Chrome', 'User Data'),
    path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data'),
  ];

  // Thêm các ổ D, E, F với các tên thư mục phổ biến
  for (const drive of drives) {
    paths.push(`${drive}:\\No Delete\\Google\\Chrome\\User Data`);
    paths.push(`${drive}:\\Google\\Chrome\\User Data`);
    paths.push(`${drive}:\\Chrome\\User Data`);
    paths.push(`${drive}:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\User Data`);
  }

  return paths;
}

function findUserDataPath(customPath) {
  // Nếu người dùng đã chỉ định custom path, ưu tiên dùng
  if (customPath && fs.existsSync(customPath)) return customPath;

  for (const p of getPossibleUserDataPaths()) {
    if (fs.existsSync(p)) return p;
  }
  return null;
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

function scanProfiles(customUserDataPath) {
  const userDataPath = findUserDataPath(customUserDataPath);

  if (!userDataPath) {
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

  return { profiles, userDataPath };
}

module.exports = { scanProfiles, findUserDataPath, getPossibleUserDataPaths };
