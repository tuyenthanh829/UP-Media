let allProfiles = [];
let allGroups = [];
let allGroupSubs = {}; // { "Seeding": ["T1","T2"] }
let activeGroupFilters = new Set();
let currentFiltered = [];

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

// ── Multi-group filter ────────────────────────────────────
function buildGroupFilterDropdown() {
  const dd = document.getElementById('group-filter-dropdown');
  dd.innerHTML = '';

  const allItem = document.createElement('div');
  allItem.className = `gf-item${activeGroupFilters.size === 0 ? ' selected' : ''}`;
  allItem.innerHTML = `<span class="gf-check">${activeGroupFilters.size === 0 ? '✓' : ''}</span> Tất cả nhóm`;
  allItem.addEventListener('click', e => {
    e.stopPropagation();
    activeGroupFilters.clear();
    buildGroupFilterDropdown(); updateGroupFilterLabel(); applyFilter();
  });
  dd.appendChild(allItem);
  dd.appendChild(Object.assign(document.createElement('div'), { className: 'gf-divider' }));

  allGroups.forEach(g => {
    const selected = activeGroupFilters.has(g);
    const item = document.createElement('div');
    item.className = `gf-item${selected ? ' selected' : ''}`;
    item.innerHTML = `<span class="gf-check">${selected ? '✓' : ''}</span> ${eh(g)}`;
    item.addEventListener('click', e => {
      e.stopPropagation();
      if (activeGroupFilters.has(g)) activeGroupFilters.delete(g); else activeGroupFilters.add(g);
      buildGroupFilterDropdown(); updateGroupFilterLabel(); applyFilter();
    });
    dd.appendChild(item);
  });
}

