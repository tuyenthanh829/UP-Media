// ── State ─────────────────────────────────────────────────
let allProfiles = [];
let allGroups = [];
let allGroupSubs = {};       // { "Seeding": ["T1","T2"] }
let socialSitesConfig = [];
let profileSocialCache = {}; // { dir: { siteId: {loggedIn,name} } }
let currentFiltered = [];
let activeSidebarFilter = null; // { type, group?, sub?, loginType? }

// For group rename tracking: [{ name, original }]
let tempGroups = [];
let tempGroupSubs = {};

const DEFAULT_GROUPS = ['Seeding', 'Ads', 'BM', 'Khách hàng', 'Cá nhân', 'Khác'];

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

function eh(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function ea(s) { return String(s||'').replace(/"/g,'&quot;'); }

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
  document.getElementById('stat-gmail').textContent = profiles.filter(p=>(p.googleAccounts||[]).length>0).length;
  // Social count updates via updateSocialStats() after background scan
}

function updateSocialStats() {
  const cnt = allProfiles.filter(p=>{
    const sc = profileSocialCache[p.profileDirectory];
    return sc && Object.values(sc).some(s=>s.loggedIn);
  }).length;
  document.getElementById('stat-social').textContent = cnt;
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

// ── Sidebar ───────────────────────────────────────────────
function countForGroup(g) { return allProfiles.filter(p=>(p.groups||[]).includes(g)).length; }
function countForSub(g, sub) {
  return allProfiles.filter(p=>(p.groups||[]).includes(g)&&(p.subGroups||{})[g]?.includes(sub)).length;
}
function countHasGmail() { return allProfiles.filter(p=>(p.googleAccounts||[]).length>0).length; }
function countHasSocial() {
  return allProfiles.filter(p=>{
    const sc = profileSocialCache[p.profileDirectory];
    return sc && Object.values(sc).some(s=>s.loggedIn);
  }).length;
}

function renderSidebar() {
  const sg = document.getElementById('sidebar-groups');
  sg.innerHTML = '';

  const allEl = document.createElement('div');
  allEl.className = `sidebar-item${!activeSidebarFilter ? ' active' : ''}`;
  allEl.innerHTML = `<span>Tất cả</span><span class="sidebar-count">${allProfiles.length}</span>`;
  allEl.addEventListener('click', () => { activeSidebarFilter = null; renderSidebar(); applyFilter(); });
  sg.appendChild(allEl);

  allGroups.forEach(g => {
    const cnt = countForGroup(g);
    const subs = allGroupSubs[g] || [];
    const isGroupActive = activeSidebarFilter?.type==='group' && activeSidebarFilter?.group===g;

    const gEl = document.createElement('div');
    gEl.className = `sidebar-item${isGroupActive ? ' active' : ''}`;
    gEl.innerHTML = `
      <span class="group-tag gc-${groupClass(g)}" style="padding:1px 6px;font-size:10px">${eh(g)}</span>
      <span style="flex:1"></span>
      <span class="sidebar-count">${cnt}</span>
    `;
    gEl.addEventListener('click', () => { activeSidebarFilter = { type:'group', group:g }; renderSidebar(); applyFilter(); });
    sg.appendChild(gEl);

    if (subs.length) {
      const subWrap = document.createElement('div');
      subWrap.className = 'sidebar-sub';
      subs.forEach(sub => {
        const subCnt = countForSub(g, sub);
        const isSubActive = activeSidebarFilter?.type==='sub' && activeSidebarFilter?.group===g && activeSidebarFilter?.sub===sub;
        const sEl = document.createElement('div');
        sEl.className = `sidebar-item${isSubActive ? ' active' : ''}`;
        sEl.innerHTML = `<span>· ${eh(sub)}</span><span class="sidebar-count">${subCnt}</span>`;
        sEl.addEventListener('click', e => {
          e.stopPropagation();
          activeSidebarFilter = { type:'sub', group:g, sub };
          renderSidebar(); applyFilter();
        });
        subWrap.appendChild(sEl);
      });
      sg.appendChild(subWrap);
    }
  });

  const sl = document.getElementById('sidebar-login-filters');
  sl.innerHTML = '';

  const gmailCnt = countHasGmail();
  const gmailActive = activeSidebarFilter?.type==='login' && activeSidebarFilter?.loginType==='gmail';
  const gmailEl = document.createElement('div');
  gmailEl.className = `sidebar-item${gmailActive ? ' active' : ''}`;
  gmailEl.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
    <span>Có Gmail</span><span class="sidebar-count">${gmailCnt}</span>
  `;
  gmailEl.addEventListener('click', () => { activeSidebarFilter={type:'login',loginType:'gmail'}; renderSidebar(); applyFilter(); });
  sl.appendChild(gmailEl);

  const socialCnt = countHasSocial();
  const socialActive = activeSidebarFilter?.type==='login' && activeSidebarFilter?.loginType==='social';
  const socialEl = document.createElement('div');
  socialEl.className = `sidebar-item${socialActive ? ' active' : ''}`;
  socialEl.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    <span>Có Social</span><span class="sidebar-count">${socialCnt}</span>
  `;
  socialEl.addEventListener('click', async () => {
    activeSidebarFilter = { type:'login', loginType:'social' };
    renderSidebar();
    const needed = allProfiles.filter(p => !profileSocialCache[p.profileDirectory]);
    if (needed.length) {
      const batch = needed.map(p => ({ dir: p.profileDirectory, profilePath: p.profilePath }));
      const results = await window.app.getSocialStatusBatch(batch, socialSitesConfig);
      Object.assign(profileSocialCache, results);
      updateSocialBadgesAll();
      renderSidebar();
    }
    applyFilter();
  });
  sl.appendChild(socialEl);

  // Per-site social sub-filters
  if (socialSitesConfig.length) {
    const siteSubWrap = document.createElement('div');
    siteSubWrap.className = 'sidebar-sub';
    socialSitesConfig.forEach(site => {
      const siteCnt = allProfiles.filter(p => {
        const sc = profileSocialCache[p.profileDirectory];
        return sc && sc[site.id]?.loggedIn;
      }).length;
      const siteActive = activeSidebarFilter?.type==='login' && activeSidebarFilter?.loginType==='social-site' && activeSidebarFilter?.siteId===site.id;
      const siteEl = document.createElement('div');
      siteEl.className = `sidebar-item${siteActive ? ' active' : ''}`;
      siteEl.innerHTML = `<span>${socialIcon(site.id)} ${eh(site.name)}</span><span class="sidebar-count">${siteCnt}</span>`;
      siteEl.addEventListener('click', e => {
        e.stopPropagation();
        activeSidebarFilter = { type:'login', loginType:'social-site', siteId: site.id };
        renderSidebar(); applyFilter();
      });
      siteSubWrap.appendChild(siteEl);
    });
    sl.appendChild(siteSubWrap);
  }
}

// ── Filter ────────────────────────────────────────────────
function applyFilter() {
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  const f = activeSidebarFilter;

  const filtered = allProfiles.filter(p => {
    let matchSidebar = true;
    if (f) {
      if (f.type === 'group') {
        matchSidebar = (p.groups||[]).includes(f.group);
      } else if (f.type === 'sub') {
        matchSidebar = (p.groups||[]).includes(f.group) && ((p.subGroups||{})[f.group]||[]).includes(f.sub);
      } else if (f.type === 'login' && f.loginType === 'gmail') {
        matchSidebar = (p.googleAccounts||[]).length > 0;
      } else if (f.type === 'login' && f.loginType === 'social') {
        const sc = profileSocialCache[p.profileDirectory];
        matchSidebar = !!(sc && Object.values(sc).some(s=>s.loggedIn));
      } else if (f.type === 'login' && f.loginType === 'social-site') {
        const sc = profileSocialCache[p.profileDirectory];
        matchSidebar = !!(sc && sc[f.siteId]?.loggedIn);
      }
    }

    const matchQ = !q || [
      p.profileDirectory, p.shortcutName, p.chromeProfileName,
      ...(p.groups||[]), p.email, p.notes,
      ...(p.googleAccounts||[]).map(a=>a.email),
      ...(p.googleAccounts||[]).map(a=>a.fullName),
    ].some(v => (v||'').toLowerCase().includes(q));

    return matchSidebar && matchQ;
  });

  renderProfiles(filtered);
}

// ── Background social scan after profile scan ─────────────
async function backgroundScanSocial() {
  if (!socialSitesConfig.length) return;
  const batch = allProfiles.map(p => ({ dir: p.profileDirectory, profilePath: p.profilePath }));
  try {
    const results = await window.app.getSocialStatusBatch(batch, socialSitesConfig);
    Object.assign(profileSocialCache, results);
    updateSocialBadgesAll();
    updateSocialStats();
    renderSidebar();
  } catch { /* ignore */ }
}

function updateSocialBadgesAll() {
  allProfiles.forEach(p => {
    const sc = profileSocialCache[p.profileDirectory];
    if (!sc) return;
    const cnt = Object.values(sc).filter(s=>s.loggedIn).length;
    const card = document.querySelector(`[data-profile-dir="${ea(p.profileDirectory)}"]`);
    if (!card) return;
    const span = card.querySelector('.social-badge-count');
    if (span) span.textContent = cnt;
    const btn = card.querySelector('.badge-social');
    if (btn) { btn.classList.toggle('empty', cnt === 0); }
  });
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

// ── Group tags on card ────────────────────────────────────
function renderTagsInto(container, profile, card) {
  container.innerHTML = '';
  (profile.groups || []).forEach(g => {
    const selectedSubs = (profile.subGroups || {})[g] || [];
    const tag = document.createElement('span');
    tag.className = `group-tag gc-${groupClass(g)}`;
    const subHtml = selectedSubs.length
      ? selectedSubs.map(s => `<span class="group-tag-sub">· ${eh(s)}</span>`).join('')
      : '';
    tag.innerHTML = `${eh(g)}${subHtml}<span class="remove-tag" data-group="${ea(g)}" title="Xóa khỏi nhóm">&times;</span>`;
    tag.querySelector('.remove-tag').addEventListener('click', async () => {
      profile.groups = profile.groups.filter(x => x !== g);
      const subs = { ...profile.subGroups }; delete subs[g]; profile.subGroups = subs;
      await window.app.saveProfileConfig(profile.profileDirectory, { groups: profile.groups, subGroups: profile.subGroups });
      buildGroupTags(profile, card);
      refreshAvatarInCard(card, profile);
    });
    container.appendChild(tag);
  });
}

function buildGroupTags(profile, card) {
  const row = card.querySelector('.groups-row');
  row.innerHTML = '';

  // Tags container (updated independently when subs change)
  const tagsWrap = document.createElement('div');
  tagsWrap.className = 'tags-wrap';
  tagsWrap.style.cssText = 'display:contents';
  renderTagsInto(tagsWrap, profile, card);
  row.appendChild(tagsWrap);

  // Dropdown — inline-expand approach (no hover submenu)
  const wrap = document.createElement('div');
  wrap.className = 'group-dropdown';
  const addBtn = document.createElement('button');
  addBtn.className = 'add-group-btn';
  addBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Nhóm`;

  const menu = document.createElement('div');
  menu.className = 'group-dropdown-menu';
  menu.style.cssText = 'max-height:300px;overflow-y:auto;min-width:170px';

  allGroups.forEach(g => {
    const selected = (profile.groups || []).includes(g);
    const subs = allGroupSubs[g] || [];

    const item = document.createElement('div');
    // Override to column layout for items with subs
    item.style.cssText = 'display:flex;flex-direction:column;align-items:stretch;cursor:default;position:relative';

    // Main row: check + label + expand arrow
    const mainRow = document.createElement('div');
    mainRow.className = `group-dropdown-item${selected ? ' selected' : ''}`;
    mainRow.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;margin:0';
    mainRow.innerHTML = `<span class="check">${selected ? '✓' : ''}</span><span style="flex:1">${eh(g)}</span>`;

    let subPanel = null;
    if (subs.length) {
      const expandArrow = document.createElement('span');
      expandArrow.style.cssText = 'font-size:10px;opacity:.45;padding:0 2px;transition:transform .15s';
      expandArrow.textContent = selected ? '▾' : '▸';

      subPanel = document.createElement('div');
      subPanel.style.cssText = `display:${selected ? 'block' : 'none'};padding:3px 8px 5px 28px;background:var(--bg);border-top:1px solid var(--border)`;

      subs.forEach(sub => {
        const lbl = document.createElement('label');
        lbl.style.cssText = 'display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;font-size:12px;user-select:none;font-weight:400;color:var(--text)';
        // Prevent label click from bubbling and closing dropdown
        lbl.addEventListener('mousedown', e => e.stopPropagation());
        lbl.addEventListener('click', e => e.stopPropagation());

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = ((profile.subGroups || {})[g] || []).includes(sub);
        cb.style.cssText = 'cursor:pointer;accent-color:var(--primary)';
        cb.addEventListener('change', async () => {
          if (!profile.groups.includes(g)) {
            profile.groups = [...(profile.groups || []), g];
            mainRow.classList.add('selected');
            mainRow.querySelector('.check').textContent = '✓';
          }
          const current = (profile.subGroups || {})[g] || [];
          profile.subGroups = {
            ...(profile.subGroups || {}),
            [g]: cb.checked ? [...current, sub] : current.filter(x => x !== sub)
          };
          await window.app.saveProfileConfig(profile.profileDirectory, { groups: profile.groups, subGroups: profile.subGroups });
          // Update only tags, keep dropdown open
          const tagsWrap = card.querySelector('.tags-wrap');
          if (tagsWrap) renderTagsInto(tagsWrap, profile, card);
          refreshAvatarInCard(card, profile);
        });
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(sub));
        subPanel.appendChild(lbl);
      });

      // Toggle expand on arrow click
      expandArrow.addEventListener('click', e => {
        e.stopPropagation();
        const show = subPanel.style.display === 'none';
        subPanel.style.display = show ? 'block' : 'none';
        expandArrow.textContent = show ? '▾' : '▸';
      });

      mainRow.appendChild(expandArrow);
      item.appendChild(mainRow);
      item.appendChild(subPanel);
    } else {
      item.appendChild(mainRow);
    }

    // Click main row → toggle group membership
    mainRow.addEventListener('click', async e => {
      e.stopPropagation();
      if (selected) {
        profile.groups = (profile.groups || []).filter(x => x !== g);
        const s = { ...(profile.subGroups || {}) }; delete s[g]; profile.subGroups = s;
      } else {
        profile.groups = [...(profile.groups || []), g];
      }
      await window.app.saveProfileConfig(profile.profileDirectory, { groups: profile.groups, subGroups: profile.subGroups });
      menu.classList.remove('open');
      buildGroupTags(profile, card);
      refreshAvatarInCard(card, profile);
    });

    menu.appendChild(item);
  });

  addBtn.addEventListener('click', e => {
    e.stopPropagation();
    const willOpen = !menu.classList.contains('open');
    menu.classList.toggle('open');
    // Bump card z-index so dropdown appears above sibling cards
    const parentCard = card;
    if (willOpen) parentCard.classList.add('dropdown-open');
  });
  wrap.appendChild(addBtn); wrap.appendChild(menu);
  row.appendChild(wrap);
}

function refreshAvatarInCard(card, profile) {
  buildAvatarEl(profile).then(el => {
    const old = card.querySelector('.profile-avatar');
    if (old) old.replaceWith(el);
  });
}

// ── Social icon ───────────────────────────────────────────
const SOCIAL_ICONS = {
  facebook:'📘',instagram:'📷',x:'🐦',tiktok:'🎵',
  threads:'🧵',linkedin:'💼',chotot:'🛍️'
};
function socialIcon(id) { return SOCIAL_ICONS[id] || '🌐'; }

// ── Build card (Fix 4: delete button in actions row) ──────
async function buildCard(profile) {
  const card = document.createElement('div');
  card.className = 'profile-card';
  card.dataset.profileDir = profile.profileDirectory;

  const gmailCount = (profile.googleAccounts || []).length;
  const socialCache = profileSocialCache[profile.profileDirectory];
  const socialCount = socialCache ? Object.values(socialCache).filter(s=>s.loggedIn).length : null;
  const socialLabel = socialCount === null ? '⏳' : socialCount;
  const socialClass = (socialCount === null || socialCount === 0) ? 'empty' : '';
  const gmailClass = gmailCount === 0 ? 'empty' : '';

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
          </div>
        </div>
      </div>
      <div class="card-status ${profile.hasShortcut ? 'has' : 'none'}">
        <span class="status-dot"></span>${profile.hasShortcut ? 'Có shortcut' : 'Chưa có'}
      </div>
    </div>

    <div class="groups-row"></div>

    <div class="account-badges">
      <button class="badge-btn badge-gmail ${gmailClass}" data-dir="${ea(profile.profileDirectory)}" title="Xem tài khoản Gmail">
        <span class="badge-icon">✉️</span>
        <span class="gmail-badge-count">${gmailCount}</span> Gmail
      </button>
      <button class="badge-btn badge-social ${socialClass}" data-dir="${ea(profile.profileDirectory)}" data-path="${ea(profile.profilePath)}" title="Xem tài khoản mạng xã hội">
        <span class="badge-icon">🔗</span>
        <span class="social-badge-count">${socialLabel}</span> Social
      </button>
    </div>

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
      <div class="notes-toggle ${profile.notes ? 'open' : ''}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
        Ghi chú${profile.notes ? '<span class="notes-dot"></span>' : ''}
      </div>
      <div class="notes-area ${profile.notes ? 'open' : ''}">
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
      <button class="btn btn-del-profile" data-dir="${ea(profile.profileDirectory)}" data-path="${ea(profile.profilePath)}" title="Xóa tài khoản Chrome này vĩnh viễn">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        <span class="del-text">Xóa tài khoản</span>
      </button>
    </div>
  `;

  buildAvatarEl(profile).then(el => card.querySelector('.avatar-wrap').replaceWith(el));
  buildGroupTags(profile, card);

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
    if (res.success) { cacheSpan.textContent='0 B'; cacheSpan.style.color=''; showToast(`Đã xóa ${res.freedText} cache`,'success'); }
    else showToast(res.error,'error');
    e.currentTarget.disabled = false;
  });

  card.querySelector('.notes-toggle').addEventListener('click', e => {
    e.currentTarget.classList.toggle('open');
    card.querySelector('.notes-area').classList.toggle('open');
  });
  card.querySelector('.notes-textarea').addEventListener('blur', async e => {
    const notes = e.target.value;
    const p = allProfiles.find(x=>x.profileDirectory===e.target.dataset.dir);
    if (!p) return;
    p.notes = notes;
    await window.app.saveProfileConfig(e.target.dataset.dir, { notes });
    const toggle = card.querySelector('.notes-toggle');
    const dot = toggle.querySelector('.notes-dot');
    if (notes.trim()&&!dot){const d=document.createElement('span');d.className='notes-dot';toggle.appendChild(d);}
    else if(!notes.trim()&&dot) dot.remove();
  });

  card.querySelector('.input-name').addEventListener('blur', async e => {
    const name = e.target.value.trim();
    const dir = e.target.dataset.dir;
    const p = allProfiles.find(x=>x.profileDirectory===dir);
    if (!p) return;
    const warn = document.getElementById(`warn-${dir}`);
    const dup = await window.app.checkDuplicateName(dir, name);
    if (dup.isDuplicate) { if(warn) warn.classList.add('show'); return; }
    if (warn) warn.classList.remove('show');
    p.shortcutName = name;
    await window.app.saveProfileConfig(dir, { shortcutName: name });
    card.querySelector('.profile-name-info h3').textContent = name||p.chromeProfileName||p.profileDirectory;
    refreshAvatarInCard(card, p);
  });
  card.querySelector('.input-name').addEventListener('input', () => {
    const warn = document.getElementById(`warn-${profile.profileDirectory}`);
    if (warn) warn.classList.remove('show');
  });

  card.querySelector('.badge-gmail').addEventListener('click', () => openGmailModal(profile));

  card.querySelector('.badge-social').addEventListener('click', async e => {
    const dir = e.currentTarget.dataset.dir;
    const pPath = e.currentTarget.dataset.path;
    const p = allProfiles.find(x=>x.profileDirectory===dir);
    await openSocialModal(p, pPath);
  });

  card.querySelector('.btn-open').addEventListener('click', async e => {
    const res = await window.app.openProfile(e.currentTarget.dataset.dir);
    if (res.success) showToast('Đang mở Chrome profile...','info');
    else showToast(res.error,'error');
  });

  card.querySelector('.btn-history').addEventListener('click', async e => {
    const dir = e.currentTarget.dataset.dir;
    const pPath = e.currentTarget.dataset.path;
    const p = allProfiles.find(x=>x.profileDirectory===dir);
    openHistoryModal(p, pPath);
  });

  card.querySelector('.btn-create').addEventListener('click', async e => {
    const dir = e.currentTarget.dataset.dir;
    const p = allProfiles.find(x=>x.profileDirectory===dir);
    if (!p) return;
    const name = p.shortcutName||p.chromeProfileName||p.profileDirectory;
    const dup = await window.app.checkDuplicateName(dir, name);
    if (dup.isDuplicate) { showToast(`Tên "${name}" đã được dùng!`,'warning'); return; }
    const res = await window.app.createShortcut(dir, name);
    if (res.success) { p.hasShortcut=true; showToast(`Đã tạo shortcut "${name}"!`,'success'); refreshCardStatus(card,p); updateStats(allProfiles); }
    else showToast(res.error,'error');
  });

  card.querySelector('.btn-delete').addEventListener('click', async e => {
    const dir = e.currentTarget.dataset.dir;
    const p = allProfiles.find(x=>x.profileDirectory===dir);
    if (!p) return;
    const name = p.shortcutName||p.chromeProfileName||p.profileDirectory;
    const res = await window.app.deleteShortcut(name);
    if (res.success) { p.hasShortcut=false; showToast(`Đã xóa shortcut "${name}"`,'warning'); refreshCardStatus(card,p); updateStats(allProfiles); }
    else showToast(res.error||'Không xóa được','error');
  });

  card.querySelector('.btn-del-profile').addEventListener('click', async e => {
    const dir = e.currentTarget.dataset.dir;
    const pPath = e.currentTarget.dataset.path;
    const p = allProfiles.find(x=>x.profileDirectory===dir);
    if (!p) return;
    const displayName = p.shortcutName||p.chromeProfileName||dir;
    const res = await window.app.deleteProfile(pPath, dir, displayName);
    if (res.cancelled) return;
    if (res.success) {
      allProfiles = allProfiles.filter(x=>x.profileDirectory!==dir);
      delete profileSocialCache[dir];
      card.remove();
      updateStats(allProfiles); renderSidebar();
      showToast(`Đã xóa tài khoản "${displayName}"`,'warning');
    } else showToast(res.error,'error');
  });

  return card;
}

function refreshCardStatus(card, profile) {
  const s = card.querySelector('.card-status');
  s.className = `card-status ${profile.hasShortcut ? 'has' : 'none'}`;
  s.innerHTML = `<span class="status-dot"></span>${profile.hasShortcut ? 'Có shortcut' : 'Chưa có'}`;
  card.querySelector('.btn-delete').disabled = !profile.hasShortcut;
}

// ── Gmail modal ───────────────────────────────────────────
function openGmailModal(profile) {
  document.getElementById('gmail-profile-name').textContent = profile.shortcutName||profile.chromeProfileName||profile.profileDirectory;
  const list = document.getElementById('gmail-list');
  const accs = profile.googleAccounts || [];
  if (!accs.length) {
    list.innerHTML = '<div class="gmail-empty">Chưa có tài khoản Gmail nào đăng nhập trên profile này</div>';
  } else {
    list.innerHTML = accs.map(a => `
      <div class="gmail-item">
        <div class="gmail-avatar">${(a.fullName||a.email||'?').charAt(0).toUpperCase()}</div>
        <div class="gmail-info">
          <div class="gmail-name">${eh(a.fullName||a.email)}</div>
          <div class="gmail-email">${eh(a.email)}</div>
        </div>
        <div class="gmail-status">Đã xác thực</div>
      </div>
    `).join('');
  }
  document.getElementById('modal-gmail').classList.remove('hidden');
}

// ── Social modal ──────────────────────────────────────────
let _socialModalProfile = null;

async function openSocialModal(profile, profilePath) {
  _socialModalProfile = { profile, profilePath };
  document.getElementById('social-profile-name').textContent = profile.shortcutName||profile.chromeProfileName||profile.profileDirectory;
  document.getElementById('social-loading').style.display = '';
  document.getElementById('social-list').style.display = 'none';
  document.getElementById('social-diag-panel').style.display = 'none';
  document.getElementById('modal-social').classList.remove('hidden');

  if (!profileSocialCache[profile.profileDirectory]) {
    profileSocialCache[profile.profileDirectory] = await window.app.getSocialStatus(profilePath, socialSitesConfig);
    const sc = profileSocialCache[profile.profileDirectory];
    const cnt = Object.values(sc).filter(s=>s.loggedIn).length;
    const card = document.querySelector(`[data-profile-dir="${ea(profile.profileDirectory)}"]`);
    if (card) {
      const sp = card.querySelector('.social-badge-count');
      if (sp) sp.textContent = cnt;
      const btn = card.querySelector('.badge-social');
      if (btn) btn.classList.toggle('empty', cnt===0);
    }
    renderSidebar();
  }

  document.getElementById('social-loading').style.display = 'none';
  const list = document.getElementById('social-list');
  list.style.display = '';
  const status = profileSocialCache[profile.profileDirectory];

  // Check if any result used full decryption
  const usedDecryption = Object.values(status).some(s => s.decrypted);
  const decryptBadge = document.getElementById('social-decrypt-badge');
  if (decryptBadge) {
    decryptBadge.style.display = '';
    decryptBadge.textContent = usedDecryption ? '🔓 Đã giải mã DPAPI' : '🔒 Không giải mã được (chỉ check tên cookie)';
    decryptBadge.style.color = usedDecryption ? 'var(--success)' : 'var(--warning)';
  }

  list.innerHTML = '';
  socialSitesConfig.forEach(site => {
    const s = status[site.id] || { loggedIn: false, name: site.name };
    // Show which cookie names are being checked
    const cookieNames = site.cookieNames || [site.cookieName];
    const domains = site.domains || [site.domain];
    const cookieHint = cookieNames.join(', ');
    const domainHint = domains.join(' / ');

    const div = document.createElement('div');
    div.className = `social-item ${s.loggedIn ? 'logged-in' : 'logged-out'}`;
    div.innerHTML = `
      <span class="social-icon">${socialIcon(site.id)}</span>
      <div class="social-info">
        <div class="social-name">${eh(site.name)}</div>
        <div class="social-status">${s.loggedIn ? '● Đã đăng nhập' : '○ Chưa đăng nhập'}</div>
        <div class="social-cookie-hint" title="Domain kiểm tra: ${eh(domainHint)}">🔑 ${eh(cookieHint)}</div>
      </div>
      <span class="social-dot"></span>
    `;
    list.appendChild(div);
  });
}

function closeSocialModal() {
  document.getElementById('modal-social').classList.add('hidden');
  document.getElementById('social-diag-panel').style.display = 'none';
  _socialModalProfile = null;
}

async function runCookieDiagnostic() {
  if (!_socialModalProfile) return;
  const { profilePath, profile } = _socialModalProfile;
  const panel = document.getElementById('social-diag-panel');
  const content = document.getElementById('social-diag-content');
  panel.style.display = '';
  content.innerHTML = '<div style="color:var(--muted);font-size:12px">Đang dò cookie...</div>';

  // Use the detailed debug API
  const dbg = await window.app.debugSocialStatus(profilePath, socialSitesConfig);

  content.innerHTML = '';

  // Header: cookie file + DPAPI status
  const infoBar = document.createElement('div');
  infoBar.style.cssText = 'font-size:11px;margin-bottom:8px;padding:6px 8px;background:var(--bg);border-radius:6px;border:1px solid var(--border)';
  const fileOk = !!dbg.cookieFile;
  const dpOk = dbg.dpapiWorking;
  const walOk = dbg.walExists;
  const cdpOk = dbg.cdpAvailable;
  infoBar.innerHTML = [
    cdpOk
      ? `🟢 <b style="color:var(--success)">CDP: Đã kết nối</b> <span style="color:var(--muted)">(port ${dbg.cdpPort}, ${dbg.cdpCookieCount} cookies)</span>`
      : dbg.cdpPort
        ? `🟡 <b style="color:var(--warning)">CDP: Lỗi kết nối</b> <span style="color:var(--muted)">${eh(dbg.cdpError||'')}</span>`
        : `⚪ CDP: <span style="color:var(--muted)">Chrome chưa mở qua UP Media — mở profile bằng nút ▶ rồi thử lại</span>`,
    `&nbsp;|&nbsp; 📁 Cookie DB: <b style="color:${fileOk ? 'var(--success)' : 'var(--danger)'}">${fileOk ? 'Tìm thấy' : 'KHÔNG TÌM THẤY'}</b>`,
    fileOk ? `<span style="color:var(--muted)">(${eh(dbg.cookieFile.split(/[\\/]/).slice(-3).join('/'))})</span>` : '',
    `&nbsp;|&nbsp; 🔐 DPAPI: <b style="color:${dpOk ? 'var(--success)' : 'var(--warning)'}">${dpOk ? 'Hoạt động ✓' : 'Không hoạt động'}</b>`,
  ].join(' ');
  content.appendChild(infoBar);

  // Raw DB diagnostic — show table name + sample hosts to debug schema issues
  if (dbg.rawDiag) {
    const rd = dbg.rawDiag;
    const rawBar = document.createElement('div');
    rawBar.style.cssText = 'font-size:11px;margin-bottom:8px;padding:6px 8px;background:#1e293b;border-radius:6px;border:1px solid #334155;color:#94a3b8;font-family:monospace';
    const lines = [];
    // CDP status (most important — show first)
    lines.push(`CDP port: <b style="color:${dbg.cdpPort ? '#4ade80' : '#f87171'}">${dbg.cdpPort ? dbg.cdpPort + ' (TCP OK)' : 'NOT FOUND'}</b>`);
    if (dbg.cdpAvailable) lines.push(`CDP cookies: <b style="color:#4ade80">${dbg.cdpCookieCount}</b>`);
    else if (dbg.cdpError) lines.push(`CDP error: <b style="color:#f87171">${eh(dbg.cdpError)}</b>`);
    if (dbg.chromeDiag) {
      const cd = dbg.chromeDiag;
      if (cd.portsOpen && cd.portsOpen.length) lines.push(`<br>Open debug ports: <b style="color:#4ade80">${cd.portsOpen.join(', ')}</b>`);
      else lines.push(`<br>Ports 9220-9230: <b style="color:#f87171">none open</b>`);
      if (cd.processes && cd.processes.length) lines.push(`Chrome flags: <b style="color:#cbd5e1">${cd.processes.map(eh).join(' ')}</b>`);
    }
    if (rd.error) {
      lines.push(`⚠ Error: ${eh(rd.error)}`);
    }
    // File-level info
    lines.push(`File size: <b style="color:#e2e8f0">${rd.fileSize ?? '?'} bytes</b>`);
    lines.push(`SQLite magic: <b style="color:${rd.sqliteMagic ? '#4ade80' : '#f87171'}">${rd.sqliteMagic ? 'OK' : 'INVALID - ' + eh((rd.magic||'').slice(0,12))}</b>`);
    if (rd.networkFiles && rd.networkFiles.length) {
      lines.push(`Network/ files: <b style="color:#cbd5e1">${rd.networkFiles.map(eh).join(', ')}</b>`);
    }
    // SQL-level info
    if (rd.tables !== undefined) {
      lines.push(`Tables: <b style="color:#e2e8f0">${(rd.tables||[]).map(eh).join(', ') || '(none)'}</b>`);
      if (rd.cookieTable) lines.push(`Cookie table: <b style="color:#4ade80">${eh(rd.cookieTable)}</b> (${rd.cookieCount ?? '?'} rows)`);
      else lines.push(`<b style="color:#f87171">No table with host_key found!</b>`);
      if (rd.sampleHosts && rd.sampleHosts.length) {
        lines.push(`Sample hosts: <b style="color:#e2e8f0">${rd.sampleHosts.slice(0,5).map(eh).join(', ')}</b>`);
      }
    }
    if (rd.journalSize !== undefined) lines.push(`Cookies-journal: <b style="color:#fbbf24">${rd.journalSize}B</b>`);
    if (rd.networkFiles && rd.networkFiles.length) {
      lines.push(`<br>Network/: <span style="color:#94a3b8">${rd.networkFiles.map(eh).join(' | ')}</span>`);
    }
    if (rd.sqliteInProfile && rd.sqliteInProfile.length) {
      lines.push(`<br>SQLite in profile/: <b style="color:#4ade80">${rd.sqliteInProfile.map(eh).join(' | ')}</b>`);
    }
    rawBar.innerHTML = lines.join('&nbsp;&nbsp;|&nbsp;&nbsp;');
    content.appendChild(rawBar);
  }

  // Per-site results
  socialSitesConfig.forEach(site => {
    const cookieNames = site.cookieNames || [site.cookieName];
    const siteDbg = dbg.sites[site.id] || {};
    const rows = siteDbg.rows || [];
    const hasError = !!siteDbg.error;

    const block = document.createElement('div');
    block.style.cssText = 'margin-bottom:10px;font-size:12px';

    const header = document.createElement('div');
    header.style.cssText = 'font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap';

    // Determine detection result
    const validRow = rows.find(r => {
      if (r.expired) return false;
      if (r.hasPlainValue) return true;
      if (r.decryptOk === true) return true;
      if (r.decryptOk === null && (r.prefix === 'v10' || r.prefix === 'v11' || r.prefix === 'v20')) return true;
      return false;
    });
    const foundAny = rows.length > 0;
    const statusColor = validRow ? 'var(--success)' : (foundAny ? 'var(--warning)' : 'var(--danger)');
    const statusText = validRow ? '✓ Đã đăng nhập' : (foundAny ? '⚠ Có cookie nhưng không hợp lệ' : '✗ Không tìm thấy');

    header.innerHTML = `${socialIcon(site.id)} ${eh(site.name)} <span style="font-weight:400;color:${statusColor}">${statusText}</span>`;
    block.appendChild(header);

    if (hasError) {
      const err = document.createElement('div');
      err.style.cssText = 'color:var(--danger);font-size:11px;padding-left:8px';
      err.textContent = 'Lỗi: ' + siteDbg.error;
      block.appendChild(err);
    } else if (!rows.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:var(--muted);padding-left:8px;font-size:11px';
      empty.textContent = `Không tìm thấy cookie nào (kiểm tra: ${cookieNames.join(', ')})`;
      block.appendChild(empty);
    } else {
      const table = document.createElement('div');
      table.className = 'diag-chips';
      rows.forEach(r => {
        const chip = document.createElement('span');
        chip.className = 'diag-chip';

        // Determine chip color
        const isValid = !r.expired && (r.hasPlainValue || r.decryptOk === true ||
          (r.decryptOk === null && (r.prefix === 'v10' || r.prefix === 'v11' || r.prefix === 'v20')));

        if (isValid) {
          chip.style.cssText = 'background:var(--success);color:#fff;font-weight:600';
        } else if (r.expired) {
          chip.style.cssText = 'background:#fca5a5;color:#7f1d1d;font-weight:600';
        } else {
          chip.style.cssText = 'background:var(--bg);border:1px solid var(--border);color:var(--muted)';
        }

        // Detailed tooltip
        const parts = [`host: ${r.host}`];
        if (r.prefix) parts.push(`prefix: ${r.prefix}`);
        if (r.decryptOk === true) parts.push('decrypt: OK');
        else if (r.decryptOk === false) parts.push('decrypt: FAIL');
        if (r.expired) parts.push('HẾT HẠN');
        chip.title = parts.join(' | ');
        chip.textContent = r.name + (r.prefix ? ` [${r.prefix}]` : '') + (r.expired ? ' ⚠' : '');
        table.appendChild(chip);
      });
      block.appendChild(table);
    }

    content.appendChild(block);
  });

  const note = document.createElement('div');
  note.style.cssText = 'margin-top:8px;font-size:11px;color:var(--muted);border-top:1px solid var(--border);padding-top:8px';
  note.innerHTML = [
    '✅ xanh = cookie hợp lệ (đăng nhập)',
    '🟠 cam = có cookie nhưng không xác minh được',
    '🔴 đỏ = hết hạn',
    'xám = không phải target cookie',
    '<br>[v10/v11] = Chrome cũ &nbsp; [v20] = Chrome 127+ &nbsp; <b>Vào ⚙ Quản lý site để sửa tên cookie</b>',
  ].join('&nbsp;&nbsp;•&nbsp;&nbsp;');
  content.appendChild(note);
}

// ── Manage social sites ───────────────────────────────────
let tempSocialSites = [];

function openManageSitesModal() {
  tempSocialSites = JSON.parse(JSON.stringify(socialSitesConfig));
  renderSitesList();
  document.getElementById('modal-manage-sites').classList.remove('hidden');
}

function renderSitesList() {
  const ul = document.getElementById('sites-list');
  ul.innerHTML = '';
  tempSocialSites.forEach((site, i) => {
    const li = document.createElement('li');
    li.className = 'sites-item';
    li.innerHTML = `
      <span class="sites-item-name">${socialIcon(site.id)} ${eh(site.name)}</span>
      <span class="sites-item-domain">${eh(site.domain)}</span>
      <span class="sites-item-cookie">${eh(site.cookieName)}</span>
      <button class="btn btn-danger btn-xs">Xóa</button>
    `;
    li.querySelector('button').addEventListener('click', () => { tempSocialSites.splice(i,1); renderSitesList(); });
    ul.appendChild(li);
  });
}

async function saveSocialSites() {
  socialSitesConfig = tempSocialSites;
  await window.app.saveSocialSites(socialSitesConfig);
  profileSocialCache = {};
  document.getElementById('modal-manage-sites').classList.add('hidden');
  showToast('Đã lưu danh sách site','success');
}

// ── History modal ─────────────────────────────────────────
async function openHistoryModal(profile, profilePath) {
  document.getElementById('history-profile-name').textContent = profile.shortcutName||profile.chromeProfileName||profile.profileDirectory;
  document.getElementById('modal-history').classList.remove('hidden');
  document.getElementById('history-loading').style.display = '';
  document.getElementById('history-list').innerHTML = '';

  const res = await window.app.getProfileHistory(profilePath);
  document.getElementById('history-loading').style.display = 'none';

  const list = document.getElementById('history-list');
  if (!res.ok) { list.innerHTML=`<li style="padding:16px;text-align:center;color:var(--muted)">${eh(res.error)}</li>`; return; }
  if (!res.items.length) { list.innerHTML=`<li style="padding:16px;text-align:center;color:var(--muted)">Chưa có lịch sử duyệt web</li>`; return; }

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
      if (r.success) showToast('Đang mở Chrome với trang web...','info');
      else showToast(r.error,'error');
    });
    list.appendChild(li);
  });
}

