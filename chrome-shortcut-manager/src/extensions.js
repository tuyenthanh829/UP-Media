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
  return new Promise(resolve => exec(cmd, (err, stdout, stderr) => resolve({ err, stdout: stdout || '', stderr: stderr || '' })));
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

// ── Liệt kê tiện ích của 1 profile ────────────────────────
// Giải mã tên dạng __MSG_xxx__ từ _locales
function resolveExtName(profilePath, id, manifest) {
  const name = (manifest && manifest.name) || '';
  const short = (manifest && manifest.short_name) || '';
  if (/^__MSG_/.test(name)) {
    const key = name.replace(/^__MSG_/, '').replace(/__$/, '');
    const defLocale = (manifest.default_locale) || 'en';
    try {
      const extDir = path.join(profilePath, 'Extensions', id);
      const versions = fs.readdirSync(extDir).filter(v => !v.startsWith('.'));
      for (const v of versions) {
        for (const loc of [defLocale, 'en', 'vi']) {
          const msgPath = path.join(extDir, v, '_locales', loc, 'messages.json');
          if (fs.existsSync(msgPath)) {
            const msgs = JSON.parse(fs.readFileSync(msgPath, 'utf8'));
            const entry = msgs[key] || msgs[key.toLowerCase()];
            if (entry && entry.message) return entry.message;
          }
        }
      }
    } catch {}
    return short || id;
  }
  return name || short || id;
}

function readExtSettings(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    const prefs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return (prefs.extensions || {}).settings || {};
  } catch { return {}; }
}