function updateGroupFilterLabel() {
  const label = document.getElementById('group-filter-label');
  const btn = document.getElementById('group-filter-btn');
  if (activeGroupFilters.size === 0) { label.textContent = 'Tất cả nhóm'; btn.classList.remove('active'); }
  else if (activeGroupFilters.size === 1) { label.textContent = [...activeGroupFilters][0]; btn.classList.add('active'); }
  else { label.textContent = `${activeGroupFilters.size} nhóm`; btn.classList.add('active'); }
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

function fmtBytes(b) {
  if (!b||b<1024) return (b||0)+' B';
  if (b<1048576) return (b/1024).toFixed(1)+' KB';
  if (b<1073741824) return (b/1048576).toFixed(1)+' MB';
  return (b/1073741824).toFixed(2)+' GB';
}

function fmtTime(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
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
    const sub = (profile.subGroups || {})[g];
    const tag = document.createElement('span');
    tag.className = `group-tag gc-${groupClass(g)}`;
    const subHtml = sub ? `<span class="group-tag-sub">· ${eh(sub)}</span>` : '';
    tag.innerHTML = `${eh(g)}${subHtml}<span class="remove-tag" data-group="${ea(g)}" title="Xóa khỏi nhóm này">&times;</span>`;
    tag.querySelector('.remove-tag').addEventListener('click', async () => {
      profile.groups = profile.groups.filter(x => x !== g);
      const subs = { ...profile.subGroups };
      delete subs[g];
      profile.subGroups = subs;
      await window.app.saveProfileConfig(profile.profileDirectory, { groups: profile.groups, subGroups: profile.subGroups });
      buildGroupTags(profile, card);
      refreshAvatarInCard(card, profile);
    });
    row.appendChild(tag);
  });

  // Add group button + dropdown
  const wrap = document.createElement('div');
  wrap.className = 'group-dropdown';
  const addBtn = document.createElement('button');
  addBtn.className = 'add-group-btn';
  addBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Nhóm`;

  const menu = document.createElement('div');
  menu.className = 'group-dropdown-menu';

  allGroups.forEach(g => {
    const selected = (profile.groups || []).includes(g);
    const subs = allGroupSubs[g] || [];
    const item = document.createElement('div');
    item.className = `group-dropdown-item${selected ? ' selected' : ''}`;
    item.innerHTML = `<span class="check">${selected ? '✓' : ''}</span>${eh(g)}${subs.length ? ' ▸' : ''}`;

    if (subs.length && !selected) {
      // Sub-menu on hover
      const subMenu = document.createElement('div');
      subMenu.className = 'group-dropdown-menu group-sub-menu';
      subs.forEach(sub => {
        const subItem = document.createElement('div');
        subItem.className = 'group-dropdown-item';
        subItem.textContent = sub;
        subItem.addEventListener('click', async e => {
          e.stopPropagation();
          if (!profile.groups.includes(g)) profile.groups = [...(profile.groups||[]), g];
          profile.subGroups = { ...(profile.subGroups||{}), [g]: sub };
          await window.app.saveProfileConfig(profile.profileDirectory, { groups: profile.groups, subGroups: profile.subGroups });
          menu.classList.remove('open');
          buildGroupTags(profile, card);
          refreshAvatarInCard(card, profile);
        });
        subMenu.appendChild(subItem);
      });
      item.style.position = 'relative';
      item.appendChild(subMenu);
      item.addEventListener('mouseenter', () => subMenu.classList.add('open'));
      item.addEventListener('mouseleave', () => subMenu.classList.remove('open'));
    } else {
      item.addEventListener('click', async e => {
        e.stopPropagation();
        if (selected) {
          profile.groups = (profile.groups||[]).filter(x => x !== g);
          const s = { ...(profile.subGroups||{}) }; delete s[g]; profile.subGroups = s;
        } else {
          profile.groups = [...(profile.groups||[]), g];
        }
        await window.app.saveProfileConfig(profile.profileDirectory, { groups: profile.groups, subGroups: profile.subGroups });
        menu.classList.remove('open');
        buildGroupTags(profile, card);
        refreshAvatarInCard(card, profile);
      });
    }
    menu.appendChild(item);
  });

  addBtn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
  wrap.appendChild(addBtn); wrap.appendChild(menu);
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

    <div class="groups-row"></div>

    <div class="card-form">
      <div class="form-row">
        <label class="form-label">Tên shortcut</label>
        <div style="flex:1;display:flex;flex-direction:column">
          <input type="text" class="form-input input-name"
            value="${ea(profile.shortcutName||'')}" placeholder="Nhập tên dễ nhớ..."
            data-dir="${ea(profile.profileDirectory)}" />
          <div class="name-warn" id="warn-${ea(profile.profileDirectory)}">⚠ Tên này đã được dùng bởi profile khác</div>
        </div>
      </div>
    </div>

    <div class="cache-info">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
      Cache: <span class="cache-size loading">đang tính...</span>
      <button class="btn btn-ghost btn-xs btn-clear-cache" data-profile-path="${ea(profile.profilePath)}" title="Xóa cache">Xóa cache</button>
    </div>

    <div class="notes-section">
      <div class="notes-toggle ${hasNote ? 'open' : ''}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
        Ghi chú${hasNote ? '<span class="notes-dot"></span>' : ''}
      </div>
      <div class="notes-area ${hasNote ? 'open' : ''}">
        <textarea class="notes-textarea" placeholder="Ghi chú quan trọng..." data-dir="${ea(profile.profileDirectory)}">${eh(profile.notes||'')}</textarea>
      </div>
    </div>

    <div class="card-actions">
      <button class="btn btn-primary btn-sm btn-open" data-dir="${ea(profile.profileDirectory)}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
        Mở
      </button>
      <button class="btn btn-outline btn-sm btn-history" data-dir="${ea(profile.profileDirectory)}" data-path="${ea(profile.profilePath)}" title="Xem lịch sử duyệt web">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Lịch sử
      </button>
      <button class="btn btn-success btn-icon btn-create" data-dir="${ea(profile.profileDirectory)}" title="Tạo shortcut Desktop">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M12 7v6M9 10h6"/></svg>
      </button>
      <button class="btn btn-danger btn-icon btn-delete" data-dir="${ea(profile.profileDirectory)}" title="Xóa shortcut Desktop" ${!profile.hasShortcut?'disabled':''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><line x1="9" y1="7" x2="15" y2="13"/><line x1="15" y1="7" x2="9" y2="13"/></svg>
      </button>
      <button class="btn btn-outline btn-icon btn-del-profile" data-dir="${ea(profile.profileDirectory)}" data-path="${ea(profile.profilePath)}" title="XÓA tài khoản Chrome này vĩnh viễn" style="color:var(--danger);margin-left:auto">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
      </button>
    </div>
  `;

  // Avatar
  buildAvatarEl(profile).then(el => card.querySelector('.avatar-wrap').replaceWith(el));
  buildGroupTags(profile, card);

  // Cache
  const cacheSpan = card.querySelector('.cache-size');
  window.app.getCacheSize(profile.profilePath).then(size => {
    cacheSpan.textContent = fmtBytes(size);
    cacheSpan.classList.remove('loading');
    if (size > 100 * 1024 * 1024) cacheSpan.style.color = 'var(--danger)';
  });

  card.querySelector('.btn-clear-cache').addEventListener('click', async e => {
    const pp = e.currentTarget.dataset.profilePath;
    e.currentTarget.disabled = true;
    const res = await window.app.clearCache(pp);
    if (res.success) { cacheSpan.textContent = '0 B'; cacheSpan.style.color = ''; showToast(`Đã xóa ${res.freedText} cache`, 'success'); }
    else showToast(res.error, 'error');
    e.currentTarget.disabled = false;
  });

  // Notes toggle
  card.querySelector('.notes-toggle').addEventListener('click', e => {
    e.currentTarget.classList.toggle('open');
    card.querySelector('.notes-area').classList.toggle('open');
  });

  card.querySelector('.notes-textarea').addEventListener('blur', async e => {
    const notes = e.target.value;
    const p = allProfiles.find(x => x.profileDirectory === e.target.dataset.dir);
    if (!p) return;
    p.notes = notes;
    await window.app.saveProfileConfig(e.target.dataset.dir, { notes });
    const toggle = card.querySelector('.notes-toggle');
    const dot = toggle.querySelector('.notes-dot');
    if (notes.trim() && !dot) { const d = document.createElement('span'); d.className='notes-dot'; toggle.appendChild(d); }
    else if (!notes.trim() && dot) dot.remove();
  });

  // Rename with duplicate check
  card.querySelector('.input-name').addEventListener('blur', async e => {
    const name = e.target.value.trim();
    const dir = e.target.dataset.dir;
    const p = allProfiles.find(x => x.profileDirectory === dir);
    if (!p) return;
    // Check duplicate
    const warn = document.getElementById(`warn-${dir}`);
    const dup = await window.app.checkDuplicateName(dir, name);
    if (dup.isDuplicate) { if (warn) warn.classList.add('show'); return; }
    if (warn) warn.classList.remove('show');
    p.shortcutName = name;
    await window.app.saveProfileConfig(dir, { shortcutName: name });
    card.querySelector('.profile-name-info h3').textContent = name || p.chromeProfileName || p.profileDirectory;
    refreshAvatarInCard(card, p);
  });
  card.querySelector('.input-name').addEventListener('input', () => {
    const warn = document.getElementById(`warn-${profile.profileDirectory}`);
    if (warn) warn.classList.remove('show');
  });

  // Open profile
  card.querySelector('.btn-open').addEventListener('click', async e => {
    const res = await window.app.openProfile(e.currentTarget.dataset.dir);
    if (res.success) showToast('Đang mở Chrome profile...', 'info');
    else showToast(res.error, 'error');
  });

  // History
  card.querySelector('.btn-history').addEventListener('click', async e => {
    const dir = e.currentTarget.dataset.dir;
    const pPath = e.currentTarget.dataset.path;
    const p = allProfiles.find(x => x.profileDirectory === dir);
    openHistoryModal(p, pPath);
  });

  // Create shortcut
  card.querySelector('.btn-create').addEventListener('click', async e => {
    const dir = e.currentTarget.dataset.dir;
    const p = allProfiles.find(x => x.profileDirectory === dir);
    if (!p) return;
    const name = p.shortcutName || p.chromeProfileName || p.profileDirectory;
    // Check duplicate name before creating
    const dup = await window.app.checkDuplicateName(dir, name);
    if (dup.isDuplicate) { showToast(`Tên "${name}" đã được dùng bởi profile khác!`, 'warning'); return; }
    const res = await window.app.createShortcut(dir, name);
    if (res.success) {
      p.hasShortcut = true;
      showToast(`Đã tạo shortcut "${name}"!`, 'success');
      refreshCardStatus(card, p); updateStats(allProfiles);
    } else showToast(res.error, 'error');
  });

  // Delete shortcut
  card.querySelector('.btn-delete').addEventListener('click', async e => {
    const dir = e.currentTarget.dataset.dir;
    const p = allProfiles.find(x => x.profileDirectory === dir);
    if (!p) return;
    const name = p.shortcutName || p.chromeProfileName || p.profileDirectory;
    const res = await window.app.deleteShortcut(name);
    if (res.success) {
      p.hasShortcut = false;
      showToast(`Đã xóa shortcut "${name}"`, 'warning');
      refreshCardStatus(card, p); updateStats(allProfiles);
    } else showToast(res.error || 'Không xóa được', 'error');
  });

  // Delete profile
  card.querySelector('.btn-del-profile').addEventListener('click', async e => {
    const dir = e.currentTarget.dataset.dir;
    const pPath = e.currentTarget.dataset.path;
    const p = allProfiles.find(x => x.profileDirectory === dir);
    if (!p) return;
    const displayName = p.shortcutName || p.chromeProfileName || dir;
    const res = await window.app.deleteProfile(pPath, dir, displayName);
    if (res.cancelled) return;
    if (res.success) {
      allProfiles = allProfiles.filter(x => x.profileDirectory !== dir);
      card.remove();
      updateStats(allProfiles);
      showToast(`Đã xóa tài khoản "${displayName}"`, 'warning');
    } else showToast(res.error, 'error');
  });

  return card;
}

