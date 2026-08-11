// ── State ─────────────────────────────────────────────────
let allProfiles = [];
let allGroups = [];
let allGroupSubs = {};       // { "Seeding": ["T1","T2"] }
let socialSitesConfig = [];
let profileSocialCache = {}; // { dir: { siteId: {loggedIn,name} } }
let currentFiltered = [];
let activeSidebarFilter = null; // { type, group?, sub?, loginType? }
let viewMode = localStorage.getItem('upm_view_mode') || 'grid'; // 'grid' | 'list'
let extCountCache = null; // { dir: số tiện ích } — tải khi vào chế độ hàng

// ── Changelog — lịch sử phiên bản (mới nhất lên đầu) ──────
const CHANGELOG = [
  { v: '1.8.52', items: [
    'Gõ tên để tìm/tạo nhanh nhóm & danh mục con (cả thẻ lẫn khi thêm tài khoản): khớp thì chọn ngay, không khớp thì bấm "Tạo mới" là tự lưu & đồng bộ',
    'Bấm vào vùng trắng của thẻ profile để mở Chrome (không cần bấm đúng nút "Mở")',
    'Khi quét lại / mở hàng loạt: bỏ qua các Chrome đang mở sẵn, không mở chồng cửa sổ trùng',
    'Esc hoặc Ctrl+D đóng mọi pop-up đang mở',
    'Thêm phím tắt: Ctrl+O (đổi kiểu hiển thị), Ctrl+G (quản lý nhóm), Ctrl+T (tối ưu dung lượng), Ctrl+L (load Social)',
    'Thêm nút "Phím tắt" hiển thị danh sách phím tắt',
    'Thanh cuộn danh sách Chrome dày hơn cho dễ kéo',
  ] },
  { v: '1.8.51', items: [
    'Tự chạy dưới quyền Administrator khi khởi động (khắc phục lỗi thỉnh thoảng không gõ được tiếng Việt/Unikey) — có thể tắt trong Cài đặt',
    'Thêm phím tắt: Ctrl+F (tìm kiếm), Ctrl+N (thêm Chrome), Ctrl+D (xóa mọi bộ lọc), Ctrl+Q (Cài đặt), Ctrl+R (quét lại)',
  ] },
  { v: '1.8.45', items: [
    'Cài extension Cookie Facebook cho tất cả Chrome bằng Web Store ID (ép cài, không cần Developer Mode)',
  ] },
  { v: '1.8.42', items: [
    'Extension cookie: thêm ô textarea xem/sửa cookie, nút Lấy / Copy / Đăng nhập bằng cookie (nhập), khử trùng lặp cho chuỗi cookie chuẩn',
  ] },
  { v: '1.8.41', items: [
    'Lấy cookie Facebook nay dùng extension độc lập: Cài đặt → "Xuất extension ra Desktop" → tự cài (load unpacked) → bấm icon để Copy cookie',
    'Sửa modal Cài đặt bị che nút phía dưới (thêm thanh cuộn)',
  ] },
  { v: '1.8.40', items: [
    'Thêm nút "Tải file mẫu" Excel để điền thông tin nhập profile hàng loạt',
  ] },
  { v: '1.8.39', items: [
    'Xuất cookie Facebook: bật trong Cài đặt (opt-in) → nút "🍪 Copy cookie" trong bảng Mạng xã hội, copy cookie (kể cả httpOnly) dạng JSON',
  ] },
  { v: '1.8.38', items: [
    'Nhập tiện ích NGOÀI STORE hàng loạt: chọn thư mục tiện ích → tự đóng gói CRX + ép cài lên tất cả Chrome (qua host nội bộ, không cần Developer Mode)',
  ] },
  { v: '1.8.37', items: [
    'Xuất / Nhập dữ liệu chuyển sang Excel (.xlsx) thay cho JSON — dễ sửa hàng loạt',
  ] },
  { v: '1.8.36', items: [
    'Bỏ chặn tiện ích đang bị phần mềm chặn (mục Tiện ích)',
    'Chế độ hàng tinh gọn: hiển thị số tiện ích đang cài của mỗi profile',
    'Xuất / Nhập dữ liệu: xuất cấu hình Chrome ra file, nhập file để tự tạo Chrome mới',
    'Đổi khẩu hiệu header thành "Mar Ket Tinh Gọn"',
  ] },
  { v: '1.8.35', items: [
    'Nhân bản tiện ích: tự kiểm chứng policy đã ghi vào registry + báo rõ phạm vi và cách nhận tiện ích',
  ] },
  { v: '1.8.34', items: [
    'Sửa lỗi danh sách tiện ích luôn trống — nay đọc đúng cả "Secure Preferences"',
  ] },
  { v: '1.8.33', items: [
    'Quản lý tiện ích: nút "Tiện ích" trên mỗi profile để xem danh sách tiện ích đang cài',
    'Nhân bản 1 tiện ích ra tất cả Chrome (qua chính sách ép cài)',
    'Xóa 1 tiện ích khỏi tất cả Chrome + chặn tự cài lại (kể cả hàng chờ)',
  ] },
  { v: '1.8.32', items: [
    'Bảng Lịch sử phiên bản có thanh cuộn khi dài',
    'Nút "Load Social Cache" nay cập nhật đúng cả chế độ thẻ lẫn hàng + báo profile bị khóa',
    'Thêm bộ lọc "Chưa có nhóm"',
    'Thêm sửa tên danh mục con trong Quản lý nhóm',
    'Chế độ hàng tinh gọn: bấm vào hàng là mở Chrome luôn',
  ] },
  { v: '1.8.31', items: [
    'Bỏ chức năng "Dọn tiện ích"',
    'Mặc định mở toàn màn hình khi khởi động',
    'Thêm Cài đặt: khởi động cùng Windows, chọn profile mở mặc định',
    'Sắp xếp profile theo số lần mở nhiều nhất',
    'Thêm chế độ hiển thị dạng hàng tinh gọn',
    'Thêm bộ lọc "Chưa đặt tên"',
    'Thêm màn hình Lịch sử phiên bản',
  ] },
  { v: '1.8.30', items: [
    'Sửa lỗi đơ: bỏ tự động quét cache dung lượng của từng thẻ khi mở app',
    'Thêm nút "Tính" cache riêng cho mỗi profile',
  ] },
  { v: '1.8.29', items: [
    'Tìm kiếm không phân biệt hoa/thường, dấu tiếng Việt, khoảng trắng, ký tự đặc biệt',
    'Tự xóa ô tìm kiếm khi bấm bộ lọc',
    'Social Cache chuyển sang tải thủ công + tự làm mới sau 7 ngày',
  ] },
  { v: '1.8.26', items: [
    'Nâng cấp toàn bộ giao diện theo nhận diện thương hiệu UP Media',
  ] },
  { v: '1.8.25', items: [
    'Sửa lỗi hiển thị cookie v20 (App-Bound Encryption) trong bảng chẩn đoán',
    'Thu gọn bảng "Dò cookie" cho dễ nhìn',
  ] },
  { v: '1.8.0', items: [
    'Kiểm tra đăng nhập mạng xã hội qua cookie (Facebook, Instagram, TikTok, X, Threads, LinkedIn, Chợ Tốt)',
    'Đọc tài khoản Gmail, lịch sử duyệt web của từng profile',
    'Tối ưu dung lượng cache Chrome an toàn',
  ] },
  { v: '1.0.0', items: [
    'Phiên bản đầu tiên: quét profile Chrome, tạo shortcut, phân nhóm, mở nhanh',
  ] },
];

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
function isUnnamed(p) {
  const n = p.shortcutName || '';
  return !n || n === p.profileDirectory || n === p.chromeProfileName;
}

