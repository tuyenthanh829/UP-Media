const fs = require('fs');
const path = require('path');

const DEFAULT_GROUPS = ['Seeding', 'Ads', 'BM', 'Khách hàng', 'Cá nhân', 'Khác'];

let configPath = '';

function init(userDataPath) {
  configPath = path.join(userDataPath, 'config.json');
}

function load() {
  if (!configPath) return { profiles: {}, groups: DEFAULT_GROUPS, settings: { theme: 'light' } };
  try {
    if (!fs.existsSync(configPath)) return { profiles: {}, groups: DEFAULT_GROUPS, settings: { theme: 'light' } };
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(raw);
    if (!cfg.groups) cfg.groups = DEFAULT_GROUPS;
    return cfg;
  } catch {
    return { profiles: {}, groups: DEFAULT_GROUPS, settings: { theme: 'light' }, _error: true };
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
  config.settings = config.settings || {};
  config.settings.lastScanAt = new Date().toISOString();
  return save(config);
}

function saveSettings(settings) {
  const config = load();
  config.settings = { ...config.settings, ...settings };
  return save(config);
}

function getGroups() {
  return load().groups || DEFAULT_GROUPS;
}

function saveGroups(groups) {
  const config = load();
  config.groups = groups;
  return save(config);
}

function getConfig() {
  return load();
}

module.exports = { init, load, save, saveProfileConfig, saveSettings, getGroups, saveGroups, getConfig, DEFAULT_GROUPS };