function refreshCardStatus(card, profile) {
  const s = card.querySelector('.card-status');
  s.className = `card-status ${profile.hasShortcut ? 'has' : 'none'}`;
  s.innerHTML = `<span class="status-dot"></span>${profile.hasShortcut ? 'Có shortcut' : 'Chưa có'}`;
  card.querySelector('.btn-delete').disabled = !profile.hasShortcut;
}

// ── History modal ─────────────────────────────────────────
let _historyProfile = null;

async function openHistoryModal(profile, profilePath) {
  _historyProfile = profile;
  document.getElementById('history-profile-name').textContent =
    profile.shortcutName || profile.chromeProfileName || profile.profileDirectory;
  document.getElementById('modal-history').classList.remove('hidden');
  document.getElementById('history-loading').style.display = '';
  document.getElementById('history-list').innerHTML = '';

  const res = await window.app.getProfileHistory(profilePath);
  document.getElementById('history-loading').style.display = 'none';

  const list = document.getElementById('history-list');
  if (!res.ok) {
    list.innerHTML = `<li style="padding:16px;text-align:center;color:var(--muted)">${eh(res.error)}</li>`;
    return;
  }
  if (!res.items.length) {
    list.innerHTML = `<li style="padding:16px;text-align:center;color:var(--muted)">Chưa có lịch sử duyệt web</li>`;
    return;
  }

  res.items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.title = item.url;
    li.innerHTML = `
      <div class="history-item-title">${eh(item.title)}</div>
      <div class="history-item-url">${eh(item.url)}</div>
      <div class="history-item-time">${fmtTime(item.visitTime)}</div>
    `;
    li.addEventListener('click', async () => {
      closeHistoryModal();
      const r = await window.app.openProfileUrl(profile.profileDirectory, item.url);
      if (r.success) showToast('Đang mở Chrome với trang web...', 'info');
      else showToast(r.error, 'error');
    });
    list.appendChild(li);
  });
}

