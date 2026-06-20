let allProfiles = [];
let allGroups = [];

const DEFAULT_GROUPS = ['Seeding', 'Ads', 'BM', 'Khách hàng', 'Cá nhân', 'Khác'];

// ── Group helpers ─────────────────────────────────────────
const BUILTIN_CLASS = {
  'Seeding':'seeding','Ads':'ads','BM':'bm',
  'Khách hàng':'khachhang','Cá nhân':'canhan','Khác':'khac'
};

function groupClass(g) { return BUILTIN_CLASS[g] || 'custom'; }
function avatarClass(groups) {
  const first = (groups || [])[0];
  return first ? `av-${groupClass(first)}` : 'av-default';
}
function avatarLetter(name) { return (name || '?').charAt(0).toUpperCase(); }

function refreshGroupFilter() {
  const sel = document.getElementById('group-filter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Tất cả nhóm</option>' +
    allGroups.map(g => `<option value="${eh(g)}" ${g===cur?'selected':''}>${eh(g)}</option>`).join('');
}

// ── Toast ─────────────────────────────────────────────────
let _toastT;
function showToast(msg, type='info') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast ${type}`;
  clearTimeout(_toastT);
  _toastT = setTimeout(() => t.className='toast hidden', 3800);
}

// ── Stats ─────────────────────────────────────────────────
function updateStats(profiles) {
  document.getElementById('stat-total').textContent = profiles.length;
  document.getElementById('stat-has-shortcut').textContent = profiles.filter(p=>p.hasShortcut).length;
  document.getElementById('stat-no-shortcut').textContent = profiles.filter(p=>!p.hasShortcut).length;
  document.getElementById('stat-unnamed').textContent = profiles.filter(p=>{
    const n=p.shortcutName||''; return !n||n===p.profileDirectory||n===p.chromeProfileName;
  }).length;
}

// ── Format bytes ──────────────────────────────────────────
function fmtBytes(b) {
  if (!b||b<1024) return (b||0)+' B';
  if (b<1048576) return (b/1024).toFixed(1)+' KB';
  if (b<1073741824) return (b/1048576).toFixed(1)+' MB';
  return (b/1073741824).toFixed(2)+' GB';
}

// ── Avatar ────────────────────────────────────────────────
async function buildAvatarEl(profile) {
  const ac = avatarClass(profile.groups);
  const el = document.createElement('div');
  el.className = `profile-avatar ${ac}`;

  if (profile.avatarPath) {
    const url = await window.app.getAvatarDataUrl(profile.avatarPath);
    if (url) { el.innerHTML = `<img src="${url}" alt="avatar"/>`; return el; }
  }

  el.textContent = avatarLetter(profile.shortcutName || profile.chromeProfileName);
  // Badge số thứ tự
  const badge = document.createElement('span');
  badge.className = 'profile-index-badge';
  badge.textContent = profile.profileDirectory === 'Default' ? '★' : `#${profile.displayIndex}`;
  el.appendChild(badge);
  return el;
}

