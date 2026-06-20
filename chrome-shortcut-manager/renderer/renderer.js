let allProfiles = [];
let allGroups = [];

const DEFAULT_GROUPS = ['Seeding', 'Ads', 'BM', 'Khách hàng', 'Cá nhân', 'Khác'];

// ── Group helpers ──────────────────────────────────────────
const BUILTIN_GROUP_CLASSES = {
  'Seeding': 'seeding', 'Ads': 'ads', 'BM': 'bm',
  'Khách hàng': 'khachhang', 'Cá nhân': 'canhan', 'Khác': 'khac'
};

function groupClass(group) {
  return BUILTIN_GROUP_CLASSES[group] || 'custom';
}

function avatarLetter(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function buildGroupOptions(selectedGroup) {
  return allGroups.map(g =>
    `<option value="${escAttr(g)}" ${g === selectedGroup ? 'selected' : ''}>${escHtml(g)}</option>`
  ).join('');
}

function refreshGroupFilter() {
  const sel = document.getElementById('group-filter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Tất cả nhóm</option>' +
    allGroups.map(g => `<option value="${escAttr(g)}" ${g === cur ? 'selected' : ''}>${escHtml(g)}</option>`).join('');
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
  document.getElementById('stat-total').textContent = profiles.length;
  document.getElementById('stat-has-shortcut').textContent = profiles.filter(p => p.hasShortcut).length;
  document.getElementById('stat-no-shortcut').textContent = profiles.filter(p => !p.hasShortcut).length;
  document.getElementById('stat-unnamed').textContent = profiles.filter(p => {
    const n = p.shortcutName || '';
    return !n || n === p.profileDirectory || n === p.chromeProfileName;
  }).length;
}

// ── Build avatar element ───────────────────────────────────
async function buildAvatarEl(profile) {
  const gc = groupClass(profile.group || 'Khác');
  const el = document.createElement('div');
  el.className = `profile-avatar avatar-${gc}`;

  if (profile.avatarPath) {
    const dataUrl = await window.app.getAvatarDataUrl(profile.avatarPath);
    if (dataUrl) {
      el.innerHTML = `<img src="${dataUrl}" alt="avatar" />`;
      return el;
    }
  }
  el.textContent = avatarLetter(profile.shortcutName || profile.chromeProfileName);
  return el;
}

// ── Build card ─────────────────────────────────────────────
async function buildCard(profile) {
  const gc = groupClass(profile.group || 'Khác');
  const hasShortcut = profile.hasShortcut;

  const card = document.createElement('div');
  card.className = 'profile-card';
  card.dataset.profileDir = profile.profileDirectory;

  const emailLine = profile.email
    ? `<div class="profile-email">${escHtml(profile.email)}</div>` : '';

  card.innerHTML = `
    <div class="card-header">
      <div class="card-profile-id">
        <div class="profile-avatar-wrap"></div>
        <div class="profile-name-info">
          <h3>${escHtml(profile.shortcutName || profile.chromeProfileName || profile.profileDirectory)}</h3>
          <div class="profile-dir">Tên gốc Chrome: ${escHtml(profile.chromeProfileName || profile.profileDirectory)}</div>
          ${emailLine}
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
          ${buildGroupOptions(profile.group)}
        </select>
        <span class="group-badge group-${gc}">${escHtml(profile.group || 'Khác')}</span>
      </div>
    </div>
    <div class="card-actions">
      <button class="btn btn-primary btn-sm btn-open" data-profile="${escAttr(profile.profileDirectory)}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
        Mở profile
      </button>
      <button class="btn btn-success btn-sm btn-create" data-profile="${escAttr(profile.profileDirectory)}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        Tạo shortcut
      </button>
      <button class="btn btn-danger btn-sm btn-delete" data-profile="${escAttr(profile.profileDirectory)}" ${!hasShortcut ? 'disabled' : ''}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        Xóa shortcut
      </button>
    </div>
  `;

  // Gắn avatar (async)
  const avatarWrap = card.querySelector('.profile-avatar-wrap');
  buildAvatarEl(profile).then(el => avatarWrap.replaceWith(el));

  // Save tên khi blur
  card.querySelector('.input-shortcut-name').addEventListener('blur', async (e) => {
    const name = e.target.value.trim();
    const dir = e.target.dataset.profile;
    const p = allProfiles.find(x => x.profileDirectory === dir);
    if (!p) return;
    p.shortcutName = name;
    await window.app.saveProfileConfig(dir, { shortcutName: name, group: p.group });
    refreshCardMeta(card, p);
  });

  // Save nhóm khi đổi
  card.querySelector('.select-group').addEventListener('change', async (e) => {
    const group = e.target.value;
    const dir = e.target.dataset.profile;
    const p = allProfiles.find(x => x.profileDirectory === dir);
    if (!p) return;
    p.group = group;
    await window.app.saveProfileConfig(dir, { shortcutName: p.shortcutName, group });
    refreshCardMeta(card, p);
  });

  // Mở profile
  card.querySelector('.btn-open').addEventListener('click', async (e) => {
    const res = await window.app.openProfile(e.currentTarget.dataset.profile);
    if (res.success) showToast('Đang mở Chrome profile...', 'info');
    else showToast(res.error, 'error');
  });

  // Tạo shortcut
  card.querySelector('.btn-create').addEventListener('click', async (e) => {
    const dir = e.currentTarget.dataset.profile;
    const p = allProfiles.find(x => x.profileDirectory === dir);
    if (!p) return;
    const name = p.shortcutName || p.chromeProfileName || p.profileDirectory;
    const res = await window.app.createShortcut(dir, name);
    if (res.success) {
      p.hasShortcut = true;
      showToast(`Đã tạo shortcut "${name}" ra Desktop!`, 'success');
      refreshCardStatus(card, p);
      updateStats(allProfiles);
    } else showToast(res.error, 'error');
  });

  // Xóa shortcut
  card.querySelector('.btn-delete').addEventListener('click', async (e) => {
    const dir = e.currentTarget.dataset.profile;
    const p = allProfiles.find(x => x.profileDirectory === dir);
    if (!p) return;
    const name = p.shortcutName || p.chromeProfileName || p.profileDirectory;
    const res = await window.app.deleteShortcut(name);
    if (res.success) {
      p.hasShortcut = false;
      showToast(`Đã xóa shortcut "${name}"`, 'warning');
      refreshCardStatus(card, p);
      updateStats(allProfiles);
    } else showToast(res.error || 'Không xóa được shortcut', 'error');
  });

  return card;
}

function refreshCardMeta(card, profile) {
  const gc = groupClass(profile.group || 'Khác');
  card.querySelector('.profile-name-info h3').textContent =
    profile.shortcutName || profile.chromeProfileName || profile.profileDirectory;
  const badge = card.querySelector('.group-badge');
  badge.className = `group-badge group-${gc}`;
  badge.textContent = profile.group || 'Khác';
  // Re-build avatar nếu group đổi (màu avatar thay đổi)
  buildAvatarEl(profile).then(el => {
    const old = card.querySelector('.profile-avatar');
    if (old) old.replaceWith(el);
  });
}

function refreshCardStatus(card, profile) {
  const hasShortcut = profile.hasShortcut;
  const status = card.querySelector('.card-status');
  status.className = `card-status ${hasShortcut ? 'has' : 'none'}`;
  status.innerHTML = `<span class="status-dot"></span>${hasShortcut ? 'Đã có shortcut' : 'Chưa có shortcut'}`;
  card.querySelector('.btn-delete').disabled = !hasShortcut;
}

// ── Render list ────────────────────────────────────────────
async function renderProfiles(profiles) {
  const grid = document.getElementById('profile-grid');
  grid.innerHTML = '';

  if (profiles.length === 0) {
    grid.innerHTML = '<div class="no-results"><h3>Không tìm thấy profile nào</h3><p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p></div>';
    return;
  }

  for (const p of profiles) {
    const card = await buildCard(p);
    grid.appendChild(card);
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
      (p.group || '').toLowerCase().includes(query) ||
      (p.email || '').toLowerCase().includes(query);
    return matchGroup && matchQuery;
  });
  renderProfiles(filtered);
}

// ── Scan ───────────────────────────────────────────────────
async function scanProfiles() {
  showState('loading');
  try {
    const result = await window.app.scanProfiles();
    allProfiles = result.profiles;
    updateStats(allProfiles);
    showState('grid');
    applyFilter();
    showToast(`Tìm thấy ${allProfiles.length} profile Chrome`, 'success');
  } catch (err) {
    showState('empty');
    const isNotFound = err.message && err.message.includes('NOT_FOUND_USER_DATA');
    document.getElementById('empty-title').textContent = 'Không tìm thấy thư mục Chrome';
    document.getElementById('empty-desc').innerHTML = isNotFound
      ? 'App không tự tìm được thư mục Chrome.<br>Bấm <strong>"Chọn thư mục Chrome thủ công"</strong> để chỉ đường.'
      : (err.message || 'Có lỗi xảy ra khi quét profile.');
    showToast('Không tìm thấy thư mục Chrome.', 'error');
  }
}

// ── Create all shortcuts ────────────────────────────────────
async function createAllShortcuts() {
  if (!allProfiles.length) { showToast('Chưa có profile nào. Vui lòng quét lại.', 'warning'); return; }
  let ok = 0, fail = 0;
  const btn = document.getElementById('btn-create-all');
  btn.disabled = true; btn.textContent = 'Đang tạo...';
  for (const p of allProfiles) {
    const name = p.shortcutName || p.chromeProfileName || p.profileDirectory;
    const res = await window.app.createShortcut(p.profileDirectory, name);
    if (res.success) { p.hasShortcut = true; ok++; } else fail++;
  }
  btn.disabled = false;
  btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Tạo tất cả shortcut`;
  updateStats(allProfiles);
  applyFilter();
  if (fail === 0) showToast(`Đã tạo ${ok} shortcut ra Desktop!`, 'success');
  else showToast(`Tạo thành công ${ok}, lỗi ${fail} shortcut.`, 'warning');
}

// ── Quản lý nhóm ──────────────────────────────────────────
let tempGroups = [];

function openGroupModal() {
  tempGroups = [...allGroups];
  renderGroupList();
  document.getElementById('modal-groups').classList.remove('hidden');
}

function closeGroupModal() {
  document.getElementById('modal-groups').classList.add('hidden');
  document.getElementById('new-group-input').value = '';
}

function renderGroupList() {
  const ul = document.getElementById('group-list');
  ul.innerHTML = '';
  for (let i = 0; i < tempGroups.length; i++) {
    const g = tempGroups[i];
    const isDefault = DEFAULT_GROUPS.includes(g);
    const li = document.createElement('li');
    li.className = 'group-item';
    li.innerHTML = `
      <span class="group-item-name">${escHtml(g)}</span>
      <input type="text" class="group-item-input" value="${escAttr(g)}" maxlength="30" />
      ${isDefault ? '<span class="group-item-default">Mặc định</span>' : ''}
      <button class="btn btn-outline btn-sm btn-edit-group" data-idx="${i}">${isDefault ? 'Sửa' : 'Sửa'}</button>
      ${!isDefault ? `<button class="btn btn-danger btn-sm btn-del-group" data-idx="${i}">Xóa</button>` : ''}
    `;
    li.querySelector('.btn-edit-group').addEventListener('click', () => {
      li.classList.toggle('editing');
      const input = li.querySelector('.group-item-input');
      if (li.classList.contains('editing')) { input.focus(); input.select(); }
      else {
        const newName = input.value.trim();
        if (newName) tempGroups[i] = newName;
        renderGroupList();
      }
    });
    const delBtn = li.querySelector('.btn-del-group');
    if (delBtn) delBtn.addEventListener('click', () => { tempGroups.splice(i, 1); renderGroupList(); });
    ul.appendChild(li);
  }
}

async function saveGroups() {
  allGroups = tempGroups.filter(g => g.trim());
  await window.app.saveGroups(allGroups);
  refreshGroupFilter();
  // Cập nhật dropdown trong tất cả card đang hiển thị
  document.querySelectorAll('.select-group').forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = buildGroupOptions(cur);
  });
  closeGroupModal();
  showToast('Đã lưu danh sách nhóm', 'success');
}

// ── Tạo Chrome profile mới ─────────────────────────────────
function openNewProfileModal() {
  document.getElementById('modal-new-profile').classList.remove('hidden');
}
function closeNewProfileModal() {
  document.getElementById('modal-new-profile').classList.add('hidden');
}

async function confirmCreateProfile() {
  closeNewProfileModal();
  const res = await window.app.createChromeProfile();
  if (res.success) {
    showToast(`Chrome đã mở để tạo tài khoản mới (${res.profileDirectory}). Sau khi xong hãy bấm "Quét lại".`, 'success');
  } else {
    showToast(res.error, 'error');
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
function escAttr(str) { return String(str || '').replace(/"/g, '&quot;'); }

// ── Init ───────────────────────────────────────────────────
document.getElementById('btn-scan').addEventListener('click', scanProfiles);
document.getElementById('btn-create-all').addEventListener('click', createAllShortcuts);
document.getElementById('btn-open-desktop').addEventListener('click', () => window.app.openDesktop());
document.getElementById('search-input').addEventListener('input', applyFilter);
document.getElementById('group-filter').addEventListener('change', applyFilter);

document.getElementById('btn-pick-folder').addEventListener('click', async () => {
  const chosen = await window.app.pickUserDataFolder();
  if (chosen) { showToast(`Đã chọn: ${chosen}`, 'info'); scanProfiles(); }
});

// Nhóm
document.getElementById('btn-manage-groups').addEventListener('click', openGroupModal);
document.getElementById('modal-groups-close').addEventListener('click', closeGroupModal);
document.getElementById('btn-cancel-groups').addEventListener('click', closeGroupModal);
document.getElementById('btn-save-groups').addEventListener('click', saveGroups);
document.getElementById('btn-add-group').addEventListener('click', () => {
  const input = document.getElementById('new-group-input');
  const name = input.value.trim();
  if (!name) return;
  if (tempGroups.includes(name)) { showToast('Nhóm này đã tồn tại', 'warning'); return; }
  tempGroups.push(name);
  input.value = '';
  renderGroupList();
});
document.getElementById('new-group-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-add-group').click();
});

// Tạo Chrome profile mới
document.getElementById('btn-new-profile').addEventListener('click', openNewProfileModal);
document.getElementById('modal-new-profile-close').addEventListener('click', closeNewProfileModal);
document.getElementById('btn-cancel-new-profile').addEventListener('click', closeNewProfileModal);
document.getElementById('btn-confirm-new-profile').addEventListener('click', confirmCreateProfile);

// Đóng modal khi click nền
document.getElementById('modal-groups').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeGroupModal();
});
document.getElementById('modal-new-profile').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeNewProfileModal();
});

// Load nhóm rồi mới scan
window.addEventListener('DOMContentLoaded', async () => {
  allGroups = await window.app.getGroups();
  refreshGroupFilter();
  scanProfiles();
});