function closeHistoryModal() {
  document.getElementById('modal-history').classList.add('hidden');
}

// ── Render list ───────────────────────────────────────────
async function renderProfiles(profiles) {
  currentFiltered = profiles;
  const grid = document.getElementById('profile-grid');
  grid.innerHTML = '';

  const btnOpenAll = document.getElementById('btn-open-all');
  const isFiltered = activeGroupFilters.size > 0 || document.getElementById('search-input').value.trim();
  if (isFiltered && profiles.length > 1) {
    btnOpenAll.style.display = '';
    document.getElementById('open-all-count').textContent = profiles.length;
  } else {
    btnOpenAll.style.display = 'none';
  }

  if (!profiles.length) {
    grid.innerHTML = '<div class="no-results"><h3>Không tìm thấy profile nào</h3><p>Thử thay đổi bộ lọc hoặc từ khóa</p></div>';
    return;
  }
  for (const p of profiles) grid.appendChild(await buildCard(p));
}

// ── Filter ────────────────────────────────────────────────
function applyFilter() {
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  const filtered = allProfiles.filter(p => {
    const matchGroup = activeGroupFilters.size === 0 || (p.groups||[]).some(g => activeGroupFilters.has(g));
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

// ── Open all filtered ─────────────────────────────────────
async function openAllFiltered() {
  if (!currentFiltered.length) return;
  const btn = document.getElementById('btn-open-all');
  btn.disabled = true;
  const dirs = currentFiltered.map(p => p.profileDirectory);
  const res = await window.app.openProfilesBatch(dirs);
  btn.disabled = false;
  showToast(`Đã mở ${res.ok} profile${res.fail ? `, ${res.fail} lỗi` : ''}`, res.fail ? 'warning' : 'success');
}

// ── Create all shortcuts ───────────────────────────────────
async function createAllShortcuts() {
  if (!allProfiles.length) { showToast('Chưa có profile nào.', 'warning'); return; }
  let ok=0, fail=0, dup=0;
  const btn = document.getElementById('btn-create-all');
  btn.disabled=true; btn.textContent='Đang tạo...';
  for (const p of allProfiles) {
    const name = p.shortcutName || p.chromeProfileName || p.profileDirectory;
    const d = await window.app.checkDuplicateName(p.profileDirectory, name);
    if (d.isDuplicate) { dup++; continue; }
    const res = await window.app.createShortcut(p.profileDirectory, name);
    if (res.success) { p.hasShortcut=true; ok++; } else fail++;
  }
  btn.disabled=false;
  btn.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Tạo tất cả shortcut`;
  updateStats(allProfiles); applyFilter();
  let msg = `Đã tạo ${ok} shortcut`;
  if (dup) msg += `, bỏ qua ${dup} tên trùng`;
  if (fail) msg += `, lỗi ${fail}`;
  showToast(msg, fail || dup ? 'warning' : 'success');
}

// ── Remove bad extensions ──────────────────────────────────
async function removeBadExtensions() {
  const btn = document.getElementById('btn-remove-ext');
  btn.disabled=true; btn.textContent='Đang dọn...';
  const res = await window.app.removeBadExtensions();
  btn.disabled=false;
  btn.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Dọn tiện ích`;
  if (res.success) {
    if (res.totalRemoved === 0) showToast('Không tìm thấy tiện ích McAfee/IDM nào', 'info');
    else showToast(`Đã xóa ${res.totalRemoved} tiện ích (bỏ qua ${res.skipped} profile được bảo vệ). Khởi động lại Chrome để có hiệu lực.`, 'success');
  }
}

// ── Kill all Chrome ────────────────────────────────────────
async function killAllChrome() {
  const btn = document.getElementById('btn-kill-chrome');
  btn.disabled=true;
  const res = await window.app.killAllChrome();
  btn.disabled=false;
  if (res.success) showToast('Đã đóng tất cả Chrome', 'success');
  else showToast(res.error || 'Không có Chrome nào đang mở', 'info');
}

// ── Storage modal ─────────────────────────────────────────
async function openStorageModal() {
  document.getElementById('modal-storage').classList.remove('hidden');
  const summary = document.getElementById('storage-summary');
  const list = document.getElementById('storage-list');
  summary.innerHTML = '<div class="spinner-sm"></div> Đang tính...';
  list.innerHTML = '';

  const sizes = await window.app.getAllCacheSizes();
  let total = 0;
  const entries = allProfiles.map(p => ({ p, size: sizes[p.profileDirectory]||0 })).sort((a,b)=>b.size-a.size);

  for (const { p, size } of entries) {
    total += size;
    const li = document.createElement('li');
    li.className = 'storage-item';
    li.innerHTML = `
      <div class="storage-item-name"><strong>${eh(p.shortcutName||p.chromeProfileName||p.profileDirectory)}</strong>
        <span style="color:var(--muted);font-size:11px;margin-left:6px">${eh(p.profileDirectory)}</span></div>
      <span class="storage-item-size">${fmtBytes(size)}</span>
      <button class="btn btn-outline btn-xs btn-clear-one" data-path="${ea(p.profilePath)}">Xóa</button>
    `;
    li.querySelector('.btn-clear-one').addEventListener('click', async e => {
      e.currentTarget.disabled=true;
      const res = await window.app.clearCache(e.currentTarget.dataset.path);
      if (res.success) { showToast(`Đã xóa ${res.freedText}`, 'success'); openStorageModal(); }
      else showToast(res.error, 'error');
    });
    list.appendChild(li);
  }
  summary.innerHTML = `<span>Tổng cache:</span><span class="total-size">${fmtBytes(total)}</span>`;
}

function closeStorageModal() { document.getElementById('modal-storage').classList.add('hidden'); }

// ── Group modal with sub-groups ───────────────────────────
let tempGroups = [];
let tempGroupSubs = {};

function openGroupModal() {
  tempGroups = [...allGroups];
  tempGroupSubs = JSON.parse(JSON.stringify(allGroupSubs));
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
    const subs = tempGroupSubs[g] || [];
    const li = document.createElement('li');
    li.className = 'group-item';
    li.style.flexDirection = 'column';
    li.style.alignItems = 'stretch';
    li.innerHTML = `
      <div style="display:flex;align-items:center;gap:7px">
        <span class="group-item-name">${eh(g)}</span>
        <input type="text" class="group-item-input" value="${ea(g)}" maxlength="30"/>
        ${isDefault ? '<span class="group-item-default">Mặc định</span>' : ''}
        <button class="btn btn-outline btn-xs btn-edit-grp">Sửa</button>
        ${!isDefault ? `<button class="btn btn-danger btn-xs btn-del-grp">Xóa</button>` : ''}
        <button class="btn btn-outline btn-xs btn-expand-subs" title="Quản lý danh mục con">▸ ${subs.length?subs.length+' con':''}</button>
      </div>
      <div class="group-subs-panel" style="display:none;margin-top:7px;padding:7px;background:var(--bg);border-radius:7px;border:1px solid var(--border)">
        <div class="subs-list"></div>
        <div style="display:flex;gap:5px;margin-top:5px">
          <input type="text" class="form-input sub-input" placeholder="Tên danh mục con..." maxlength="30" style="flex:1"/>
          <button class="btn btn-primary btn-xs btn-add-sub">+ Thêm</button>
        </div>
      </div>
    `;

    const row = li.querySelector('div');
    const panel = li.querySelector('.group-subs-panel');
    const subsList = li.querySelector('.subs-list');
    const subInput = li.querySelector('.sub-input');
    const expandBtn = li.querySelector('.btn-expand-subs');

    // Render subs
    function renderSubs() {
      subsList.innerHTML = '';
      (tempGroupSubs[g]||[]).forEach((sub, si) => {
        const s = document.createElement('div');
        s.className = 'group-sub-row';
        s.innerHTML = `<span class="group-sub-name">• ${eh(sub)}</span><button class="btn btn-danger btn-xs" data-si="${si}">Xóa</button>`;
        s.querySelector('button').addEventListener('click', () => {
          tempGroupSubs[g].splice(si, 1);
          expandBtn.textContent = `▸ ${tempGroupSubs[g].length?tempGroupSubs[g].length+' con':''}`;
          renderSubs();
        });
        subsList.appendChild(s);
      });
    }
    renderSubs();

    expandBtn.addEventListener('click', () => {
      const showing = panel.style.display !== 'none';
      panel.style.display = showing ? 'none' : '';
      expandBtn.textContent = `${showing?'▸':'▾'} ${(tempGroupSubs[g]||[]).length?' '+(tempGroupSubs[g].length)+' con':''}`;
    });

    li.querySelector('.btn-add-sub').addEventListener('click', () => {
      const v = subInput.value.trim();
      if (!v) return;
      if (!(tempGroupSubs[g])) tempGroupSubs[g] = [];
      if (!tempGroupSubs[g].includes(v)) { tempGroupSubs[g].push(v); subInput.value=''; renderSubs(); }
    });
    subInput.addEventListener('keydown', e => { if(e.key==='Enter') li.querySelector('.btn-add-sub').click(); });

    li.querySelector('.btn-edit-grp').addEventListener('click', () => {
      li.classList.toggle('editing');
      if (!li.classList.contains('editing')) {
        const v = li.querySelector('.group-item-input').value.trim();
        if (v && v !== g) {
          // Rename key in groupSubs
          if (tempGroupSubs[g]) { tempGroupSubs[v] = tempGroupSubs[g]; delete tempGroupSubs[g]; }
          tempGroups[i] = v;
          renderGroupList();
        }
      } else li.querySelector('.group-item-input').focus();
    });

    li.querySelector('.btn-del-grp')?.addEventListener('click', () => {
      delete tempGroupSubs[g];
      tempGroups.splice(i,1);
      renderGroupList();
    });

    ul.appendChild(li);
  });
}

async function saveGroups() {
  allGroups = tempGroups.filter(g=>g.trim());
  allGroupSubs = tempGroupSubs;
  await window.app.saveGroups(allGroups);
  await window.app.saveGroupSubs(allGroupSubs);
  buildGroupFilterDropdown();
  closeGroupModal();
  showToast('Đã lưu danh sách nhóm', 'success');
}

// ── New profile modal (with groups + notes) ───────────────
let newProfileSelectedGroups = [];

function openNewProfileModal() {
  newProfileSelectedGroups = [];
  document.getElementById('new-profile-name').value = '';
  document.getElementById('new-profile-notes').value = '';
  buildNewProfileGroupsUI();
  document.getElementById('modal-new-profile').classList.remove('hidden');
  setTimeout(() => document.getElementById('new-profile-name').focus(), 100);
}

function buildNewProfileGroupsUI() {
  const row = document.getElementById('new-profile-groups-row');
  row.innerHTML = '';

  newProfileSelectedGroups.forEach(g => {
    const tag = document.createElement('span');
    tag.className = `group-tag gc-${groupClass(g)}`;
    tag.innerHTML = `${eh(g)}<span class="remove-tag">&times;</span>`;
    tag.querySelector('.remove-tag').addEventListener('click', () => {
      newProfileSelectedGroups = newProfileSelectedGroups.filter(x => x !== g);
      buildNewProfileGroupsUI();
    });
    row.appendChild(tag);
  });

  const wrap = document.createElement('div');
  wrap.className = 'group-dropdown';
  const btn = document.createElement('button');
  btn.className = 'add-group-btn';
  btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Chọn nhóm`;
  const menu = document.createElement('div');
  menu.className = 'group-dropdown-menu';
  allGroups.forEach(g => {
    const selected = newProfileSelectedGroups.includes(g);
    const item = document.createElement('div');
    item.className = `group-dropdown-item${selected?' selected':''}`;
    item.innerHTML = `<span class="check">${selected?'✓':''}</span>${eh(g)}`;
    item.addEventListener('click', e => {
      e.stopPropagation();
      if (selected) newProfileSelectedGroups = newProfileSelectedGroups.filter(x=>x!==g);
      else newProfileSelectedGroups.push(g);
      menu.classList.remove('open');
      buildNewProfileGroupsUI();
    });
    menu.appendChild(item);
  });
  btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
  wrap.appendChild(btn); wrap.appendChild(menu);
  row.appendChild(wrap);
}

function closeNewProfileModal() {
  document.getElementById('modal-new-profile').classList.add('hidden');
}

async function confirmCreateProfile() {
  const name = document.getElementById('new-profile-name').value.trim();
  const notes = document.getElementById('new-profile-notes').value.trim();
  closeNewProfileModal();
  const res = await window.app.createChromeProfile(name, newProfileSelectedGroups, notes);
  if (res.success) {
    let msg = `Chrome mở tài khoản mới (${res.profileDirectory})`;
    if (name) msg += ` — đã đặt tên "${name}"`;
    msg += '. Bấm "Quét lại" sau khi xong.';
    showToast(msg, 'success');
  } else showToast(res.error, 'error');
}

// ── State ─────────────────────────────────────────────────
function showState(s) {
  document.getElementById('empty-state').style.display = s==='empty'?'':'none';
  document.getElementById('profile-grid').style.display = s==='grid'?'':'none';
  document.getElementById('loading').style.display = s==='loading'?'':'none';
}

function eh(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function ea(s) { return String(s||'').replace(/"/g,'&quot;'); }

// ── Close dropdowns ───────────────────────────────────────
document.addEventListener('click', () => {
  document.querySelectorAll('.group-dropdown-menu.open').forEach(m => m.classList.remove('open'));
  document.getElementById('group-filter-dropdown').classList.add('hidden');
});

// ── Init ─────────────────────────────────────────────────
document.getElementById('btn-scan').addEventListener('click', scanProfiles);
document.getElementById('btn-create-all').addEventListener('click', createAllShortcuts);
document.getElementById('btn-open-all').addEventListener('click', openAllFiltered);
document.getElementById('btn-remove-ext').addEventListener('click', removeBadExtensions);
document.getElementById('btn-kill-chrome').addEventListener('click', killAllChrome);
document.getElementById('search-input').addEventListener('input', applyFilter);

document.getElementById('group-filter-btn').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('group-filter-dropdown').classList.toggle('hidden');
});

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
document.getElementById('new-profile-name').addEventListener('keydown', e => { if(e.key==='Enter') confirmCreateProfile(); });
document.getElementById('modal-new-profile').addEventListener('click', e => { if(e.target===e.currentTarget) closeNewProfileModal(); });

document.getElementById('btn-storage').addEventListener('click', openStorageModal);
document.getElementById('modal-storage-close').addEventListener('click', closeStorageModal);
document.getElementById('btn-close-storage').addEventListener('click', closeStorageModal);
document.getElementById('btn-clear-all-cache').addEventListener('click', async () => {
  const btn = document.getElementById('btn-clear-all-cache');
  btn.disabled=true; btn.textContent='Đang xóa...';
  const res = await window.app.clearAllCache();
  btn.disabled=false; btn.textContent='Xóa cache tất cả';
  if (res.success) { showToast(`Đã xóa ${res.freedText} cache`, 'success'); closeStorageModal(); }
});
document.getElementById('modal-storage').addEventListener('click', e => { if(e.target===e.currentTarget) closeStorageModal(); });

document.getElementById('modal-history-close').addEventListener('click', closeHistoryModal);
document.getElementById('btn-close-history').addEventListener('click', closeHistoryModal);
document.getElementById('modal-history').addEventListener('click', e => { if(e.target===e.currentTarget) closeHistoryModal(); });

window.addEventListener('DOMContentLoaded', async () => {
  [allGroups, allGroupSubs] = await Promise.all([window.app.getGroups(), window.app.getGroupSubs()]);
  buildGroupFilterDropdown();
  scanProfiles();
});
