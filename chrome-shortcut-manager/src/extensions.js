const fs = require('fs');
const path = require('path');

const REMOVE_IDS = [
  'fheoggkfdfchfphceeifdbepaooicaho', // McAfee WebAdvisor
  'ngpampappnmepgilojfohadhhmbhlaek', // IDM Integration Module
  'aioifelanmcjnlailbmjfmgclhepmjbo', // IDM CC
];

// Profiles (by shortcutName) to skip
const EXEMPT_NAMES = ['Tuyennt.upmedia Default', 'T93 Profile 1'];

function removeExtensionsFromProfile(profilePath) {
  const prefPath = path.join(profilePath, 'Preferences');
  if (!fs.existsSync(prefPath)) return { removed: 0 };

  let prefs;
  try { prefs = JSON.parse(fs.readFileSync(prefPath, 'utf8')); }
  catch { return { removed: 0 }; }

  let removed = 0;
  const settings = (prefs.extensions || {}).settings || {};

  for (const id of REMOVE_IDS) {
    if (settings[id]) { delete settings[id]; removed++; }
    const pinned = (prefs.extensions || {}).pinned_extensions;
    if (Array.isArray(pinned)) {
      const idx = pinned.indexOf(id);
      if (idx !== -1) pinned.splice(idx, 1);
    }
    // Also remove physical folder
    const extDir = path.join(profilePath, 'Extensions', id);
    if (fs.existsSync(extDir)) {
      try { fs.rmSync(extDir, { recursive: true, force: true }); } catch {}
    }
  }

  if (removed > 0) {
    try { fs.writeFileSync(prefPath, JSON.stringify(prefs), 'utf8'); }
    catch { return { removed: 0 }; }
  }
  return { removed };
}

module.exports = { removeExtensionsFromProfile, EXEMPT_NAMES };