function closeHistoryModal() { document.getElementById('modal-history').classList.add('hidden'); }

// ── Render profiles ───────────────────────────────────────
async function renderProfiles(profiles) {
  currentFiltered = profiles;
  const grid = document.getElementById('profile-grid');
  grid.innerHTML = '';

  const btnOpenAll = document.getElementById('btn-open-all');
  const isFiltered = activeSidebarFilter || document.getElementById('search-input').value.trim();
  if (isFiltered && profiles.length > 1) {
    btnOpenAll.style.display=''; document.getElementById('open-all-count').textContent=profiles.length;
  } else {
    btnOpenAll.style.display='none';
  }

  if (!profiles.length) {
    grid.innerHTML='<div class="no-results"><h3>Không tìm thấy profile nào</h3><p>Thử thay đổi bộ lọc hoặc từ khóa</p></div>';
    return;
  }
  for (const p of profiles) grid.appendChild(await buildCard(p));
}

// ── Scan ──────────────────────────────────────────────────
async function scanProfiles() {
  showState('loading');
  try {
    const result = await window.app.scanProfiles();
    allProfiles = result.profiles;
    profileSocialCache = {};
    updateStats(allProfiles); renderSidebar();
    showState('grid'); applyFilter();
    showToast(`Tìm thấy ${allProfiles.length} profile Chrome`,'success');
    // Background social scan
    backgroundScanSocial();
  } catch (err) {
    showState('empty');
    const isNF = err.message&&err.message.includes('NOT_FOUND_USER_DATA');
    document.getElementById('empty-title').textContent = isNF ? 'Không tìm thấy thư mục Chrome' : 'Có lỗi xảy ra';
    document.getElementById('empty-desc').innerHTML = isNF
      ? 'Bấm <strong>"Chọn thư mục thủ công"</strong> để chỉ đường cho app.'
      : eh(err.message||'Không rõ lỗi');
    showToast('Không tìm thấy Chrome.','error');
  }
}