// ── Group tags UI ─────────────────────────────────────────
function buildGroupTags(profile, card) {
  const row = card.querySelector('.groups-row');
  row.innerHTML = '';

  (profile.groups || []).forEach(g => {
    const tag = document.createElement('span');
    tag.className = `group-tag gc-${groupClass(g)}`;
    tag.innerHTML = `${eh(g)}<span class="remove-tag" data-group="${ea(g)}" title="Xóa khỏi nhóm này">&times;</span>`;
    tag.querySelector('.remove-tag').addEventListener('click', async () => {
      profile.groups = profile.groups.filter(x => x !== g);
      await window.app.saveProfileConfig(profile.profileDirectory, { groups: profile.groups });
      buildGroupTags(profile, card);
      refreshAvatarInCard(card, profile);
    });
    row.appendChild(tag);
  });

  // Nút thêm nhóm
  const wrap = document.createElement('div');
  wrap.className = 'group-dropdown';

  const addBtn = document.createElement('button');
  addBtn.className = 'add-group-btn';
  addBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Thêm nhóm`;

  const menu = document.createElement('div');
  menu.className = 'group-dropdown-menu';

  allGroups.forEach(g => {
    const item = document.createElement('div');
    const selected = (profile.groups || []).includes(g);
    item.className = `group-dropdown-item${selected ? ' selected' : ''}`;
    item.innerHTML = `<span class="check">${selected ? '✓' : ''}</span>${eh(g)}`;
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (selected) {
        profile.groups = (profile.groups || []).filter(x => x !== g);
      } else {
        profile.groups = [...(profile.groups || []), g];
      }
      await window.app.saveProfileConfig(profile.profileDirectory, { groups: profile.groups });
      menu.classList.remove('open');
      buildGroupTags(profile, card);
      refreshAvatarInCard(card, profile);
    });
    menu.appendChild(item);
  });

  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
  });

  wrap.appendChild(addBtn);
  wrap.appendChild(menu);
  row.appendChild(wrap);
}

function refreshAvatarInCard(card, profile) {
  buildAvatarEl(profile).then(el => {
    const old = card.querySelector('.profile-avatar');
    if (old) old.replaceWith(el);
  });
}

// ── Build card ────────────────────────────────────────────
async function buildCard(profile) {
  const card = document.createElement('div');
  card.className = 'profile-card';
  card.dataset.profileDir = profile.profileDirectory;

  const emailLine = profile.email ? `<div class="email">${eh(profile.email)}</div>` : '';
  const hasNote = !!(profile.notes && profile.notes.trim());

  card.innerHTML = `
    <div class="card-header">
      <div class="card-profile-id">
        <div class="avatar-wrap"></div>
        <div class="profile-name-info">
          <h3>${eh(profile.shortcutName || profile.chromeProfileName || profile.profileDirectory)}</h3>
          <div class="profile-meta">
            <span class="folder-id">${eh(profile.profileDirectory)}</span>
            ${profile.chromeProfileName && profile.chromeProfileName !== profile.profileDirectory
              ? `<span>${eh(profile.chromeProfileName)}</span>` : ''}
            ${emailLine}
          </div>
        </div>
      </div>
      <div class="card-status ${profile.hasShortcut ? 'has' : 'none'}">
        <span class="status-dot"></span>${profile.hasShortcut ? 'Có shortcut' : 'Chưa có'}
      </div>
    </div>

    <!-- Groups -->
    <div class="groups-row"></div>

    <!-- Form -->
    <div class="card-form">
      <div class="form-row">
        <label class="form-label">Tên shortcut</label>
        <input type="text" class="form-input input-name"
          value="${ea(profile.shortcutName||'')}" placeholder="Nhập tên dễ nhớ..."
          data-dir="${ea(profile.profileDirectory)}" />
      </div>
    </div>

    <!-- Cache info -->
    <div class="cache-info">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></ellipse></svg>
      Cache: <span class="cache-size loading" data-profile-path="${ea(profile.profilePath)}">đang tính...</span>
      <button class="btn btn-ghost btn-xs btn-clear-cache" data-profile-path="${ea(profile.profilePath)}" title="Xóa cache profile này">Xóa cache</button>
    </div>

    <!-- Ghi chú -->
    <div class="notes-section">
      <div class="notes-toggle ${hasNote ? 'open' : ''}" data-dir="${ea(profile.profileDirectory)}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
        Ghi chú
        ${hasNote ? '<span class="notes-dot"></span>' : ''}
      </div>
      <div class="notes-area ${hasNote ? 'open' : ''}">
        <textarea class="notes-textarea" placeholder="Ghi chú thông tin quan trọng về tài khoản này..." data-dir="${ea(profile.profileDirectory)}">${eh(profile.notes||'')}</textarea>
      </div>
    </div>

    <!-- Actions -->
    <div class="card-actions">
      <button class="btn btn-primary btn-sm btn-open" data-dir="${ea(profile.profileDirectory)}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
        Mở profile
      </button>
      <button class="btn btn-success btn-sm btn-create" data-dir="${ea(profile.profileDirectory)}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        Tạo shortcut
      </button>
      <button class="btn btn-danger btn-sm btn-delete" data-dir="${ea(profile.profileDirectory)}" ${!profile.hasShortcut?'disabled':''}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        Xóa shortcut
      </button>
    </div>
  `;

  // Avatar
  const avatarWrap = card.querySelector('.avatar-wrap');
  buildAvatarEl(profile).then(el => avatarWrap.replaceWith(el));

  // Groups tags
  buildGroupTags(profile, card);

  // Load cache size async
  const cacheSpan = card.querySelector('.cache-size');
  window.app.getCacheSize(profile.profilePath).then(size => {
    cacheSpan.textContent = fmtBytes(size);
    cacheSpan.classList.remove('loading');
    if (size > 100 * 1024 * 1024) cacheSpan.style.color = 'var(--danger)';
  });

  // Xóa cache 1 profile
  card.querySelector('.btn-clear-cache').addEventListener('click', async (e) => {
    const pp = e.currentTarget.dataset.profilePath;
    e.currentTarget.disabled = true;
    const res = await window.app.clearCache(pp);
    if (res.success) {
      cacheSpan.textContent = '0 B';
      cacheSpan.style.color = '';
      showToast(`Đã xóa ${res.freedText} cache`, 'success');
    } else showToast(res.error, 'error');
    e.currentTarget.disabled = false;
  });

  // Ghi chú toggle
  card.querySelector('.notes-toggle').addEventListener('click', (e) => {
    const toggle = e.currentTarget;
    const area = card.querySelector('.notes-area');
    toggle.classList.toggle('open');
    area.classList.toggle('open');
  });

  // Ghi chú save on blur
  card.querySelector('.notes-textarea').addEventListener('blur', async (e) => {
    const notes = e.target.value;
    const dir = e.target.dataset.dir;
    const p = allProfiles.find(x => x.profileDirectory === dir);
    if (!p) return;
    p.notes = notes;
    await window.app.saveProfileConfig(dir, { notes });
    // Cập nhật dot indicator
    const toggle = card.querySelector('.notes-toggle');
    const existingDot = toggle.querySelector('.notes-dot');
    if (notes.trim() && !existingDot) {
      const dot = document.createElement('span');
      dot.className = 'notes-dot';
      toggle.appendChild(dot);
    } else if (!notes.trim() && existingDot) {
      existingDot.remove();
    }
  });

  // Đổi tên shortcut
  card.querySelector('.input-name').addEventListener('blur', async (e) => {
    const name = e.target.value.trim();
    const dir = e.target.dataset.dir;
    const p = allProfiles.find(x => x.profileDirectory === dir);
    if (!p) return;
    p.shortcutName = name;
    await window.app.saveProfileConfig(dir, { shortcutName: name });
    card.querySelector('.profile-name-info h3').textContent = name || p.chromeProfileName || p.profileDirectory;
    refreshAvatarInCard(card, p);
  });

  // Mở profile
  card.querySelector('.btn-open').addEventListener('click', async (e) => {
    const res = await window.app.openProfile(e.currentTarget.dataset.dir);
    if (res.success) showToast('Đang mở Chrome profile...', 'info');
    else showToast(res.error, 'error');
  });

  // Tạo shortcut
  card.querySelector('.btn-create').addEventListener('click', async (e) => {
    const dir = e.currentTarget.dataset.dir;
    const p = allProfiles.find(x => x.profileDirectory === dir);
    if (!p) return;
    const name = p.shortcutName || p.chromeProfileName || p.profileDirectory;
    const res = await window.app.createShortcut(dir, name);
    if (res.success) {
      p.hasShortcut = true;
      showToast(`Đã tạo shortcut "${name}"!`, 'success');
      refreshCardStatus(card, p);
      updateStats(allProfiles);
    } else showToast(res.error, 'error');
  });

  // Xóa shortcut
  card.querySelector('.btn-delete').addEventListener('click', async (e) => {
    const dir = e.currentTarget.dataset.dir;
    const p = allProfiles.find(x => x.profileDirectory === dir);
    if (!p) return;
    const name = p.shortcutName || p.chromeProfileName || p.profileDirectory;
    const res = await window.app.deleteShortcut(name);
    if (res.success) {
      p.hasShortcut = false;
      showToast(`Đã xóa shortcut "${name}"`, 'warning');
      refreshCardStatus(card, p);
      updateStats(allProfiles);
    } else showToast(res.error || 'Không xóa được', 'error');
  });

  return card;
}

function refreshCardStatus(card, profile) {
  const s = card.querySelector('.card-status');
  s.className = `card-status ${profile.hasShortcut ? 'has' : 'none'}`;
  s.innerHTML = `<span class="status-dot"></span>${profile.hasShortcut ? 'Có shortcut' : 'Chưa có'}`;
  card.querySelector('.btn-delete').disabled = !profile.hasShortcut;
}

// ── Render list ───────────────────────────────────────────
async function renderProfiles(profiles) {
  const grid = document.getElementById('profile-grid');
  grid.innerHTML = '';
  if (!profiles.length) {
    grid.innerHTML = '<div class="no-results"><h3>Không tìm thấy profile nào</h3><p>Thử thay đổi bộ lọc hoặc từ khóa</p></div>';
    return;
  }
  for (const p of profiles) grid.appendChild(await buildCard(p));
}

// ── Filter ────────────────────────────────────────────────
function applyFilter() {
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  const g = document.getElementById('group-filter').value;
  const filtered = allProfiles.filter(p => {
    const matchGroup = !g || (p.groups || []).includes(g);
    const matchQ = !q ||
      (p.profileDirectory||'').toLowerCase().includes(q) ||
      (p.shortcutName||'').toLowerCase().includes(q) ||
      (p.chromeProfileName||'').toLowerCase().includes(q) ||
      (p.groups||[]).some(x=>x.toLowerCase().includes(q)) ||
      (p.email||'').toLowerCase().includes(q) ||
      (p.notes||'').toLowerCase().includes(q);
    return matchGroup && matchQ;
  });
  renderProfiles(filtered);
}

// ── Scan ──────────────────────────────────────────────────
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
    const isNF = err.message && err.message.includes('NOT_FOUND_USER_DATA');
    document.getElementById('empty-title').textContent = isNF ? 'Không tìm thấy thư mục Chrome' : 'Có lỗi xảy ra';
    document.getElementById('empty-desc').innerHTML = isNF
      ? 'Bấm <strong>"Chọn thư mục thủ công"</strong> để chỉ đường cho app.'
      : eh(err.message || 'Không rõ lỗi');
    showToast('Không tìm thấy Chrome.', 'error');
  }
}

// ── Create all shortcuts ───────────────────────────────────
async function createAllShortcuts() {
  if (!allProfiles.length) { showToast('Chưa có profile nào.', 'warning'); return; }
  let ok=0, fail=0;
  const btn = document.getElementById('btn-create-all');
  btn.disabled=true; btn.textContent='Đang tạo...';
  for (const p of allProfiles) {
    const name = p.shortcutName || p.chromeProfileName || p.profileDirectory;
    const res = await window.app.createShortcut(p.profileDirectory, name);
    if (res.success) { p.hasShortcut=true; ok++; } else fail++;
  }
  btn.disabled=false;
  btn.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Tạo tất cả shortcut`;
  updateStats(allProfiles); applyFilter();
  if (!fail) showToast(`Đã tạo ${ok} shortcut!`, 'success');
  else showToast(`OK: ${ok}, lỗi: ${fail}`, 'warning');
}

