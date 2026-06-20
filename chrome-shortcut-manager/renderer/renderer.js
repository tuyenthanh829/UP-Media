let allProfiles = [];

const GROUPS = ['Seeding', 'Ads', 'BM', 'Khách hàng', 'Cá nhân', 'Khác'];

const GROUP_CLASSES = {
  'Seeding': 'seeding',
  'Ads': 'ads',
  'BM': 'bm',
  'Khách hàng': 'khachhang',
  'Cá nhân': 'canhan',
  'Khác': 'khac'
};

function groupClass(group) {
  return GROUP_CLASSES[group] || 'khac';
}

function avatarLetter(name) {
  return (name || '?').charAt(0).toUpperCase();
}

// ── Toast ──────────────────────────────────────────────────
let toastTimer;
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast hidden'; }, 3500);
}

// ── Stats ──────────────────────────────────────────────────
function updateStats(profiles) {
  const total = profiles.length;
  const hasShortcut = profiles.filter(p => p.hasShortcut).length;
  const noShortcut = total - hasShortcut;
  const unnamed = profiles.filter(p => {
    const name = p.shortcutName || '';
    return !name || name === p.profileDirectory || name === p.chromeProfileName;
  }).length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-has-shortcut').textContent = hasShortcut;
  document.getElementById('stat-no-shortcut').textContent = noShortcut;
  document.getElementById('stat-unnamed').textContent = unnamed;
}