function listProfileExtensions(profilePath) {
  // Chrome hiện đại lưu extensions.settings trong "Secure Preferences";
  // bản cũ có thể ở "Preferences". Gộp cả hai.
  const settings = {
    ...readExtSettings(path.join(profilePath, 'Preferences')),
    ...readExtSettings(path.join(profilePath, 'Secure Preferences')),
  };
  if (!Object.keys(settings).length) return [];
  const out = [];
  for (const [id, s] of Object.entries(settings)) {
    if (!/^[a-p]{32}$/.test(id)) continue;   // chỉ nhận ID tiện ích hợp lệ (a-p, 32 ký tự)
    const manifest = s.manifest || {};
    if (!manifest.version) continue;         // bỏ qua mục không phải tiện ích đã cài
    if (manifest.theme) continue;            // bỏ qua theme
    if (s.location === 5) continue;          // bỏ qua component (tích hợp sẵn Chrome)
    out.push({
      id,
      name: resolveExtName(profilePath, id, manifest),
      version: manifest.version || '',
      enabled: s.state === 1,
      fromWebstore: !!s.from_webstore,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

// ── Xóa tiện ích theo danh sách ID (tổng quát) ────────────
function cleanPreferencesIds(prefPath, ids) {
  if (!fs.existsSync(prefPath)) return 0;
  let prefs;
  try { prefs = JSON.parse(fs.readFileSync(prefPath, 'utf8')); } catch { return 0; }
  let removed = 0;
  const ext = prefs.extensions || {};
  const settings = ext.settings || {};
  for (const id of ids) {
    if (settings[id]) { delete settings[id]; removed++; }
    if (Array.isArray(ext.pinned_extensions)) {
      const i = ext.pinned_extensions.indexOf(id);
      if (i !== -1) ext.pinned_extensions.splice(i, 1);
    }
    if (ext.install_signature && ext.install_signature.ids) {
      ext.install_signature.ids = ext.install_signature.ids.filter(x => x !== id);
    }
  }
  if (removed > 0) { try { fs.writeFileSync(prefPath, JSON.stringify(prefs), 'utf8'); } catch { return 0; } }
  return removed;
}

function removeExtensionIdsFromProfile(profilePath, ids) {
  let removed = cleanPreferencesIds(path.join(profilePath, 'Preferences'), ids);
  cleanPreferencesIds(path.join(profilePath, 'Secure Preferences'), ids);
  for (const id of ids) {
    const extDir = path.join(profilePath, 'Extensions', id);
    if (fs.existsSync(extDir)) {
      try { fs.rmSync(extDir, { recursive: true, force: true }); removed++; } catch {}
    }
  }
  return { removed };
}

// Dọn hàng chờ tự cài (registry + External Extensions) cho các ID bất kỳ
async function removeQueueForIds(ids) {
  const tasks = [];
  for (const regBase of REGISTRY_PATHS) {
    for (const id of ids) tasks.push(runCmd(`reg delete "${regBase}\\${id}" /f 2>nul`));
  }
  await Promise.all(tasks);
  const externalExtDirs = [
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Extensions'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Extensions'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'External Extensions'),
  ];
  for (const dir of externalExtDirs) {
    for (const id of ids) {
      const jsonFile = path.join(dir, `${id}.json`);
      try { if (fs.existsSync(jsonFile)) fs.unlinkSync(jsonFile); } catch {}
    }
  }
}

// ── Áp dụng chính sách force-install / block cho toàn máy ──
const WEBSTORE_UPDATE = 'https://clients2.google.com/service/update2/crx';
const POLICY_ROOTS = [
  'HKLM\\SOFTWARE\\Policies\\Google\\Chrome',
  'HKLM\\SOFTWARE\\WOW6432Node\\Policies\\Google\\Chrome',
  'HKCU\\SOFTWARE\\Policies\\Google\\Chrome',   // HKCU không cần quyền admin
];

async function applyExtensionPolicy(forcelist, blocklist) {
  const wipe = [];
  for (const root of POLICY_ROOTS) {
    wipe.push(runCmd(`reg delete "${root}\\ExtensionInstallForcelist" /f 2>nul`));
    wipe.push(runCmd(`reg delete "${root}\\ExtensionInstallBlocklist" /f 2>nul`));
  }
  await Promise.all(wipe);

  const add = [];
  for (const root of POLICY_ROOTS) {
    if (forcelist.length) {
      add.push(runCmd(`reg add "${root}\\ExtensionInstallForcelist" /f 2>nul`));
      forcelist.forEach((id, i) => add.push(runCmd(
        `reg add "${root}\\ExtensionInstallForcelist" /v "${i + 1}" /t REG_SZ /d "${id};${WEBSTORE_UPDATE}" /f 2>nul`)));
    }
    if (blocklist.length) {
      add.push(runCmd(`reg add "${root}\\ExtensionInstallBlocklist" /f 2>nul`));
      blocklist.forEach((id, i) => add.push(runCmd(
        `reg add "${root}\\ExtensionInstallBlocklist" /v "${i + 1}" /t REG_SZ /d "${id}" /f 2>nul`)));
    }
  }
  await Promise.all(add);

  // Ghi thêm file policy JSON managed (dự phòng, cần quyền admin)
  const policyDirs = [
    path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Google', 'Chrome', 'policies', 'managed'),
  ];
  const content = JSON.stringify({
    ExtensionInstallForcelist: forcelist.map(id => `${id};${WEBSTORE_UPDATE}`),
    ExtensionInstallBlocklist: blocklist,
  }, null, 2);
  for (const dir of policyDirs) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'upmedia_extensions.json'), content, 'utf8');
    } catch {}
  }

  // Kiểm chứng: đọc lại registry xem policy đã ghi thành công chưa
  const verify = { hkcu: '', hklm: '' };
  await Promise.all([
    new Promise(r => exec('reg query "HKCU\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionInstallForcelist"', (e, o) => { verify.hkcu = o || ''; r(); })),
    new Promise(r => exec('reg query "HKLM\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionInstallForcelist"', (e, o) => { verify.hklm = o || ''; r(); })),
  ]);
  const idsInReg = forcelist.filter(id => verify.hkcu.includes(id) || verify.hklm.includes(id));
  return {
    hkcuOk: /ExtensionInstallForcelist/i.test(verify.hkcu),
    hklmOk: /ExtensionInstallForcelist/i.test(verify.hklm),
    idsWritten: idsInReg,
    allWritten: forcelist.length === 0 || idsInReg.length === forcelist.length,
  };
}

module.exports = {
  removeExtensionsFromProfile, removeFromRegistryAsync, EXEMPT_NAMES, REMOVE_IDS,
  listProfileExtensions, removeExtensionIdsFromProfile, removeQueueForIds,
  applyExtensionPolicy, WEBSTORE_UPDATE,
};