// ── Storage modal ─────────────────────────────────────────
async function openStorageModal() {
  document.getElementById('modal-storage').classList.remove('hidden');
  const summary = document.getElementById('storage-summary');
  const list = document.getElementById('storage-list');
  summary.innerHTML = '<div class="spinner-sm"></div> Đang tính dung lượng...';
  list.innerHTML = '';

  const sizes = await window.app.getAllCacheSizes();
  let total = 0;

  // Sort by size desc
  const entries = allProfiles.map(p => ({
    p, size: sizes[p.profileDirectory] || 0
  })).sort((a,b) => b.size - a.size);

  for (const { p, size } of entries) {
    total += size;
    const li = document.createElement('li');
    li.className = 'storage-item';
    li.dataset.profilePath = p.profilePath;
    li.innerHTML = `
      <div class="storage-item-name">
        <strong>${eh(p.shortcutName || p.chromeProfileName || p.profileDirectory)}</strong>
        <span style="color:var(--muted);font-size:11px;margin-left:6px">${eh(p.profileDirectory)}</span>
      </div>
      <span class="storage-item-size ${size===0?'':''}">  ${fmtBytes(size)}</span>
      <button class="btn btn-outline btn-xs btn-clear-one" data-path="${ea(p.profilePath)}">Xóa</button>
    `;
    li.querySelector('.btn-clear-one').addEventListener('click', async (e) => {
      const path = e.currentTarget.dataset.path;
      e.currentTarget.disabled = true;
      const res = await window.app.clearCache(path);
      if (res.success) {
        li.querySelector('.storage-item-size').textContent = '0 B';
        // Update total
        showToast(`Đã xóa ${res.freedText}`, 'success');
        // Re-open to refresh
        openStorageModal();
      } else showToast(res.error, 'error');
    });
    list.appendChild(li);
  }

  summary.innerHTML = `
    <span>Tổng dung lượng cache:</span>
    <span class="total-size">${fmtBytes(total)}</span>
  `;
}