// ── Open all filtered ─────────────────────────────────────
async function openAllFiltered() {
  if (!currentFiltered.length) return;
  const btn = document.getElementById('btn-open-all');
  btn.disabled=true;
  const dirs = currentFiltered.map(p=>p.profileDirectory);
  const res = await window.app.openProfilesBatch(dirs);
  btn.disabled=false;
  showToast(`Đã mở ${res.ok} profile${res.fail?`, ${res.fail} lỗi`:''}`, res.fail?'warning':'success');
}

// ── Create all shortcuts ───────────────────────────────────
async function createAllShortcuts() {
  if (!allProfiles.length) { showToast('Chưa có profile nào.','warning'); return; }
  let ok=0,fail=0,dup=0;
  const btn = document.getElementById('btn-create-all');
  btn.disabled=true; btn.textContent='Đang tạo...';
  for (const p of allProfiles) {
    const name = p.shortcutName||p.chromeProfileName||p.profileDirectory;
    const d = await window.app.checkDuplicateName(p.profileDirectory, name);
    if (d.isDuplicate) { dup++; continue; }
    const res = await window.app.createShortcut(p.profileDirectory, name);
    if (res.success) { p.hasShortcut=true; ok++; } else fail++;
  }
  btn.disabled=false;
  btn.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Tạo tất cả shortcut`;
  updateStats(allProfiles); applyFilter();
  let msg=`Đã tạo ${ok} shortcut`;
  if (dup) msg+=`, bỏ qua ${dup} tên trùng`;
  if (fail) msg+=`, lỗi ${fail}`;
  showToast(msg, fail||dup?'warning':'success');
}

async function removeBadExtensions() {
  const btn = document.getElementById('btn-remove-ext');
  btn.disabled=true; btn.textContent='Đang dọn...';
  const res = await window.app.removeBadExtensions();
  btn.disabled=false;
  btn.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Dọn tiện ích`;
  if (res.success) {
    if (!res.totalRemoved) showToast('Không tìm thấy tiện ích McAfee/IDM nào','info');
    else showToast(`Đã xóa ${res.totalRemoved} tiện ích + đã chặn qua Chrome Policy (bỏ qua ${res.skipped} profile được bảo vệ)`,'success');
  }
}