function eh(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function ea(s) { return String(s||'').replace(/"/g,'&quot;'); }

// Normalize for search: remove diacritics, lowercase, collapse spaces/special chars
function normalizeSearch(s) {
  return String(s||'')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .replace(/đ/gi, 'd')             // Vietnamese đ not covered by NFD
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')      // replace special chars/spaces with space
    .replace(/\s+/g, ' ')
    .trim();
}

function clearSearchInput() {
  const el = document.getElementById('search-input');
  if (el) el.value = '';
}

// ── Per-profile cache-size store (persisted, no auto-scan) ─
const CACHE_SIZE_KEY = 'upm_cache_sizes';
let _cacheSizeStore = null;
function loadCacheSizeStore() {
  if (_cacheSizeStore) return _cacheSizeStore;
  try { _cacheSizeStore = JSON.parse(localStorage.getItem(CACHE_SIZE_KEY)) || {}; }
  catch { _cacheSizeStore = {}; }
  return _cacheSizeStore;
}
function getCacheSizeCache(dir) {
  const v = loadCacheSizeStore()[dir];
  return (v && typeof v.size === 'number') ? v.size : null;
}
function setCacheSizeCache(dir, size) {
  const store = loadCacheSizeStore();
  store[dir] = { size, at: Date.now() };
  localStorage.setItem(CACHE_SIZE_KEY, JSON.stringify(store));
}

// ── Open-count store (đếm số lần mở Chrome mỗi profile) ────
const OPEN_COUNT_KEY = 'upm_open_counts';
let _openCountStore = null;
function loadOpenCounts() {
  if (_openCountStore) return _openCountStore;
  try { _openCountStore = JSON.parse(localStorage.getItem(OPEN_COUNT_KEY)) || {}; }
  catch { _openCountStore = {}; }
  return _openCountStore;
}
function getOpenCount(dir) { return loadOpenCounts()[dir] || 0; }
function bumpOpenCount(dir, n = 1) {
  const store = loadOpenCounts();
  store[dir] = (store[dir] || 0) + n;
  localStorage.setItem(OPEN_COUNT_KEY, JSON.stringify(store));
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
  allEl.addEventListener('click', () => { activeSidebarFilter = null; clearSearchInput(); renderSidebar(); applyFilter(); });
  sg.appendChild(allEl);

  const noGroupCnt = allProfiles.filter(p => !(p.groups||[]).length).length;
  const noGroupActive = activeSidebarFilter?.type==='nogroup';
  const noGroupEl = document.createElement('div');
  noGroupEl.className = `sidebar-item${noGroupActive ? ' active' : ''}`;
  noGroupEl.innerHTML = `<span style="font-style:italic;color:var(--muted)">Chưa có nhóm</span><span class="sidebar-count">${noGroupCnt}</span>`;
  noGroupEl.addEventListener('click', () => { activeSidebarFilter = { type:'nogroup' }; clearSearchInput(); renderSidebar(); applyFilter(); });
  sg.appendChild(noGroupEl);

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
    gEl.addEventListener('click', () => { activeSidebarFilter = { type:'group', group:g }; clearSearchInput(); renderSidebar(); applyFilter(); });
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
          clearSearchInput(); renderSidebar(); applyFilter();
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
  gmailEl.addEventListener('click', () => { activeSidebarFilter={type:'login',loginType:'gmail'}; clearSearchInput(); renderSidebar(); applyFilter(); });
  sl.appendChild(gmailEl);

  const unnamedCnt = allProfiles.filter(isUnnamed).length;
  const unnamedActive = activeSidebarFilter?.type==='login' && activeSidebarFilter?.loginType==='unnamed';
  const unnamedEl = document.createElement('div');
  unnamedEl.className = `sidebar-item${unnamedActive ? ' active' : ''}`;
  unnamedEl.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
    <span>Chưa đặt tên</span><span class="sidebar-count">${unnamedCnt}</span>
  `;
  unnamedEl.addEventListener('click', () => { activeSidebarFilter={type:'login',loginType:'unnamed'}; clearSearchInput(); renderSidebar(); applyFilter(); });
  sl.appendChild(unnamedEl);

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
    clearSearchInput(); renderSidebar();
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
        clearSearchInput(); renderSidebar(); applyFilter();
      });
      siteSubWrap.appendChild(siteEl);
    });
    sl.appendChild(siteSubWrap);
  }
}

// ── Filter ────────────────────────────────────────────────
function applyFilter() {
  const rawQ = document.getElementById('search-input').value;
  const q = normalizeSearch(rawQ);
  const f = activeSidebarFilter;

  const filtered = allProfiles.filter(p => {
    let matchSidebar = true;
    if (f) {
      if (f.type === 'nogroup') {
        matchSidebar = !(p.groups||[]).length;
      } else if (f.type === 'group') {
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
      } else if (f.type === 'login' && f.loginType === 'unnamed') {
        matchSidebar = isUnnamed(p);
      }
    }

    const matchQ = !q || [
      p.profileDirectory, p.shortcutName, p.chromeProfileName,
      ...(p.groups||[]), p.email, p.notes,
      ...(p.googleAccounts||[]).map(a=>a.email),
      ...(p.googleAccounts||[]).map(a=>a.fullName),
    ].some(v => normalizeSearch(v).includes(q));

    return matchSidebar && matchQ;
  });

  // Sắp xếp mặc định theo số lần mở nhiều nhất, rồi theo thứ tự profile
  filtered.sort((a, b) => {
    const d = getOpenCount(b.profileDirectory) - getOpenCount(a.profileDirectory);
    if (d !== 0) return d;
    return (a.displayIndex || 0) - (b.displayIndex || 0);
  });

  renderProfiles(filtered);
}

// ── Social cache management ───────────────────────────────
const SOCIAL_CACHE_KEY = 'upm_social_cache_time';
const SOCIAL_CACHE_7D  = 7 * 24 * 60 * 60 * 1000;

function getSocialCacheTime() {
  const v = localStorage.getItem(SOCIAL_CACHE_KEY);
  return v ? parseInt(v, 10) : null;
}

function saveSocialCacheTime() {
  localStorage.setItem(SOCIAL_CACHE_KEY, Date.now().toString());
  updateSocialCacheUI();
}

function updateSocialCacheUI() {
  const ts = getSocialCacheTime();
  const info = document.getElementById('social-cache-info');
  if (info) info.textContent = ts ? `Lần cuối: ${fmtTime(ts)}` : 'Chưa load';
}

async function backgroundScanSocial() {
  if (!socialSitesConfig.length) return;
  const btn = document.getElementById('btn-load-social-cache');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang load...'; }
  const batch = allProfiles.map(p => ({ dir: p.profileDirectory, profilePath: p.profilePath }));
  try {
    const results = await window.app.getSocialStatusBatch(batch, socialSitesConfig);
    Object.assign(profileSocialCache, results);
    updateSocialBadgesAll();
    updateSocialStats();
    renderSidebar();
    applyFilter();          // Vẽ lại cả chế độ thẻ lẫn hàng để cập nhật cột Social
    saveSocialCacheTime();
    const locked = Object.values(results).filter(r => r && r._chromeLocked).length;
    if (locked) showToast(`Đã load Social Cache. ${locked} profile bị khóa do Chrome đang mở — đóng Chrome rồi load lại để chính xác.`, 'warning');
    else showToast('Đã load xong Social Cache của tất cả profile', 'success');
  } catch (err) {
    showToast('Lỗi khi load Social Cache: ' + (err.message||''), 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Load Social Cache'; }
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

// ── Mở profile từ UI (bump lượt mở + báo nếu đã mở sẵn) ────
async function openProfileFromUI(dir, card) {
  bumpOpenCount(dir);
  if (card) { const oc = card.querySelector('.row-opens'); if (oc) oc.textContent = getOpenCount(dir); }
  const res = await window.app.openProfile(dir);
  if (res.success) showToast(res.alreadyOpen ? 'Chrome profile này đang mở sẵn — không mở thêm cửa sổ mới.' : 'Đang mở Chrome profile...', res.alreadyOpen ? 'warning' : 'info');
  else showToast(res.error, 'error');
  return res;
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

// ── Typeahead cho danh mục (nhóm / danh mục con) ──────────
// Thêm 1 ô nhập text lên đầu menu: gõ để lọc mục khớp, Enter/click để chọn,
// nếu không khớp mục nào → hiện nút "Tạo mới" gọi onCreate.
function addMenuTypeahead(menu, { placeholder, items, onCreate }) {
  const box = document.createElement('div');
  box.className = 'menu-typeahead';
  box.addEventListener('click', e => e.stopPropagation());
  box.addEventListener('mousedown', e => e.stopPropagation());

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'menu-typeahead-input';
  input.placeholder = placeholder || 'Gõ để tìm hoặc tạo mới...';
  input.autocomplete = 'off';

  const createBtn = document.createElement('button');
  createBtn.type = 'button';
  createBtn.className = 'menu-typeahead-create';
  createBtn.style.display = 'none';

  box.appendChild(input);
  box.appendChild(createBtn);
  menu.insertBefore(box, menu.firstChild);

  function refresh() {
    const q = normalizeSearch(input.value);
    const raw = input.value.trim();
    let exact = false, anyVisible = false;
    items.forEach(it => {
      const nn = normalizeSearch(it.name);
      const match = !q || nn.includes(q);
      it.container.style.display = match ? '' : 'none';
      if (match) anyVisible = true;
      if (nn === q && q) exact = true;
    });
    if (raw && !exact) {
      createBtn.style.display = '';
      createBtn.textContent = `➕ Tạo mới "${raw}"`;
    } else {
      createBtn.style.display = 'none';
    }
    if (!anyVisible && !raw) items.forEach(it => it.container.style.display = '');
  }

  input.addEventListener('input', refresh);
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = input.value.trim();
      if (!raw) return;
      const hit = items.find(it => normalizeSearch(it.name) === normalizeSearch(raw));
      if (hit) hit.pick();
      else onCreate(raw);
    }
  });
  createBtn.addEventListener('click', e => {
    e.stopPropagation();
    const raw = input.value.trim();
    if (raw) onCreate(raw);
  });
  // Không tự focus ở đây (tránh chiếm focus của ô danh mục con khi rebuild);
  // focus được xử lý khi mở dropdown cha.
  return input;
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

  const menuItems = [];
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

    // Panel danh mục con — hiện khi nhóm đang được chọn (kể cả khi chưa có sub nào, để tạo sub mới)
    const subPanel = document.createElement('div');
    subPanel.style.cssText = `display:${selected ? 'block' : 'none'};padding:3px 8px 6px 28px;background:var(--bg);border-top:1px solid var(--border)`;

    function addSubCheckbox(sub) {
      const lbl = document.createElement('label');
      lbl.className = 'sub-check-lbl';
      lbl.style.cssText = 'display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;font-size:12px;user-select:none;font-weight:400;color:var(--text)';
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
        const tagsWrap = card.querySelector('.tags-wrap');
        if (tagsWrap) renderTagsInto(tagsWrap, profile, card);
        refreshAvatarInCard(card, profile);
      });
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(sub));
      // chèn trước ô typeahead của sub
      subPanel.insertBefore(lbl, subPanel.lastChild);
      return { container: lbl, name: sub, pick: () => cb.click() };
    }

    const subItems = subs.map(addSubCheckbox);

    // Typeahead cho danh mục con: gõ để lọc / tạo sub mới → đồng bộ vào phần mềm
    const subMenu = document.createElement('div');
    subPanel.appendChild(subMenu);
    addMenuTypeahead(subMenu, {
      placeholder: 'Danh mục con: gõ để tìm/tạo...',
      items: subItems,
      onCreate: async (subName) => {
        allGroupSubs[g] = Array.from(new Set([...(allGroupSubs[g] || []), subName]));
        await window.app.saveGroupSubs(allGroupSubs);
        if (!profile.groups.includes(g)) profile.groups = [...(profile.groups || []), g];
        const cur = (profile.subGroups || {})[g] || [];
        profile.subGroups = { ...(profile.subGroups || {}), [g]: Array.from(new Set([...cur, subName])) };
        await window.app.saveProfileConfig(profile.profileDirectory, { groups: profile.groups, subGroups: profile.subGroups });
        renderSidebar();
        buildGroupTags(profile, card);
        refreshAvatarInCard(card, profile);
        showToast(`Đã tạo & gán danh mục con "${subName}"`, 'success');
      },
    });

    const expandArrow = document.createElement('span');
    expandArrow.style.cssText = 'font-size:10px;opacity:.45;padding:0 2px;transition:transform .15s';
    expandArrow.textContent = selected ? '▾' : '▸';
    expandArrow.addEventListener('click', e => {
      e.stopPropagation();
      const show = subPanel.style.display === 'none';
      subPanel.style.display = show ? 'block' : 'none';
      expandArrow.textContent = show ? '▾' : '▸';
    });
    mainRow.appendChild(expandArrow);
    item.appendChild(mainRow);
    item.appendChild(subPanel);

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

    menuItems.push({ container: item, name: g, pick: () => mainRow.click() });
    menu.appendChild(item);
  });

  // Typeahead cho nhóm cha: gõ để lọc / tạo nhóm mới → đồng bộ vào phần mềm
  addMenuTypeahead(menu, {
    placeholder: 'Nhóm: gõ để tìm hoặc tạo mới...',
    items: menuItems,
    onCreate: async (name) => {
      if (!allGroups.includes(name)) { allGroups = [...allGroups, name]; await window.app.saveGroups(allGroups); }
      profile.groups = Array.from(new Set([...(profile.groups || []), name]));
      await window.app.saveProfileConfig(profile.profileDirectory, { groups: profile.groups, subGroups: profile.subGroups });
      menu.classList.remove('open');
      renderSidebar();
      buildGroupTags(profile, card);
      refreshAvatarInCard(card, profile);
      showToast(`Đã tạo & gán nhóm "${name}"`, 'success');
    },
  });

  addBtn.addEventListener('click', e => {
    e.stopPropagation();
    const willOpen = !menu.classList.contains('open');
    menu.classList.toggle('open');
    // Bump card z-index so dropdown appears above sibling cards
    const parentCard = card;
    if (willOpen) {
      parentCard.classList.add('dropdown-open');
      const ta = menu.querySelector('.menu-typeahead-input');
      if (ta) setTimeout(() => { try { ta.focus(); } catch {} }, 20);
    }
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
      Cache: <span class="cache-size"></span>
      <button class="btn btn-ghost btn-xs btn-calc-cache" data-profile-path="${ea(profile.profilePath)}" title="Tính dung lượng cache">Tính</button>
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
      <button class="btn btn-outline btn-sm btn-extensions" data-dir="${ea(profile.profileDirectory)}" data-path="${ea(profile.profilePath)}" title="Xem & quản lý tiện ích">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/></svg>
        Tiện ích
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
  const renderCacheSize = (size) => {
    cacheSpan.textContent = fmtBytes(size);
    cacheSpan.classList.remove('loading');
    cacheSpan.style.color = size > 100 * 1024 * 1024 ? 'var(--danger)' : '';
  };
  // Show last-known cached value instead of auto-scanning (avoids 50x disk scan on render)
  const cached = getCacheSizeCache(profile.profileDirectory);
  if (cached != null) renderCacheSize(cached);
  else { cacheSpan.textContent = 'chưa tính'; cacheSpan.style.color = 'var(--muted)'; }

  card.querySelector('.btn-calc-cache').addEventListener('click', async e => {
    const pp = e.currentTarget.dataset.profilePath;
    e.currentTarget.disabled = true;
    cacheSpan.textContent = 'đang tính...'; cacheSpan.classList.add('loading'); cacheSpan.style.color = '';
    const size = await window.app.getCacheSize(pp);
    setCacheSizeCache(profile.profileDirectory, size);
    renderCacheSize(size);
    e.currentTarget.disabled = false;
  });

  card.querySelector('.btn-clear-cache').addEventListener('click', async e => {
    const pp = e.currentTarget.dataset.profilePath;
    e.currentTarget.disabled = true;
    const res = await window.app.clearCache(pp);
    if (res.success) { setCacheSizeCache(profile.profileDirectory, 0); cacheSpan.textContent='0 B'; cacheSpan.style.color=''; showToast(`Đã xóa ${res.freedText} cache`,'success'); }
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
    e.stopPropagation();
    openProfileFromUI(e.currentTarget.dataset.dir, card);
  });

  card.querySelector('.btn-history').addEventListener('click', async e => {
    const dir = e.currentTarget.dataset.dir;
    const pPath = e.currentTarget.dataset.path;
    const p = allProfiles.find(x=>x.profileDirectory===dir);
    openHistoryModal(p, pPath);
  });

  card.querySelector('.btn-extensions').addEventListener('click', async e => {
    const dir = e.currentTarget.dataset.dir;
    const pPath = e.currentTarget.dataset.path;
    const p = allProfiles.find(x=>x.profileDirectory===dir);
    openExtensionsModal(p, pPath);
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

  // Bấm vào vùng trắng của thẻ (không phải nút/ô nhập/nhóm) để mở Chrome
  card.classList.add('card-clickable');
  card.addEventListener('click', e => {
    if (e.target.closest('button, input, textarea, select, a, label, kbd, .group-dropdown, .groups-row, .account-badges, .card-actions, .card-form, .cache-info, .notes-section, .card-status')) return;
    openProfileFromUI(profile.profileDirectory, card);
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

  // Always re-fetch when opening the modal (chrome lock state may have changed)
  profileSocialCache[profile.profileDirectory] = await window.app.getSocialStatus(profilePath, socialSitesConfig);
  const sc = profileSocialCache[profile.profileDirectory];
  if (!sc._chromeLocked) {
    const cnt = Object.values(sc).filter(s => s.loggedIn).length;
    const card = document.querySelector(`[data-profile-dir="${ea(profile.profileDirectory)}"]`);
    if (card) {
      const sp = card.querySelector('.social-badge-count');
      if (sp) sp.textContent = cnt;
      const btn = card.querySelector('.badge-social');
      if (btn) btn.classList.toggle('empty', cnt === 0);
    }
    renderSidebar();
  }

  document.getElementById('social-loading').style.display = 'none';
  const list = document.getElementById('social-list');
  list.style.display = '';
  renderSocialList(profile, profilePath);
}

function renderSocialList(profile, profilePath) {
  const list = document.getElementById('social-list');
  const status = profileSocialCache[profile.profileDirectory];
  if (!status) return;

  // Chrome has the cookie file locked — offer kill-read-reopen
  if (status._chromeLocked) {
    const decryptBadge = document.getElementById('social-decrypt-badge');
    if (decryptBadge) decryptBadge.style.display = 'none';
    list.innerHTML = `
      <div style="padding:16px;text-align:center;color:var(--warning)">
        <div style="font-size:22px;margin-bottom:8px">🔒</div>
        <div style="font-weight:600;margin-bottom:6px">Chrome đang chạy và khóa file cookie</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:14px">Chrome 130+ không cho phép đọc cookie khi đang mở.<br>Bấm bên dưới để tạm đóng Chrome, đọc cookie rồi mở lại (khoảng 1–2 giây).</div>
        <button id="btn-kill-reopen-social" class="btn btn-primary btn-sm">🔄 Đóng Chrome, đọc cookie, mở lại</button>
      </div>
    `;
    document.getElementById('btn-kill-reopen-social').addEventListener('click', async () => {
      const btn = document.getElementById('btn-kill-reopen-social');
      btn.disabled = true;
      btn.textContent = '⏳ Đang xử lý...';
      const newStatus = await window.app.socialStatusKillReopen(profile.profileDirectory, profilePath, socialSitesConfig);
      profileSocialCache[profile.profileDirectory] = newStatus;
      // Update card badge
      const cnt = Object.values(newStatus).filter(s => s.loggedIn).length;
      const card = document.querySelector(`[data-profile-dir="${ea(profile.profileDirectory)}"]`);
      if (card) {
        const sp = card.querySelector('.social-badge-count');
        if (sp) sp.textContent = cnt;
        const b = card.querySelector('.badge-social');
        if (b) b.classList.toggle('empty', cnt === 0);
      }
      renderSidebar();
      renderSocialList(profile, profilePath);
    });
    return;
  }

  // Normal render
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

  const dbg = await window.app.debugSocialStatus(profilePath, socialSitesConfig);

  content.innerHTML = '';

  // Chrome is running and holding FILE_SHARE_NONE — diagnostic can't read the file
  if (dbg._chromeLocked) {
    const cached = profileSocialCache[profile.profileDirectory];
    const cachedHasResults = cached && !cached._chromeLocked && Object.values(cached).some(s => s && typeof s.loggedIn === 'boolean');
    content.innerHTML = `
      <div style="padding:12px;background:#1e293b;border-radius:6px;border:1px solid #334155;font-size:12px;color:#94a3b8">
        <div style="color:#fbbf24;font-weight:600;margin-bottom:6px">🔒 Chrome đang chạy — không đọc được cookie trực tiếp</div>
        <div style="margin-bottom:8px">Chrome 130+ dùng <b style="color:#e2e8f0">FILE_SHARE_NONE</b> để khóa file cookie. Kết quả "Dò cookie" chỉ hoạt động khi Chrome đóng.</div>
        ${cachedHasResults
          ? `<div style="color:#4ade80">✓ Kết quả social đang hiển thị ở trên là chính xác (đọc từ snapshot lúc Chrome đóng).</div>`
          : `<div style="color:#f87171">Bấm <b>"🔄 Đóng Chrome, đọc cookie, mở lại"</b> ở trên để lấy kết quả chính xác.</div>`
        }
        <div style="margin-top:8px;color:#64748b">stat size: <b style="color:#e2e8f0">${dbg.rawDiag?.statSize ?? '?'} bytes</b> (file tồn tại, chỉ bị khóa)</div>
      </div>
    `;
    return;
  }

  const fileOk = !!dbg.cookieFile;
  const dpOk = dbg.dpapiWorking;

  // Minimal status bar — just DB health and DPAPI
  if (dbg.rawDiag) {
    const rd = dbg.rawDiag;
    const statusBar = document.createElement('div');
    statusBar.style.cssText = 'font-size:11px;margin-bottom:8px;padding:5px 8px;background:var(--bg);border-radius:6px;border:1px solid var(--border);color:var(--muted)';
    const parts = [];
    if (rd.sqliteMagic) {
      parts.push(`📂 Cookie DB: <b style="color:var(--success)">OK</b> <span style="color:var(--muted)">(${rd.cookieCount ?? '?'} rows)</span>`);
    } else if (rd.error) {
      parts.push(`📂 Cookie DB: <b style="color:var(--danger)">Lỗi đọc file</b>`);
    } else {
      parts.push(`📂 Cookie DB: <b style="color:var(--warning)">Không đọc được</b>`);
    }
    parts.push(`🔐 DPAPI: <b style="color:${dpOk ? 'var(--success)' : 'var(--muted)'}">${dpOk ? 'OK' : 'Không dùng'}</b>`);
    statusBar.innerHTML = parts.join('&nbsp;&nbsp;|&nbsp;&nbsp;');
    content.appendChild(statusBar);
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

// ── Extensions modal ──────────────────────────────────────
const KNOWN_EXT_NAMES = {
  fheoggkfdfchfphceeifdbepaooicaho: 'McAfee WebAdvisor',
  ngpampappnmepgilojfohadhhmbhlaek: 'IDM Integration Module',
  aioifelanmcjnlailbmjfmgclhepmjbo: 'IDM CC',
  hdokiejnpimakedhajhdlcegeplioahd: 'McAfee (biến thể)',
  lifbcibllhkdhoafpjfnlhfpfgnpldfl: 'IDM (biến thể)',
};

// Hiển thị danh sách tiện ích đang bị chặn + nút bỏ chặn
async function renderBlockedExtensions() {
  const wrap = document.getElementById('ext-blocked-wrap');
  const ul = document.getElementById('ext-blocked');
  const pol = await window.app.getExtPolicy();
  const blocked = pol.blocklist || [];
  if (!blocked.length) { wrap.style.display = 'none'; ul.innerHTML = ''; return; }
  wrap.style.display = '';
  ul.innerHTML = '';
  blocked.forEach(id => {
    const li = document.createElement('li');
    li.className = 'ext-item';
    li.innerHTML = `
      <div class="ext-info">
        <div class="ext-name">${eh(KNOWN_EXT_NAMES[id] || 'Tiện ích')}</div>
        <div class="ext-meta"><span class="ext-id">${eh(id)}</span></div>
      </div>
      <div class="ext-actions">
        <button class="btn btn-success btn-xs btn-ext-unblock">Bỏ chặn</button>
      </div>`;
    li.querySelector('.btn-ext-unblock').addEventListener('click', async ev => {
      const btn = ev.currentTarget; btn.disabled = true; btn.textContent = 'Đang bỏ...';
      const r = await window.app.clearExtPolicyEntry(id);
      if (r.success) { showToast('Đã bỏ chặn tiện ích. Có thể cài lại bình thường.','success'); renderBlockedExtensions(); }
      else { btn.disabled=false; btn.textContent='Bỏ chặn'; showToast('Không bỏ chặn được','error'); }
    });
    ul.appendChild(li);
  });
}

let _extModalProfile = null;
async function openExtensionsModal(profile, profilePath) {
  _extModalProfile = { profile, profilePath };
  document.getElementById('ext-profile-name').textContent = profile.shortcutName||profile.chromeProfileName||profile.profileDirectory;
  document.getElementById('modal-extensions').classList.remove('hidden');
  document.getElementById('ext-loading').style.display = '';
  document.getElementById('ext-list').innerHTML = '';
  renderBlockedExtensions();

  const res = await window.app.listProfileExtensions(profilePath);
  document.getElementById('ext-loading').style.display = 'none';
  const list = document.getElementById('ext-list');

  if (!res.success) { list.innerHTML = `<li style="padding:16px;text-align:center;color:var(--muted)">${eh(res.error||'Lỗi đọc tiện ích')}</li>`; return; }
  if (!res.items.length) { list.innerHTML = '<li style="padding:16px;text-align:center;color:var(--muted)">Profile này chưa cài tiện ích nào</li>'; return; }

  res.items.forEach(ext => {
    const li = document.createElement('li');
    li.className = 'ext-item';
    li.innerHTML = `
      <div class="ext-info">
        <div class="ext-name">${eh(ext.name)} ${ext.enabled?'':'<span class="ext-off">(đang tắt)</span>'}</div>
        <div class="ext-meta">v${eh(ext.version)} · <span class="ext-id">${eh(ext.id)}</span>${ext.fromWebstore?'':' · <span class="ext-off">ngoài Web Store</span>'}</div>
      </div>
      <div class="ext-actions">
        <button class="btn btn-outline btn-xs btn-ext-copy" ${ext.fromWebstore?'':'disabled title="Chỉ nhân bản được tiện ích có trên Web Store"'}>Nhân bản ra tất cả</button>
        <button class="btn btn-danger btn-xs btn-ext-del">Xóa khỏi tất cả</button>
      </div>`;

    li.querySelector('.btn-ext-copy').addEventListener('click', async ev => {
      const btn = ev.currentTarget;
      btn.disabled = true; btn.textContent = 'Đang áp dụng...';
      const r = await window.app.copyExtensionToAll(ext.id);
      btn.textContent = 'Nhân bản ra tất cả'; btn.disabled = false;
      if (r.success) {
        const scope = r.hklmOk ? 'toàn máy' : 'người dùng hiện tại';
        showToast(`Đã ép cài "${ext.name}" (${scope}). ĐÓNG HẲN toàn bộ Chrome (kể cả ở khay đồng hồ) rồi mở lại để nhận. Máy cần có mạng.`,'success');
      } else showToast(r.error||'Không áp dụng được','error');
    });

    li.querySelector('.btn-ext-del').addEventListener('click', async ev => {
      if (!confirm(`Xóa tiện ích "${ext.name}" khỏi TẤT CẢ Chrome và chặn cài lại?\n\nApp sẽ đóng toàn bộ Chrome trước khi xóa.`)) return;
      const btn = ev.currentTarget;
      btn.disabled = true; btn.textContent = 'Đang xóa...';
      const r = await window.app.deleteExtensionEverywhere(ext.id);
      if (r.success) {
        showToast(`Đã xóa "${ext.name}" khỏi ${r.profilesAffected} profile + chặn tự cài lại`,'success');
        openExtensionsModal(profile, profilePath); // tải lại danh sách
      } else { btn.disabled=false; btn.textContent='Xóa khỏi tất cả'; showToast(r.error||'Không xóa được','error'); }
    });

    list.appendChild(li);
  });
}
function closeExtensionsModal() { document.getElementById('modal-extensions').classList.add('hidden'); }

// ── Render profiles ───────────────────────────────────────
async function renderProfiles(profiles) {
  currentFiltered = profiles;
  const grid = document.getElementById('profile-grid');
  grid.innerHTML = '';
  grid.className = viewMode === 'list' ? 'profile-list' : 'profile-grid';

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

  if (viewMode === 'list') {
    if (extCountCache === null) {
      try { extCountCache = await window.app.countAllExtensions(); } catch { extCountCache = {}; }
    }
    const header = document.createElement('div');
    header.className = 'profile-row row-head';
    header.innerHTML = `
      <span class="row-name">Tên profile</span>
      <span class="row-groups">Phân loại</span>
      <span class="row-social">Social</span>
      <span class="row-mail">Mail</span>
      <span class="row-ext" title="Số tiện ích đang cài">Tiện ích</span>
      <span class="row-opens" title="Số lần mở Chrome">Lượt mở</span>
      <span class="row-act"></span>`;
    grid.appendChild(header);
    for (const p of profiles) grid.appendChild(buildRow(p));
  } else {
    for (const p of profiles) grid.appendChild(await buildCard(p));
  }
}

// ── Compact row (chế độ hiển thị tinh gọn) ────────────────
function buildRow(profile) {
  const row = document.createElement('div');
  row.className = 'profile-row';
  row.dataset.profileDir = profile.profileDirectory;

  const name = profile.shortcutName || profile.chromeProfileName || profile.profileDirectory;
  const gmailCount = (profile.googleAccounts || []).length;
  const sc = profileSocialCache[profile.profileDirectory];
  const socialCount = sc ? Object.values(sc).filter(s=>s.loggedIn).length : null;
  const opens = getOpenCount(profile.profileDirectory);
  const extCount = extCountCache ? (extCountCache[profile.profileDirectory] ?? '–') : '–';

  const groupTags = (profile.groups || []).map(g =>
    `<span class="group-tag gc-${groupClass(g)}" style="padding:1px 7px;font-size:10px">${eh(g)}</span>`
  ).join('') || '<span style="color:var(--muted);font-size:11px">—</span>';

  const socialHtml = socialCount === null
    ? '<span class="row-chip muted" title="Chưa tải Social Cache">⏳</span>'
    : (socialCount > 0
        ? `<span class="row-chip on">🔗 ${socialCount}</span>`
        : '<span class="row-chip muted">0</span>');
  const mailHtml = gmailCount > 0
    ? `<span class="row-chip on">✉️ ${gmailCount}</span>`
    : '<span class="row-chip muted">0</span>';

  row.innerHTML = `
    <span class="row-name" title="${ea(name)}">
      ${isUnnamed(profile) ? '<span class="row-unnamed-dot" title="Chưa đặt tên"></span>' : ''}
      <strong>${eh(name)}</strong>
      <span class="row-dir">${eh(profile.profileDirectory)}</span>
    </span>
    <span class="row-groups">${groupTags}</span>
    <span class="row-social">${socialHtml}</span>
    <span class="row-mail">${mailHtml}</span>
    <span class="row-ext">${extCount === 0 ? '<span class="row-chip muted">0</span>' : `<span class="row-chip on">🧩 ${extCount}</span>`}</span>
    <span class="row-opens">${opens}</span>
    <span class="row-act"><span class="row-open-hint">▶ Mở Chrome</span></span>`;

  // Bấm vào bất kỳ đâu trên hàng để mở Chrome ngay
  row.classList.add('clickable');
  row.title = 'Bấm để mở Chrome profile này';
  row.addEventListener('click', () => openProfileFromUI(profile.profileDirectory, row));

  return row;
}

// ── Scan ──────────────────────────────────────────────────
async function scanProfiles() {
  showState('loading');
  try {
    const result = await window.app.scanProfiles();
    allProfiles = result.profiles;
    profileSocialCache = {};
    extCountCache = null;   // buộc tải lại số tiện ích sau khi quét
    updateStats(allProfiles); renderSidebar();
    showState('grid'); applyFilter();
    showToast(`Tìm thấy ${allProfiles.length} profile Chrome`,'success');
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
  dirs.forEach(d => bumpOpenCount(d));
  const res = await window.app.openProfilesBatch(dirs);
  btn.disabled=false;
  const parts = [`Đã mở ${res.ok} profile`];
  if (res.skipped) parts.push(`${res.skipped} đã mở sẵn (bỏ qua)`);
  if (res.fail) parts.push(`${res.fail} lỗi`);
  showToast(parts.join(', '), res.fail ? 'warning' : 'success');
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
  // Persist so profile cards can display these without re-scanning
  allProfiles.forEach(p => setCacheSizeCache(p.profileDirectory, sizes[p.profileDirectory]||0));
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
        s.innerHTML = `
          <span class="group-sub-name">• ${eh(sub)}</span>
          <input type="text" class="form-input group-sub-input" value="${ea(sub)}" maxlength="30" style="display:none;flex:1"/>
          <button class="btn btn-outline btn-xs btn-edit-sub">Sửa</button>
          <button class="btn btn-danger btn-xs btn-del-sub">Xóa</button>`;
        const nameEl = s.querySelector('.group-sub-name');
        const inputEl = s.querySelector('.group-sub-input');
        const editBtn = s.querySelector('.btn-edit-sub');
        editBtn.addEventListener('click', () => {
          const editing = inputEl.style.display !== 'none';
          if (!editing) {
            nameEl.style.display='none'; inputEl.style.display=''; editBtn.textContent='Lưu'; inputEl.focus();
          } else {
            const v = inputEl.value.trim();
            if (v && v !== sub) {
              if ((tempGroupSubs[g]||[]).includes(v)) { showToast('Danh mục con này đã tồn tại','warning'); return; }
              tempGroupSubs[g][si] = v;
              renameSubInProfiles(g, sub, v);
            }
            renderSubs();
          }
        });
        inputEl.addEventListener('keydown', e => { if(e.key==='Enter') editBtn.click(); });
        s.querySelector('.btn-del-sub').addEventListener('click', () => {
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

// Đổi tên danh mục con trong tất cả profiles thuộc nhóm `group`
async function renameSubInProfiles(group, oldSub, newSub) {
  for (const p of allProfiles) {
    const subs = (p.subGroups||{})[group];
    if (subs && subs.includes(oldSub)) {
      p.subGroups[group] = subs.map(x => x === oldSub ? newSub : x);
      await window.app.saveProfileConfig(p.profileDirectory, { subGroups: p.subGroups });
    }
  }
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

    // Danh mục con: checkbox chọn sẵn + ô typeahead để tìm/tạo sub mới
    const subWrap = document.createElement('div');
    subWrap.className = 'new-profile-sub-wrap';
    const subItems = [];
    function updateTagText() {
      tag.childNodes[0].textContent = (newProfileSubGroups[g] || []).length
        ? `${g} · ${newProfileSubGroups[g].join(' · ')} ` : `${g} `;
    }
    subs.forEach(sub => {
      const label = document.createElement('label');
      label.className = 'new-profile-sub-check';
      const checked = selectedSubs.includes(sub);
      label.innerHTML = `<input type="checkbox" value="${ea(sub)}" ${checked?'checked':''}/> ${eh(sub)}`;
      const cb = label.querySelector('input');
      cb.addEventListener('change', e => {
        if (!newProfileSubGroups[g]) newProfileSubGroups[g] = [];
        if (e.target.checked) newProfileSubGroups[g].push(sub);
        else newProfileSubGroups[g] = newProfileSubGroups[g].filter(x=>x!==sub);
        updateTagText();
      });
      subWrap.appendChild(label);
      subItems.push({ container: label, name: sub, pick: () => cb.click() });
    });
    const subMenu = document.createElement('div');
    subWrap.appendChild(subMenu);
    addMenuTypeahead(subMenu, {
      placeholder: 'Danh mục con: gõ để tìm/tạo...',
      items: subItems,
      onCreate: async (subName) => {
        allGroupSubs[g] = Array.from(new Set([...(allGroupSubs[g] || []), subName]));
        await window.app.saveGroupSubs(allGroupSubs);
        newProfileSubGroups[g] = Array.from(new Set([...(newProfileSubGroups[g] || []), subName]));
        renderSidebar();
        buildNewProfileGroupsUI();
      },
    });
    entry.appendChild(subWrap);

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
  menu.style.cssText = 'max-height:240px;overflow-y:auto';
  const menuItems = [];
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
    menuItems.push({ container: item, name: g, pick: () => item.click() });
    menu.appendChild(item);
  });
  addMenuTypeahead(menu, {
    placeholder: 'Nhóm: gõ để tìm hoặc tạo mới...',
    items: menuItems,
    onCreate: async (name) => {
      if (!allGroups.includes(name)) { allGroups = [...allGroups, name]; await window.app.saveGroups(allGroups); }
      if (!newProfileSelectedGroups.includes(name)) newProfileSelectedGroups.push(name);
      renderSidebar();
      buildNewProfileGroupsUI();
      showToast(`Đã tạo nhóm "${name}"`, 'success');
    },
  });
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const willOpen = !menu.classList.contains('open');
    menu.classList.toggle('open');
    if (willOpen) {
      const ta = menu.querySelector('.menu-typeahead-input');
      if (ta) setTimeout(() => { try { ta.focus(); } catch {} }, 20);
    }
  });
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
document.getElementById('btn-kill-chrome').addEventListener('click', killAllChrome);
document.getElementById('search-input').addEventListener('input', applyFilter);

// View toggle (grid / list)
function setViewMode(mode) {
  viewMode = mode;
  localStorage.setItem('upm_view_mode', mode);
  document.getElementById('btn-view-grid').classList.toggle('active', mode==='grid');
  document.getElementById('btn-view-list').classList.toggle('active', mode==='list');
  applyFilter();
}
document.getElementById('btn-view-grid').addEventListener('click', () => setViewMode('grid'));
document.getElementById('btn-view-list').addEventListener('click', () => setViewMode('list'));

// ── Phím tắt toàn cục ─────────────────────────────────────
function resetToInitialState() {
  activeSidebarFilter = null;
  clearSearchInput();
  renderSidebar();
  applyFilter();
}
function anyModalOpen() {
  return Array.from(document.querySelectorAll('.modal-overlay')).some(m => !m.classList.contains('hidden'));
}
function closeAllModals() {
  let closed = false;
  document.querySelectorAll('.modal-overlay').forEach(m => {
    if (!m.classList.contains('hidden')) { m.classList.add('hidden'); closed = true; }
  });
  return closed;
}
function toggleModalById(id, openFn) {
  const el = document.getElementById(id);
  if (!el.classList.contains('hidden')) el.classList.add('hidden'); else openFn();
}

// Danh sách phím tắt (dùng cho bảng "Phím tắt")
const SHORTCUTS = [
  { key: 'Ctrl + F', desc: 'Tìm kiếm Chrome theo tên' },
  { key: 'Ctrl + N', desc: 'Thêm tài khoản Chrome mới' },
  { key: 'Ctrl + O', desc: 'Chuyển hiển thị Thẻ ⇄ Hàng tinh gọn' },
  { key: 'Ctrl + G', desc: 'Quản lý nhóm' },
  { key: 'Ctrl + T', desc: 'Tối ưu dung lượng' },
  { key: 'Ctrl + L', desc: 'Load Social Cache' },
  { key: 'Ctrl + Q', desc: 'Mở / đóng Cài đặt' },
  { key: 'Ctrl + R', desc: 'Quét lại danh sách' },
  { key: 'Ctrl + D', desc: 'Xóa mọi bộ lọc / đóng mọi pop-up' },
  { key: 'Esc', desc: 'Đóng mọi pop-up đang hiển thị' },
];

document.addEventListener('keydown', e => {
  // Esc: đóng mọi pop-up đang mở
  if (e.key === 'Escape') {
    if (closeAllModals()) e.preventDefault();
    return;
  }
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
  const key = e.key.toLowerCase();
  switch (key) {
    case 'f': {
      e.preventDefault();
      const el = document.getElementById('search-input');
      el.focus(); el.select();
      break;
    }
    case 'n':
      e.preventDefault();
      openNewProfileModal();
      break;
    case 'd':
      e.preventDefault();
      // Có pop-up đang mở → đóng hết; nếu không → xóa mọi bộ lọc
      if (anyModalOpen()) closeAllModals();
      else { resetToInitialState(); showToast('Đã xóa mọi bộ lọc — về trạng thái ban đầu','info'); }
      break;
    case 'o':
      e.preventDefault();
      setViewMode(viewMode === 'list' ? 'grid' : 'list');
      break;
    case 'g':
      e.preventDefault();
      toggleModalById('modal-groups', openGroupModal);
      break;
    case 't':
      e.preventDefault();
      toggleModalById('modal-storage', openStorageModal);
      break;
    case 'l':
      e.preventDefault();
      backgroundScanSocial();
      break;
    case 'q':
      e.preventDefault();
      toggleModalById('modal-settings', openSettingsModal);
      break;
    case 'r':
      e.preventDefault();
      scanProfiles();
      break;
  }
});

// ── Bảng phím tắt ─────────────────────────────────────────
function openShortcutsModal() {
  const list = document.getElementById('shortcuts-list');
  if (list) list.innerHTML = SHORTCUTS.map(s =>
    `<li class="shortcut-row"><kbd>${eh(s.key)}</kbd><span>${eh(s.desc)}</span></li>`).join('');
  document.getElementById('modal-shortcuts').classList.remove('hidden');
}
function closeShortcutsModal() { document.getElementById('modal-shortcuts').classList.add('hidden'); }

// Settings modal
async function refreshCookieStoreStatus(settings) {
  const input = document.getElementById('setting-cookie-store-id');
  const status = document.getElementById('cookie-store-status');
  const removeBtn = document.getElementById('btn-remove-cookie-all');
  const id = String(settings?.cookieStoreExtId || '').trim();
  input.value = id;

  if (!id) {
    status.classList.add('hidden');
    removeBtn.classList.add('hidden');
    return;
  }

  const policy = await window.app.getExtPolicy();
  const active = (policy.forcelist || []).includes(id);
  status.textContent = active ? `Đang ép cài: ${id}` : `ID đã lưu (chưa ép cài): ${id}`;
  status.classList.remove('hidden');
  removeBtn.classList.toggle('hidden', !active);
}

function openSettingsModal() {
  const sel = document.getElementById('setting-default-profile');
  sel.innerHTML = '<option value="">— Không mở profile nào —</option>' +
    allProfiles.map(p => {
      const nm = p.shortcutName || p.chromeProfileName || p.profileDirectory;
      return `<option value="${ea(p.profileDirectory)}">${eh(nm)} (${eh(p.profileDirectory)})</option>`;
    }).join('');
  sel.value = localStorage.getItem('upm_default_open_profile') || '';
  window.app.getAutoLaunch().then(v => { document.getElementById('setting-auto-launch').checked = !!v; });
  window.app.getAutoElevate().then(v => { document.getElementById('setting-auto-elevate').checked = !!v; });
  window.app.getSettings().then(refreshCookieStoreStatus).catch(() => {});
  document.getElementById('modal-settings').classList.remove('hidden');
}
function closeSettingsModal() { document.getElementById('modal-settings').classList.add('hidden'); }
async function saveSettings() {
  const auto = document.getElementById('setting-auto-launch').checked;
  const elevate = document.getElementById('setting-auto-elevate').checked;
  const defProfile = document.getElementById('setting-default-profile').value;
  localStorage.setItem('upm_default_open_profile', defProfile);
  await window.app.setAutoLaunch(auto);
  const prevElevate = await window.app.getAutoElevate();
  await window.app.setAutoElevate(elevate);
  closeSettingsModal();
  if (elevate !== prevElevate)
    showToast('Đã lưu. Khởi động lại phần mềm để áp dụng chế độ quyền Administrator.','success');
  else
    showToast('Đã lưu cài đặt','success');
}
document.getElementById('btn-settings').addEventListener('click', openSettingsModal);
document.getElementById('modal-settings-close').addEventListener('click', closeSettingsModal);
document.getElementById('btn-close-settings').addEventListener('click', closeSettingsModal);
document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
document.getElementById('modal-settings').addEventListener('click', e => { if(e.target===e.currentTarget) closeSettingsModal(); });

// Xuất extension lấy cookie Facebook ra Desktop
document.getElementById('btn-export-cookie-ext').addEventListener('click', async () => {
  const r = await window.app.exportCookieExtension();
  if (r.success) showToast('Đã xuất extension ra Desktop (thư mục "UP Media - FB Cookie Extension"). Vào chrome://extensions → bật Chế độ nhà phát triển → Tải tiện ích đã giải nén → chọn thư mục đó.','success');
  else showToast(r.error||'Không xuất được extension','error');
});

document.getElementById('btn-zip-cookie-ext').addEventListener('click', async () => {
  const r = await window.app.zipCookieExtension();
  if (r.success) showToast('Đã tạo fb-cookie-extension.zip trên Desktop để upload lên Chrome Web Store.','success');
  else showToast(r.error || 'Không đóng gói được extension','error');
});

document.getElementById('btn-install-cookie-all').addEventListener('click', async () => {
  const input = document.getElementById('setting-cookie-store-id');
  const id = input.value.trim().toLowerCase();
  if (!/^[a-p]{32}$/.test(id)) {
    showToast('Extension ID phải gồm đúng 32 ký tự từ a đến p.','error');
    input.focus();
    return;
  }

  const btn = document.getElementById('btn-install-cookie-all');
  btn.disabled = true;
  const oldText = btn.textContent;
  btn.textContent = 'Đang ép cài...';
  try {
    const result = await window.app.copyExtensionToAll(id);
    if (!result.success || result.hkcuOk === false) {
      showToast(result.error || 'Không ghi được registry — chạy phần mềm bằng Run as administrator.','error');
      return;
    }
    const saved = await window.app.saveCookieStoreId(id);
    if (!saved.success) {
      showToast(saved.error || 'Policy đã ghi nhưng không lưu được Extension ID.','error');
      return;
    }
    await refreshCookieStoreStatus({ cookieStoreExtId: id });
    showToast('Đã ép cài cho tất cả Chrome (phạm vi: toàn máy/người dùng). ĐÓNG HẲN toàn bộ Chrome rồi mở lại để nhận.','success');
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
});

document.getElementById('btn-remove-cookie-all').addEventListener('click', async () => {
  const id = document.getElementById('setting-cookie-store-id').value.trim().toLowerCase();
  if (!/^[a-p]{32}$/.test(id)) {
    showToast('Extension ID không hợp lệ.','error');
    return;
  }
  const result = await window.app.clearExtPolicyEntry(id);
  if (!result.success) {
    showToast(result.error || 'Không gỡ được policy extension.','error');
    return;
  }
  await refreshCookieStoreStatus({ cookieStoreExtId: id });
  showToast('Đã gỡ policy cài Cookie Facebook. Đóng hẳn Chrome rồi mở lại để hoàn tất.','success');
});

document.getElementById('btn-template-data').addEventListener('click', async () => {
  const r = await window.app.exportTemplate();
  if (r.cancelled) return;
  if (r.success) showToast('Đã lưu file Excel mẫu. Điền theo các cột rồi bấm "Nhập Excel".','success');
  else showToast(r.error||'Không tạo được file mẫu','error');
});
document.getElementById('btn-export-data').addEventListener('click', async () => {
  const r = await window.app.exportData();
  if (r.cancelled) return;
  if (r.success) showToast(`Đã xuất ${r.count} profile ra Excel`,'success');
  else showToast(r.error||'Không xuất được','error');
});
document.getElementById('btn-import-data').addEventListener('click', async () => {
  if (!confirm('Nhập Excel sẽ TỰ TẠO các Chrome profile mới theo từng dòng.\nChrome sẽ lần lượt mở ra để khởi tạo từng profile. Tiếp tục?')) return;
  const btn = document.getElementById('btn-import-data');
  btn.disabled = true; btn.textContent = 'Đang nhập...';
  const r = await window.app.importData();
  btn.disabled = false; btn.textContent = '⬆ Nhập Excel';
  if (r.cancelled) return;
  if (r.success) {
    showToast(`Đã tạo ${r.created}/${r.total} Chrome mới${r.failed?`, lỗi ${r.failed}`:''}. Bấm "Quét lại" để cập nhật danh sách.`,'success');
    closeSettingsModal();
  } else showToast(r.error||'Không nhập được','error');
});

// Changelog modal
function openChangelogModal() {
  const list = document.getElementById('changelog-list');
  list.innerHTML = CHANGELOG.map(rel => `
    <li class="changelog-item">
      <div class="changelog-ver">v${eh(rel.v)}</div>
      <ul class="changelog-changes">${rel.items.map(i=>`<li>${eh(i)}</li>`).join('')}</ul>
    </li>`).join('');
  document.getElementById('modal-changelog').classList.remove('hidden');
}
function closeChangelogModal() { document.getElementById('modal-changelog').classList.add('hidden'); }
document.getElementById('app-version').addEventListener('click', openChangelogModal);
document.getElementById('modal-changelog-close').addEventListener('click', closeChangelogModal);
document.getElementById('btn-close-changelog').addEventListener('click', closeChangelogModal);
document.getElementById('modal-changelog').addEventListener('click', e => { if(e.target===e.currentTarget) closeChangelogModal(); });

document.getElementById('btn-shortcuts').addEventListener('click', openShortcutsModal);
document.getElementById('modal-shortcuts-close').addEventListener('click', closeShortcutsModal);
document.getElementById('btn-close-shortcuts').addEventListener('click', closeShortcutsModal);
document.getElementById('modal-shortcuts').addEventListener('click', e => { if(e.target===e.currentTarget) closeShortcutsModal(); });

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

document.getElementById('modal-extensions-close').addEventListener('click', closeExtensionsModal);
document.getElementById('btn-close-extensions').addEventListener('click', closeExtensionsModal);
document.getElementById('modal-extensions').addEventListener('click', e => { if(e.target===e.currentTarget) closeExtensionsModal(); });
document.getElementById('btn-install-ext-folder').addEventListener('click', async () => {
  const btn = document.getElementById('btn-install-ext-folder');
  btn.disabled = true; btn.textContent = 'Đang đóng gói...';
  const r = await window.app.installExternalExtension();
  btn.disabled = false; btn.textContent = '➕ Nhập tiện ích ngoài store (thư mục)';
  if (r.cancelled) return;
  if (r.success) showToast(`Đã ép cài tiện ích ngoài store (ID ${r.id.slice(0,8)}…). ĐÓNG HẲN toàn bộ Chrome rồi mở lại để nhận. Giữ phần mềm đang chạy.`,'success');
  else showToast(r.error||'Không nhập được tiện ích','error');
});

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
  const [groups, subs, sites, version] = await Promise.all([
    window.app.getGroups(),
    window.app.getGroupSubs(),
    window.app.getSocialSites(),
    window.app.getVersion(),
  ]);
  allGroups = groups; allGroupSubs = subs; socialSitesConfig = sites;
  const verEl = document.getElementById('app-version');
  if (verEl && version) verEl.textContent = `v${version}`;

  document.getElementById('btn-load-social-cache').addEventListener('click', backgroundScanSocial);
  updateSocialCacheUI();

  // Đồng bộ nút chuyển chế độ hiển thị với lựa chọn đã lưu
  document.getElementById('btn-view-grid').classList.toggle('active', viewMode==='grid');
  document.getElementById('btn-view-list').classList.toggle('active', viewMode==='list');

  renderSidebar();
  await scanProfiles();

  // Tự mở profile mặc định khi khởi động (nếu đã cấu hình)
  const defProfile = localStorage.getItem('upm_default_open_profile');
  if (defProfile && allProfiles.some(p => p.profileDirectory === defProfile)) {
    bumpOpenCount(defProfile);
    window.app.openProfile(defProfile).then(res => {
      if (res.success && !res.alreadyOpen) showToast('Đã tự mở profile mặc định','info');
    });
  }

  // Auto-load social cache every 7 days
  const lastTime = getSocialCacheTime();
  if (!lastTime || Date.now() - lastTime > SOCIAL_CACHE_7D) {
    backgroundScanSocial();
  }
});