function closeStorageModal() {
  document.getElementById('modal-storage').classList.add('hidden');
}

// ── Group modal ───────────────────────────────────────────
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
  tempGroups.forEach((g, i) => {
    const isDefault = DEFAULT_GROUPS.includes(g);
    const li = document.createElement('li');
    li.className = 'group-item';
    li.innerHTML = `
      <span class="group-item-name">${eh(g)}</span>
      <input type="text" class="group-item-input" value="${ea(g)}" maxlength="30"/>
      ${isDefault ? '<span class="group-item-default">Mặc định</span>' : ''}
      <button class="btn btn-outline btn-xs btn-edit-grp" data-i="${i}">Sửa</button>
      ${!isDefault ? `<button class="btn btn-danger btn-xs btn-del-grp" data-i="${i}">Xóa</button>` : ''}
    `;
    li.querySelector('.btn-edit-grp').addEventListener('click', () => {
      li.classList.toggle('editing');
      if (!li.classList.contains('editing')) {
        const v = li.querySelector('.group-item-input').value.trim();
        if (v) tempGroups[i] = v;
        renderGroupList();
      } else li.querySelector('.group-item-input').focus();
    });
    li.querySelector('.btn-del-grp')?.addEventListener('click', () => {
      tempGroups.splice(i,1); renderGroupList();
    });
    ul.appendChild(li);
  });
}
async function saveGroups() {
  allGroups = tempGroups.filter(g=>g.trim());
  await window.app.saveGroups(allGroups);
  refreshGroupFilter();
  closeGroupModal();
  showToast('Đã lưu danh sách nhóm', 'success');
}

