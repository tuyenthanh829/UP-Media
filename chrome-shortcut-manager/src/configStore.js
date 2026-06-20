const fs = require('fs');
const path = require('path');

const DEFAULT_GROUPS = ['Seeding', 'Ads', 'BM', 'Khách hàng', 'Cá nhân', 'Khác'];

let configPath = '';

function init(userDataPath) {
  configPath = path.join(userDataPath, 'config.json');
}

function load() {
  const empty = { profiles: {}, groups: DEFAULT_GROUPS, settings: { theme: 'light' } };
  if (!configPath) return empty;
  try {
    if (!fs.existsSync(configPath)) return empty;
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(raw);
    if (!cfg.groups) cfg.groups = DEFAULT_GROUPS;
    if (!cfg.profiles) cfg.profiles = {};
    // Migrate: group (string) → groups (array)
    for (const [dir, p] of Object.entries(cfg.profiles)) {
      if (p.group && !p.groups) {
        p.groups = [p.group];
        delete p.group;
      }
      if (!p.groups) p.groups = [];
      if (!p.notes) p.notes = '';
    }
    return cfg;
  } catch {
    return { ...empty, _error: true };
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

function getGroups() { return load().groups || DEFAULT_GROUPS; }
function saveGroups(groups) {
  const config = load();
  config.groups = groups;
  return save(config);
}
function getConfig() { return load(); }

module.exports = { init, load, save, saveProfileConfig, saveSettings, getGroups, saveGroups, getConfig, DEFAULT_GROUPS };
