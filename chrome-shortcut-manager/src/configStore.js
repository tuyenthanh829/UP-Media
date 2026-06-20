const fs = require('fs');
const path = require('path');

let configPath = '';

function init(userDataPath) {
  configPath = path.join(userDataPath, 'config.json');
}

function load() {
  if (!configPath) return { profiles: {}, settings: { theme: 'light' } };
  try {
    if (!fs.existsSync(configPath)) return { profiles: {}, settings: { theme: 'light' } };
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { profiles: {}, settings: { theme: 'light' }, _error: true };
  }
}

function save(config) {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

function saveProfileConfig(profileDirectory, data) {
  const config = load();
  if (!config.profiles) config.profiles = {};
  config.profiles[profileDirectory] = { ...config.profiles[profileDirectory], ...data };
  config.settings = config.settings || { theme: 'light' };
  config.settings.lastScanAt = new Date().toISOString();
  return save(config);
}

function getConfig() {
  return load();
}

module.exports = { init, load, save, saveProfileConfig, getConfig };