// ── New profile modal ─────────────────────────────────────
function openNewProfileModal() { document.getElementById('modal-new-profile').classList.remove('hidden'); }
function closeNewProfileModal() { document.getElementById('modal-new-profile').classList.add('hidden'); }
async function confirmCreateProfile() {
  closeNewProfileModal();
  const res = await window.app.createChromeProfile();
  if (res.success) showToast(`Chrome mở để tạo tài khoản mới (${res.profileDirectory}). Bấm "Quét lại" sau khi xong.`, 'success');
  else showToast(res.error, 'error');
}

// ── State ─────────────────────────────────────────────────
function showState(s) {
  document.getElementById('empty-state').style.display = s==='empty'?'':'none';
  document.getElementById('profile-grid').style.display = s==='grid'?'':'none';
  document.getElementById('loading').style.display = s==='loading'?'':'none';
}

// ── Helpers ───────────────────────────────────────────────
function eh(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function ea(s) { return String(s||'').replace(/"/g,'&quot;'); }

// ── Close dropdowns on outside click ─────────────────────
document.addEventListener('click', () => {
  document.querySelectorAll('.group-dropdown-menu.open').forEach(m => m.classList.remove('open'));
});

// ── Init ─────────────────────────────────────────────────
document.getElementById('btn-scan').addEventListener('click', scanProfiles);
document.getElementById('btn-create-all').addEventListener('click', createAllShortcuts);
document.getElementById('btn-open-desktop').addEventListener('click', () => window.app.openDesktop());
document.getElementById('search-input').addEventListener('input', applyFilter);
document.getElementById('group-filter').addEventListener('change', applyFilter);

document.getElementById('btn-pick-folder').addEventListener('click', async () => {
  const chosen = await window.app.pickUserDataFolder();
  if (chosen) { showToast(`Đã chọn: ${chosen}`, 'info'); scanProfiles(); }
});

document.getElementById('btn-manage-groups').addEventListener('click', openGroupModal);
document.getElementById('modal-groups-close').addEventListener('click', closeGroupModal);
document.getElementById('btn-cancel-groups').addEventListener('click', closeGroupModal);
document.getElementById('btn-save-groups').addEventListener('click', saveGroups);
document.getElementById('btn-add-group').addEventListener('click', () => {
  const inp = document.getElementById('new-group-input');
  const name = inp.value.trim();
  if (!name) return;
  if (tempGroups.includes(name)) { showToast('Nhóm này đã tồn tại', 'warning'); return; }
  tempGroups.push(name); inp.value=''; renderGroupList();
});
document.getElementById('new-group-input').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('btn-add-group').click(); });
document.getElementById('modal-groups').addEventListener('click', e => { if(e.target===e.currentTarget) closeGroupModal(); });

document.getElementById('btn-new-profile').addEventListener('click', openNewProfileModal);
document.getElementById('modal-new-profile-close').addEventListener('click', closeNewProfileModal);
document.getElementById('btn-cancel-new-profile').addEventListener('click', closeNewProfileModal);
document.getElementById('btn-confirm-new-profile').addEventListener('click', confirmCreateProfile);
document.getElementById('modal-new-profile').addEventListener('click', e => { if(e.target===e.currentTarget) closeNewProfileModal(); });

document.getElementById('btn-storage').addEventListener('click', openStorageModal);
document.getElementById('modal-storage-close').addEventListener('click', closeStorageModal);
document.getElementById('btn-close-storage').addEventListener('click', closeStorageModal);
document.getElementById('btn-clear-all-cache').addEventListener('click', async () => {
  const btn = document.getElementById('btn-clear-all-cache');
  btn.disabled=true; btn.textContent='Đang xóa...';
  const res = await window.app.clearAllCache();
  btn.disabled=false; btn.textContent='Xóa cache tất cả';
  if (res.success) {
    showToast(`Đã xóa tổng cộng ${res.freedText} cache`, 'success');
    closeStorageModal();
  }
});
document.getElementById('modal-storage').addEventListener('click', e => { if(e.target===e.currentTarget) closeStorageModal(); });

window.addEventListener('DOMContentLoaded', async () => {
  allGroups = await window.app.getGroups();
  refreshGroupFilter();
  scanProfiles();
});
