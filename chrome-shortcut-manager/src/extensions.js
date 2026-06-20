const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Extension IDs to remove
const REMOVE_IDS = [
  'fheoggkfdfchfphceeifdbepaooicaho', // McAfee WebAdvisor
  'ngpampappnmepgilojfohadhhmbhlaek', // IDM Integration Module
  'aioifelanmcjnlailbmjfmgclhepmjbo', // IDM CC
  'hdokiejnpimakedhajhdlcegeplioahd', // McAfee alternative ID
];

// Profiles (by shortcutName) exempt from cleanup
const EXEMPT_NAMES = ['Tuyennt.upmedia Default', 'T93 Profile 1'];

// Registry paths where Chrome gets auto-install instructions
const REGISTRY_PATHS = [
  'HKLM\\SOFTWARE\\WOW6432Node\\Google\\Chrome\\Extensions',
  'HKLM\\SOFTWARE\\Google\\Chrome\\Extensions',
  'HKCU\\SOFTWARE\\Google\\Chrome\\Extensions',
  'HKCU\\SOFTWARE\\WOW6432Node\\Google\\Chrome\\Extensions',
];

function removeFromRegistryAsync() {
  return Promise.all(
    REGISTRY_PATHS.flatMap(regBase =>
      REMOVE_IDS.map(id =>
        new Promise(resolve => {
          exec(`reg delete "${regBase}\\${id}" /f 2>nul`, () => resolve());
        })
      )
    )
  );
}

function cleanPreferencesFile(prefPath) {
  if (!fs.existsSync(prefPath)) return 0;
  let prefs;
  try { prefs = JSON.parse(fs.readFileSync(prefPath, 'utf8')); }
  catch { return 0; }

  let removed = 0;
  const settings = (prefs.extensions || {}).settings || {};

  for (const id of REMOVE_IDS) {
    if (settings[id]) { delete settings[id]; removed++; }
    // Remove from pinned
    const pinned = (prefs.extensions || {}).pinned_extensions;
    if (Array.isArray(pinned)) {
      const idx = pinned.indexOf(id);
      if (idx !== -1) pinned.splice(idx, 1);
    }
    // Remove from install signature if present
    const sig = (prefs.extensions || {}).install_signature;
    if (sig && sig.ids) {
      sig.ids = sig.ids.filter(x => x !== id);
    }
  }

  if (removed > 0) {
    try { fs.writeFileSync(prefPath, JSON.stringify(prefs), 'utf8'); }
    catch { return 0; }
  }
  return removed;
}

function removeExtensionsFromProfile(profilePath) {
  // Clean Preferences
  const prefPath = path.join(profilePath, 'Preferences');
  let removed = cleanPreferencesFile(prefPath);

  // Clean Secure Preferences (same structure, different file)
  const securePrefPath = path.join(profilePath, 'Secure Preferences');
  cleanPreferencesFile(securePrefPath);

  // Delete physical extension folders
  for (const id of REMOVE_IDS) {
    const extDir = path.join(profilePath, 'Extensions', id);
    if (fs.existsSync(extDir)) {
      try { fs.rmSync(extDir, { recursive: true, force: true }); removed++; } catch {}
    }
  }

  return { removed };
}

module.exports = { removeExtensionsFromProfile, removeFromRegistryAsync, EXEMPT_NAMES };
