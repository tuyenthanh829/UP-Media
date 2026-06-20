const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const REMOVE_IDS = [
  'fheoggkfdfchfphceeifdbepaooicaho', // McAfee WebAdvisor
  'ngpampappnmepgilojfohadhhmbhlaek', // IDM Integration Module
  'aioifelanmcjnlailbmjfmgclhepmjbo', // IDM CC
  'hdokiejnpimakedhajhdlcegeplioahd', // McAfee alternative ID
  'lifbcibllhkdhoafpjfnlhfpfgnpldfl', // IDM (another variant)
];

const EXEMPT_NAMES = ['Tuyennt.upmedia Default', 'T93 Profile 1'];

// Registry paths where Chrome gets auto-install instructions
const REGISTRY_PATHS = [
  'HKLM\\SOFTWARE\\WOW6432Node\\Google\\Chrome\\Extensions',
  'HKLM\\SOFTWARE\\Google\\Chrome\\Extensions',
  'HKCU\\SOFTWARE\\Google\\Chrome\\Extensions',
  'HKCU\\SOFTWARE\\WOW6432Node\\Google\\Chrome\\Extensions',
];

// Chrome enterprise policy blocklist paths
const POLICY_PATHS = [
  'HKLM\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionInstallBlocklist',
  'HKLM\\SOFTWARE\\WOW6432Node\\Policies\\Google\\Chrome\\ExtensionInstallBlocklist',
];

function runCmd(cmd) {
  return new Promise(resolve => exec(cmd, () => resolve()));
}

async function removeFromRegistryAsync() {
  const tasks = [];

  // 1. Delete auto-install registry entries
  for (const regBase of REGISTRY_PATHS) {
    for (const id of REMOVE_IDS) {
      tasks.push(runCmd(`reg delete "${regBase}\\${id}" /f 2>nul`));
    }
  }

  // 2. Set Chrome enterprise policy to block these extensions permanently
  for (const policyBase of POLICY_PATHS) {
    // Create the policy key
    tasks.push(runCmd(`reg add "${policyBase}" /f 2>nul`));
    REMOVE_IDS.forEach((id, i) => {
      tasks.push(runCmd(`reg add "${policyBase}" /v "${i + 1}" /t REG_SZ /d "${id}" /f 2>nul`));
    });
  }

  await Promise.all(tasks);

  // 3. Delete external extension JSON files (prevents Chrome from auto-installing on next launch)
  const externalExtDirs = [
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Extensions'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Extensions'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'External Extensions'),
  ];

  for (const dir of externalExtDirs) {
    for (const id of REMOVE_IDS) {
      const jsonFile = path.join(dir, `${id}.json`);
      try { if (fs.existsSync(jsonFile)) fs.unlinkSync(jsonFile); } catch {}
    }
  }

  // 4. Write Chrome policies JSON file (belt-and-suspenders approach)
  const policyDirs = [
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'policies', 'managed'),
    path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Google', 'Chrome', 'policies', 'managed'),
  ];
  const policyContent = JSON.stringify({
    ExtensionInstallBlocklist: REMOVE_IDS,
    ExtensionInstallForcelist: [],
  }, null, 2);

  for (const dir of policyDirs) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'block_extensions.json'), policyContent, 'utf8');
    } catch {}
  }
}

function cleanPreferencesFile(prefPath) {
  if (!fs.existsSync(prefPath)) return 0;
  let prefs;
  try { prefs = JSON.parse(fs.readFileSync(prefPath, 'utf8')); } catch { return 0; }

  let removed = 0;
  const settings = (prefs.extensions || {}).settings || {};

  for (const id of REMOVE_IDS) {
    if (settings[id]) { delete settings[id]; removed++; }
    const pinned = (prefs.extensions || {}).pinned_extensions;
    if (Array.isArray(pinned)) {
      const idx = pinned.indexOf(id);
      if (idx !== -1) pinned.splice(idx, 1);
    }
    const sig = (prefs.extensions || {}).install_signature;
    if (sig && sig.ids) sig.ids = sig.ids.filter(x => x !== id);
  }

  if (removed > 0) {
    try { fs.writeFileSync(prefPath, JSON.stringify(prefs), 'utf8'); } catch { return 0; }
  }
  return removed;
}

function removeExtensionsFromProfile(profilePath) {
  let removed = cleanPreferencesFile(path.join(profilePath, 'Preferences'));
  cleanPreferencesFile(path.join(profilePath, 'Secure Preferences'));

  for (const id of REMOVE_IDS) {
    const extDir = path.join(profilePath, 'Extensions', id);
    if (fs.existsSync(extDir)) {
      try { fs.rmSync(extDir, { recursive: true, force: true }); removed++; } catch {}
    }
  }

  return { removed };
}

module.exports = { removeExtensionsFromProfile, removeFromRegistryAsync, EXEMPT_NAMES, REMOVE_IDS };