async function killAllChrome() {
  const btn = document.getElementById('btn-kill-chrome');
  btn.disabled=true;
  const res = await window.app.killAllChrome();
  btn.disabled=false;
  if (res.notFound) showToast('Không có Chrome nào đang mở','info');
  else showToast('Đã đóng tất cả Chrome','success');
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
  const entries = allProfiles.map(p=>({p,size:sizes[p.profileDirectory]||0})).sort((a,b)=>b.size-a.size);

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
      if (res.success) { showToast(`Đã xóa ${res.freedText}`,'success'); openStorageModal(); }
      else showToast(res.error,'error');
    });
    list.appendChild(li);
  }
  summary.innerHTML=`<span>Tổng cache:</span><span class="total-size">${fmtBytes(total)}</span>`;
}

function closeStorageModal() { document.getElementById('modal-storage').classList.add('hidden'); }

// ── Group modal (Fix 5: track original name for rename) ───
function openGroupModal() {
  // Store as objects with original name to detect renames
  tempGroups = allGroups.map(g => ({ name: g, original: g }));
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
  tempGroups.forEach((gObj, i) => {
    const g = gObj.name;
    const isDefault = DEFAULT_GROUPS.includes(gObj.original);
    const subs = tempGroupSubs[g] || [];
    const li = document.createElement('li');
    li.className = 'group-item';
    li.innerHTML = `
      <div class="group-item-row">
        <span class="group-item-name">${eh(g)}</span>
        <input type="text" class="group-item-input" value="${ea(g)}" maxlength="30"/>
        ${isDefault ? '<span class="group-item-default">Mặc định</span>' : ''}
        <button class="btn btn-outline btn-xs btn-edit-grp">Sửa</button>
        ${!isDefault ? `<button class="btn btn-danger btn-xs btn-del-grp">Xóa</button>` : ''}
        <button class="btn btn-outline btn-xs btn-expand-subs">▸ Danh mục con (${subs.length})</button>
      </div>
      <div class="group-subs-panel" style="display:none">
        <div class="subs-list"></div>
        <div style="display:flex;gap:5px;margin-top:6px">
          <input type="text" class="form-input sub-input" placeholder="Tên danh mục con..." maxlength="30" style="flex:1"/>
          <button class="btn btn-primary btn-xs btn-add-sub">+ Thêm</button>
        </div>
      </div>
    `;

    const panel = li.querySelector('.group-subs-panel');
    const subsList = li.querySelector('.subs-list');
    const subInput = li.querySelector('.sub-input');
    const expandBtn = li.querySelector('.btn-expand-subs');

    function renderSubs() {
      subsList.innerHTML = '';
      (tempGroupSubs[g]||[]).forEach((sub, si) => {
        const s = document.createElement('div');
        s.className = 'group-sub-row';
        s.innerHTML = `<span class="group-sub-name">• ${eh(sub)}</span><button class="btn btn-danger btn-xs">Xóa</button>`;
        s.querySelector('button').addEventListener('click', () => {
          tempGroupSubs[g].splice(si,1);
          expandBtn.textContent=`${panel.style.display!=='none'?'▾':'▸'} Danh mục con (${tempGroupSubs[g].length})`;
          renderSubs();
        });
        subsList.appendChild(s);
      });
    }
    renderSubs();

    expandBtn.addEventListener('click', () => {
      const show = panel.style.display==='none';
      panel.style.display = show?'':'none';
      expandBtn.textContent=`${show?'▾':'▸'} Danh mục con (${(tempGroupSubs[g]||[]).length})`;
    });

    li.querySelector('.btn-add-sub').addEventListener('click', () => {
      const v = subInput.value.trim();
      if (!v) return;
      if (!tempGroupSubs[g]) tempGroupSubs[g]=[];
      if (!tempGroupSubs[g].includes(v)) { tempGroupSubs[g].push(v); subInput.value=''; renderSubs(); }
    });
    subInput.addEventListener('keydown', e => { if(e.key==='Enter') li.querySelector('.btn-add-sub').click(); });

    li.querySelector('.btn-edit-grp').addEventListener('click', () => {
      li.classList.toggle('editing');
      if (!li.classList.contains('editing')) {
        const v = li.querySelector('.group-item-input').value.trim();
        if (v && v !== g) {
          // Rename in tempGroupSubs
          if (tempGroupSubs[g]) { tempGroupSubs[v]=tempGroupSubs[g]; delete tempGroupSubs[g]; }
          tempGroups[i] = { name: v, original: gObj.original }; // keep original for rename tracking
          renderGroupList();
        }
      } else li.querySelector('.group-item-input').focus();
    });

    li.querySelector('.btn-del-grp')?.addEventListener('click', () => {
      delete tempGroupSubs[g]; tempGroups.splice(i,1); renderGroupList();
    });

    ul.appendChild(li);
  });
}