// ── Render card ────────────────────────────────────────────
function buildCard(profile) {
  const gc = groupClass(profile.group || 'Khác');
  const hasShortcut = profile.hasShortcut;

  const card = document.createElement('div');
  card.className = 'profile-card';
  card.dataset.profileDir = profile.profileDirectory;

  card.innerHTML = `
    <div class="card-header">
      <div class="card-profile-id">
        <div class="profile-avatar avatar-${gc}">${avatarLetter(profile.shortcutName || profile.chromeProfileName)}</div>
        <div class="profile-name-info">
          <h3>${escHtml(profile.shortcutName || profile.chromeProfileName || profile.profileDirectory)}</h3>
          <div class="profile-dir">Tên gốc Chrome: ${escHtml(profile.chromeProfileName || profile.profileDirectory)}</div>
        </div>
      </div>
      <div class="card-status ${hasShortcut ? 'has' : 'none'}">
        <span class="status-dot"></span>
        ${hasShortcut ? 'Đã có shortcut' : 'Chưa có shortcut'}
      </div>
    </div>

    <div class="card-form">
      <div class="form-row">
        <label class="form-label">Tên shortcut</label>
        <input type="text" class="form-input input-shortcut-name"
          value="${escAttr(profile.shortcutName || '')}"
          placeholder="Nhập tên dễ nhớ..."
          data-profile="${escAttr(profile.profileDirectory)}" />
      </div>
      <div class="form-row">
        <label class="form-label">Nhóm</label>
        <select class="form-select select-group" data-profile="${escAttr(profile.profileDirectory)}">
          ${GROUPS.map(g => `<option value="${g}" ${profile.group === g ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
        <span class="group-badge group-${gc}">${escHtml(profile.group || 'Khác')}</span>
      </div>
    </div>

    <div class="card-actions">
      <button class="btn btn-primary btn-sm btn-open" data-profile="${escAttr(profile.profileDirectory)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
        Mở profile
      </button>
      <button class="btn btn-success btn-sm btn-create" data-profile="${escAttr(profile.profileDirectory)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        Tạo shortcut
      </button>
      <button class="btn btn-danger btn-sm btn-delete" data-profile="${escAttr(profile.profileDirectory)}" ${!hasShortcut ? 'disabled' : ''}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        Xóa shortcut
      </button>
    </div>
  `;

  // Save name on blur
  card.querySelector('.input-shortcut-name').addEventListener('blur', async (e) => {
    const name = e.target.value.trim();
    const dir = e.target.dataset.profile;
    const profile = allProfiles.find(p => p.profileDirectory === dir);
    if (!profile) return;
    profile.shortcutName = name;
    await window.app.saveProfileConfig(dir, { shortcutName: name, group: profile.group });
    refreshCard(card, profile);
  });

  // Save group on change
  card.querySelector('.select-group').addEventListener('change', async (e) => {
    const group = e.target.value;
    const dir = e.target.dataset.profile;
    const profile = allProfiles.find(p => p.profileDirectory === dir);
    if (!profile) return;
    profile.group = group;
    await window.app.saveProfileConfig(dir, { shortcutName: profile.shortcutName, group });
    refreshCard(card, profile);
  });

  // Open profile
  card.querySelector('.btn-open').addEventListener('click', async (e) => {
    const dir = e.currentTarget.dataset.profile;
    const res = await window.app.openProfile(dir);
    if (res.success) showToast('Đang mở Chrome profile...', 'info');
    else showToast(res.error, 'error');
  });

  // Create shortcut
  card.querySelector('.btn-create').addEventListener('click', async (e) => {
    const dir = e.currentTarget.dataset.profile;
    const profile = allProfiles.find(p => p.profileDirectory === dir);
    if (!profile) return;
    const name = profile.shortcutName || profile.chromeProfileName || profile.profileDirectory;
    const res = await window.app.createShortcut(dir, name);
    if (res.success) {
      profile.hasShortcut = true;
      showToast(`Đã tạo shortcut "${name}" ra Desktop!`, 'success');
      refreshCard(card, profile);
      updateStats(allProfiles);
    } else {
      showToast(res.error, 'error');
    }
  });

  // Delete shortcut
  card.querySelector('.btn-delete').addEventListener('click', async (e) => {
    const dir = e.currentTarget.dataset.profile;
    const profile = allProfiles.find(p => p.profileDirectory === dir);
    if (!profile) return;
    const name = profile.shortcutName || profile.chromeProfileName || profile.profileDirectory;
    const res = await window.app.deleteShortcut(name);
    if (res.success) {
      profile.hasShortcut = false;
      showToast(`Đã xóa shortcut "${name}"`, 'warning');
      refreshCard(card, profile);
      updateStats(allProfiles);
    } else {
      showToast(res.error || 'Không xóa được shortcut', 'error');
    }
  });

  return card;
}

function refreshCard(card, profile) {
  const gc = groupClass(profile.group || 'Khác');
  const hasShortcut = profile.hasShortcut;

  // Update avatar
  const avatar = card.querySelector('.profile-avatar');
  avatar.className = `profile-avatar avatar-${gc}`;
  avatar.textContent = avatarLetter(profile.shortcutName || profile.chromeProfileName);

  // Update title
  card.querySelector('.profile-name-info h3').textContent = profile.shortcutName || profile.chromeProfileName || profile.profileDirectory;

  // Update status
  const status = card.querySelector('.card-status');
  status.className = `card-status ${hasShortcut ? 'has' : 'none'}`;
  status.innerHTML = `<span class="status-dot"></span>${hasShortcut ? 'Đã có shortcut' : 'Chưa có shortcut'}`;

  // Update group badge
  const badge = card.querySelector('.group-badge');
  badge.className = `group-badge group-${gc}`;
  badge.textContent = profile.group || 'Khác';

  // Update delete btn
  const delBtn = card.querySelector('.btn-delete');
  delBtn.disabled = !hasShortcut;
}

// ── Render list ────────────────────────────────────────────
function renderProfiles(profiles) {
  const grid = document.getElementById('profile-grid');
  grid.innerHTML = '';

  if (profiles.length === 0) {
    grid.innerHTML = '<div class="no-results"><h3>Không tìm thấy profile nào</h3><p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p></div>';
    return;
  }

  for (const p of profiles) {
    grid.appendChild(buildCard(p));
  }
}

// ── Filter ─────────────────────────────────────────────────
function applyFilter() {
  const query = document.getElementById('search-input').value.trim().toLowerCase();
  const group = document.getElementById('group-filter').value;

  const filtered = allProfiles.filter(p => {
    const matchGroup = !group || p.group === group;
    const matchQuery = !query ||
      (p.profileDirectory || '').toLowerCase().includes(query) ||
      (p.shortcutName || '').toLowerCase().includes(query) ||
      (p.chromeProfileName || '').toLowerCase().includes(query) ||
      (p.group || '').toLowerCase().includes(query);
    return matchGroup && matchQuery;
  });

  renderProfiles(filtered);
}

// ── Scan ───────────────────────────────────────────────────
async function scanProfiles() {
  showState('loading');
  try {
    const result = await window.app.scanProfiles();
    const profiles = result.profiles;
    const userDataPath = result.userDataPath;

    allProfiles = profiles;
    updateStats(profiles);

    // Hiện đường dẫn đang dùng ở header
    const pathInfo = document.getElementById('current-path-info');
    if (pathInfo) {
      pathInfo.style.display = '';
      pathInfo.textContent = `📁 Chrome User Data: ${userDataPath}`;
    }

    if (profiles.length === 0) {
      showState('empty');
      document.getElementById('empty-title').textContent = 'Chưa có profile nào';
      document.getElementById('empty-desc').innerHTML = 'Bấm <strong>"Quét lại profile"</strong> để tìm các tài khoản Chrome trên máy';
      showToast('Chưa tìm thấy profile Chrome nào trên máy.', 'warning');
    } else {
      showState('grid');
      applyFilter();
      showToast(`Tìm thấy ${profiles.length} profile Chrome`, 'success');
    }
  } catch (err) {
    showState('empty');
    const isNotFound = err.message && err.message.includes('NOT_FOUND_USER_DATA');
    document.getElementById('empty-title').textContent = 'Không tìm thấy thư mục Chrome';
    document.getElementById('empty-desc').innerHTML = isNotFound
      ? 'App không tự tìm được thư mục Chrome trên máy.<br>Bấm <strong>"Chọn thư mục Chrome thủ công"</strong> để chỉ đường.'
      : (err.message || 'Có lỗi xảy ra khi quét profile.');
    showToast('Không tìm thấy thư mục Chrome. Hãy chọn thủ công.', 'error');
  }
}

// ── Create all ─────────────────────────────────────────────
async function createAllShortcuts() {
  if (allProfiles.length === 0) {
    showToast('Chưa có profile nào. Vui lòng quét lại.', 'warning');
    return;
  }

  let ok = 0, fail = 0;
  const btn = document.getElementById('btn-create-all');
  btn.disabled = true;
  btn.textContent = 'Đang tạo...';

  for (const p of allProfiles) {
    const name = p.shortcutName || p.chromeProfileName || p.profileDirectory;
    const res = await window.app.createShortcut(p.profileDirectory, name);
    if (res.success) {
      p.hasShortcut = true;
      ok++;
    } else {
      fail++;
    }
  }

  btn.disabled = false;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Tạo tất cả shortcut`;

  updateStats(allProfiles);
  applyFilter();

  if (fail === 0) {
    showToast(`Đã tạo ${ok} shortcut ra Desktop!`, 'success');
  } else {
    showToast(`Tạo thành công ${ok} shortcut, lỗi ${fail} shortcut.`, 'warning');
  }
}

// ── Show/hide state ─────────────────────────────────────────
function showState(state) {
  document.getElementById('empty-state').style.display = state === 'empty' ? '' : 'none';
  document.getElementById('profile-grid').style.display = state === 'grid' ? '' : 'none';
  document.getElementById('loading').style.display = state === 'loading' ? '' : 'none';
}

// ── Helpers ─────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  return String(str || '').replace(/"/g, '&quot;');
}

// ── Init ───────────────────────────────────────────────────
document.getElementById('btn-scan').addEventListener('click', scanProfiles);
document.getElementById('btn-create-all').addEventListener('click', createAllShortcuts);
document.getElementById('btn-open-desktop').addEventListener('click', () => window.app.openDesktop());
document.getElementById('search-input').addEventListener('input', applyFilter);
document.getElementById('group-filter').addEventListener('change', applyFilter);

// Chọn thư mục Chrome User Data thủ công
document.getElementById('btn-pick-folder').addEventListener('click', async () => {
  const chosen = await window.app.pickUserDataFolder();
  if (chosen) {
    showToast(`Đã chọn: ${chosen}`, 'info');
    scanProfiles();
  }
});

// Auto scan on start
window.addEventListener('DOMContentLoaded', scanProfiles);