async function saveGroups() {
  // Detect renames and update all profiles
  for (const gObj of tempGroups) {
    if (gObj.original && gObj.name !== gObj.original) {
      await window.app.renameGroupInProfiles(gObj.original, gObj.name);
      // Update in-memory profiles too
      allProfiles.forEach(p => {
        if ((p.groups||[]).includes(gObj.original)) {
          p.groups = p.groups.map(x => x===gObj.original ? gObj.name : x);
          if ((p.subGroups||{})[gObj.original] !== undefined) {
            p.subGroups[gObj.name] = p.subGroups[gObj.original];
            delete p.subGroups[gObj.original];
          }
        }
      });
    }
  }

  allGroups = tempGroups.map(g => g.name).filter(n=>n.trim());
  allGroupSubs = tempGroupSubs;
  await window.app.saveGroups(allGroups);
  await window.app.saveGroupSubs(allGroupSubs);
  renderSidebar(); closeGroupModal();
  showToast('Đã lưu danh sách nhóm','success');
  // Re-render cards to reflect group name changes
  applyFilter();
}

// ── New profile modal (multi-sub support) ─────────────────
let newProfileSelectedGroups = [];
let newProfileSubGroups = {}; // { 'Seeding': ['T1','T2'] }

function openNewProfileModal() {
  newProfileSelectedGroups = [];
  newProfileSubGroups = {};
  document.getElementById('new-profile-name').value='';
  document.getElementById('new-profile-notes').value='';
  buildNewProfileGroupsUI();
  document.getElementById('modal-new-profile').classList.remove('hidden');
  setTimeout(() => document.getElementById('new-profile-name').focus(), 100);
}

function buildNewProfileGroupsUI() {
  const row = document.getElementById('new-profile-groups-row');
  row.innerHTML = '';

  newProfileSelectedGroups.forEach(g => {
    const subs = allGroupSubs[g] || [];
    const selectedSubs = newProfileSubGroups[g] || [];
    const entry = document.createElement('div');
    entry.className = 'new-profile-group-entry';

    const tag = document.createElement('span');
    tag.className = `group-tag gc-${groupClass(g)}`;
    tag.style.cssText = 'cursor:default;font-size:11px';
    if (selectedSubs.length) {
      tag.textContent = `${g} · ${selectedSubs.join(' · ')}`;
    } else {
      tag.textContent = g;
    }

    const removeBtn = document.createElement('span');
    removeBtn.className = 'remove-tag';
    removeBtn.style.cssText = 'cursor:pointer;margin-left:3px;opacity:.7';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      newProfileSelectedGroups = newProfileSelectedGroups.filter(x=>x!==g);
      delete newProfileSubGroups[g];
      buildNewProfileGroupsUI();
    });
    tag.appendChild(removeBtn);
    entry.appendChild(tag);

    // Multi-select checkboxes for subs
    if (subs.length) {
      const subWrap = document.createElement('div');
      subWrap.className = 'new-profile-sub-wrap';
      subs.forEach(sub => {
        const label = document.createElement('label');
        label.className = 'new-profile-sub-check';
        const checked = selectedSubs.includes(sub);
        label.innerHTML = `<input type="checkbox" value="${ea(sub)}" ${checked?'checked':''}/> ${eh(sub)}`;
        label.querySelector('input').addEventListener('change', e => {
          if (!newProfileSubGroups[g]) newProfileSubGroups[g] = [];
          if (e.target.checked) newProfileSubGroups[g].push(sub);
          else newProfileSubGroups[g] = newProfileSubGroups[g].filter(x=>x!==sub);
          // Update tag text
          tag.childNodes[0].textContent = newProfileSubGroups[g].length
            ? `${g} · ${newProfileSubGroups[g].join(' · ')} `
            : `${g} `;
        });
        subWrap.appendChild(label);
      });
      entry.appendChild(subWrap);
    }

    row.appendChild(entry);
  });

  // Add group dropdown
  const wrap = document.createElement('div');
  wrap.className = 'group-dropdown';
  const btn = document.createElement('button');
  btn.className = 'add-group-btn';
  btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Chọn nhóm`;
  const menu = document.createElement('div');
  menu.className = 'group-dropdown-menu';
  menu.style.cssText = 'max-height:200px;overflow-y:auto';
  allGroups.forEach(g => {
    const selected = newProfileSelectedGroups.includes(g);
    const item = document.createElement('div');
    item.className = `group-dropdown-item${selected?' selected':''}`;
    item.innerHTML = `<span class="check">${selected?'✓':''}</span>${eh(g)}`;
    item.addEventListener('click', e => {
      e.stopPropagation();
      if (selected) { newProfileSelectedGroups=newProfileSelectedGroups.filter(x=>x!==g); delete newProfileSubGroups[g]; }
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

function closeNewProfileModal() { document.getElementById('modal-new-profile').classList.add('hidden'); }

async function confirmCreateProfile() {
  const name = document.getElementById('new-profile-name').value.trim();
  const notes = document.getElementById('new-profile-notes').value.trim();
  closeNewProfileModal();
  const res = await window.app.createChromeProfile(name, newProfileSelectedGroups, newProfileSubGroups, notes);
  if (res.success) {
    let msg=`Chrome mở tài khoản mới (${res.profileDirectory})`;
    if (name) msg+=` — đã đặt tên "${name}"`;
    msg+='. Bấm "Quét lại" sau khi xong.';
    showToast(msg,'success');
  } else showToast(res.error,'error');
}

// ── State ─────────────────────────────────────────────────
function showState(s) {
  document.getElementById('empty-state').style.display = s==='empty'?'':'none';
  document.getElementById('profile-grid').style.display = s==='grid'?'':'none';
  document.getElementById('loading').style.display = s==='loading'?'':'none';
}

// ── Close dropdowns ───────────────────────────────────────
document.addEventListener('click', () => {
  document.querySelectorAll('.group-dropdown-menu.open').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.profile-card.dropdown-open').forEach(c => c.classList.remove('dropdown-open'));
});

// ── Event bindings ────────────────────────────────────────
document.getElementById('btn-scan').addEventListener('click', scanProfiles);
document.getElementById('btn-create-all').addEventListener('click', createAllShortcuts);
document.getElementById('btn-open-all').addEventListener('click', openAllFiltered);
document.getElementById('btn-remove-ext').addEventListener('click', removeBadExtensions);
document.getElementById('btn-kill-chrome').addEventListener('click', killAllChrome);
document.getElementById('search-input').addEventListener('input', applyFilter);

document.getElementById('btn-pick-folder').addEventListener('click', async () => {
  const chosen = await window.app.pickUserDataFolder();
  if (chosen) { showToast(`Đã chọn: ${chosen}`,'info'); scanProfiles(); }
});

document.getElementById('btn-manage-groups').addEventListener('click', openGroupModal);
document.getElementById('modal-groups-close').addEventListener('click', closeGroupModal);
document.getElementById('btn-cancel-groups').addEventListener('click', closeGroupModal);
document.getElementById('btn-save-groups').addEventListener('click', saveGroups);
document.getElementById('btn-add-group').addEventListener('click', () => {
  const inp = document.getElementById('new-group-input');
  const name = inp.value.trim();
  if (!name) return;
  if (tempGroups.some(g=>g.name===name)) { showToast('Nhóm này đã tồn tại','warning'); return; }
  tempGroups.push({ name, original: '' }); // original='' means new group, no rename needed
  inp.value=''; renderGroupList();
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
  const btn=document.getElementById('btn-clear-all-cache');
  btn.disabled=true; btn.textContent='Đang xóa...';
  const res=await window.app.clearAllCache();
  btn.disabled=false; btn.textContent='Xóa cache tất cả';
  if(res.success) { showToast(`Đã xóa ${res.freedText} cache`,'success'); closeStorageModal(); }
});
document.getElementById('modal-storage').addEventListener('click', e => { if(e.target===e.currentTarget) closeStorageModal(); });

document.getElementById('modal-history-close').addEventListener('click', closeHistoryModal);
document.getElementById('btn-close-history').addEventListener('click', closeHistoryModal);
document.getElementById('modal-history').addEventListener('click', e => { if(e.target===e.currentTarget) closeHistoryModal(); });

document.getElementById('modal-gmail-close').addEventListener('click', () => document.getElementById('modal-gmail').classList.add('hidden'));
document.getElementById('btn-close-gmail').addEventListener('click', () => document.getElementById('modal-gmail').classList.add('hidden'));
document.getElementById('modal-gmail').addEventListener('click', e => { if(e.target===e.currentTarget) document.getElementById('modal-gmail').classList.add('hidden'); });

document.getElementById('modal-social-close').addEventListener('click', closeSocialModal);
document.getElementById('btn-close-social').addEventListener('click', closeSocialModal);
document.getElementById('modal-social').addEventListener('click', e => { if(e.target===e.currentTarget) closeSocialModal(); });
document.getElementById('btn-manage-social-sites').addEventListener('click', () => { closeSocialModal(); openManageSitesModal(); });
document.getElementById('btn-diag-cookies').addEventListener('click', runCookieDiagnostic);

document.getElementById('modal-manage-sites-close').addEventListener('click', () => document.getElementById('modal-manage-sites').classList.add('hidden'));
document.getElementById('btn-cancel-sites').addEventListener('click', () => document.getElementById('modal-manage-sites').classList.add('hidden'));
document.getElementById('btn-save-sites').addEventListener('click', saveSocialSites);
document.getElementById('btn-add-site').addEventListener('click', () => {
  const name=document.getElementById('new-site-name').value.trim();
  const domain=document.getElementById('new-site-domain').value.trim();
  const cookieName=document.getElementById('new-site-cookie').value.trim();
  if(!name||!domain||!cookieName) { showToast('Điền đầy đủ thông tin site','warning'); return; }
  const id=name.toLowerCase().replace(/\s+/g,'_');
  tempSocialSites.push({id,name,domain,cookieName});
  document.getElementById('new-site-name').value='';
  document.getElementById('new-site-domain').value='';
  document.getElementById('new-site-cookie').value='';
  renderSitesList();
});
document.getElementById('modal-manage-sites').addEventListener('click', e => { if(e.target===e.currentTarget) document.getElementById('modal-manage-sites').classList.add('hidden'); });

// ── Init ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  [allGroups, allGroupSubs, socialSitesConfig] = await Promise.all([
    window.app.getGroups(),
    window.app.getGroupSubs(),
    window.app.getSocialSites(),
  ]);
  renderSidebar();
  scanProfiles();
});
