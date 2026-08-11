# CHROME MANAGER BY UP MEDIA — Tài liệu kỹ thuật toàn diện

> Tài liệu này dành cho các phiên Claude Code / dev mới để hiểu toàn bộ lịch sử, kiến trúc, vấn đề đã giải quyết và định hướng phát triển của phần mềm này.
> Cập nhật lần cuối: **v1.8.54** (phiên nâng cấp UI/UX + Admin + phím tắt).

---

## 0. TRẠNG THÁI CHUẨN — ĐỌC TRƯỚC (tính đến v1.8.54)

> Tài liệu này viết bồi đắp theo thời gian nên các mục cũ (1–12) mô tả bản gốc, các mục 13–14 mô tả cập nhật sau. Khi có mâu thuẫn, **Mục 0 + 13 + 14 là bản mới nhất và ĐÚNG**.

**Nguồn chân lý (đọc code, đừng chỉ tin doc):**
- **Danh sách IPC API đầy đủ & mới nhất → đọc `preload.js`** (đây là hợp đồng renderer↔main; Mục 11 chỉ còn là tổng quan nhóm, KHÔNG liệt kê đủ).
- **Lịch sử tính năng theo bản → `renderer/renderer.js` mảng `CHANGELOG`** và file `CHANGELOG.md`.
- **Bàn giao/định hướng → `HANDOFF_V2.md`**. Quy trình phát hành → `.claude/skills/ship-upmedia/SKILL.md`.
- **Nội dung cũ / tính năng đã gỡ → `HISTORY.md`** (đã tách khỏi tài liệu này).
- **Bản đang cài & nghiệm thu thật → `DEPLOY_STATUS.md`** (repo/Release mới nhất ≠ đã nghiệm thu).

**Những điểm đã THAY ĐỔI so với mô tả ở các mục cũ (đừng làm theo mục cũ):**
- **"Dọn tiện ích McAfee/IDM" (Mục 3.7) ĐÃ GỠ**, thay bằng Quản lý tiện ích tổng quát (xóa/nhân bản/bỏ chặn — Mục 13). `EXEMPT_NAMES` (Mục 8.1) **KHÔNG còn hiệu lực bắt buộc**.
- **Cài cookie extension qua Web Store: ĐÃ XONG** (Unlisted, ID `bkdigiggjmpomfoeafbbgpipjennbhen`). Không còn là "định hướng".
- **Chạy Admin, phím tắt, typeahead danh mục, chống mở trùng Chrome, icon header, menu "Chức năng"** → Mục 14.

**Điều KHÔNG đổi (constraint vẫn còn hiệu lực):** brand UP Media (Mục 5) · không xóa cookie/mật khẩu khi clear cache (8.2) · Chrome path cứng (8.3) · Windows-only · Chrome 130+ tắt CDP, 137+ chặn `--load-extension`.

**Kiểm thử:**
- **Có test đơn vị cho hàm logic thuần** (`test/*.test.js`, chạy `npm test` — dùng `node:test`, không cần thư viện ngoài): hiện phủ `sanitizeFileName`, `formatBytes`, migration của `configStore`. **Khi thêm/sửa hàm logic thuần, thêm test tương ứng.** CI chạy `npm test` trước khi build.
- **Phần phụ thuộc Windows** (Admin/UAC, cookie SQLite, registry policy, chống mở trùng qua `wmic`, mở Chrome) **chỉ verify được trên Windows + Chrome thật** — sau khi sửa hãy `node --check` các file JS đã đổi, rồi nhờ owner chạy bản build và cập nhật `DEPLOY_STATUS.md`.
- **Dependency:** đã có `package-lock.json`; CI dùng `npm ci` (build tái lập được). Đổi dependency thì commit kèm lockfile mới.

**⚠️ KẾT THÚC PHIÊN — BẮT BUỘC cập nhật tài liệu (cơ chế thủ công theo phiên, không tự động):** sau MỖI phiên có thay đổi, phải đồng bộ tài liệu để phiên sau đủ ngữ cảnh — changelog in-app (`renderer/renderer.js`) + `CHANGELOG.md`; `CLAUDE.md` Mục 0/13-14 (gỡ tính năng → đưa sang `HISTORY.md`); `README.md` (version); `HANDOFF_V2.md` / `DEPLOY_STATUS.md` khi cần. **Checklist đầy đủ: `.claude/skills/ship-upmedia/SKILL.md` Mục 4.** Chưa cập nhật đủ = phiên chưa xong.

---

## 1. TỔNG QUAN SẢN PHẨM

**Chrome Manager by UP Media** là một ứng dụng desktop Windows (Electron v28) dành cho đội ngũ UP Media Agency — công ty chuyên dịch vụ truyền thông thương hiệu.

**Mục đích cốt lõi:** Quản lý hàng chục đến hàng trăm Chrome profile trên cùng một máy Windows. Mỗi profile là một "tài khoản" riêng biệt — thường dùng cho seeding, quảng cáo (Ads/BM), hoặc khách hàng.

**Repository:** `github.com/tuyenthanh829/UP-Media`
**Thư mục app:** `chrome-shortcut-manager/`
**CI/CD:** GitHub Actions → Windows build → GitHub Release → Telegram notification

---

## 2. KIẾN TRÚC TỔNG THỂ

```
chrome-shortcut-manager/
├── main.js                    # Electron main process — tất cả IPC handlers
├── preload.js                 # contextBridge — expose API an toàn cho renderer
├── renderer/
│   ├── index.html             # Shell HTML + modal definitions
│   ├── renderer.js            # Toàn bộ UI logic (~1500 dòng)
│   └── styles.css             # Styling — UP Media brand system
├── src/
│   ├── chromeProfiles.js      # Scan Chrome profiles từ User Data
│   ├── configStore.js         # Lưu/đọc config.json (Electron userData)
│   ├── shortcuts.js           # Tạo/xóa .lnk shortcut + mở profile
│   ├── extensions.js          # Dọn McAfee/IDM khỏi profiles
│   ├── storage.js             # Tính/xóa cache Chrome
│   ├── history.js             # Đọc lịch sử duyệt web (SQLite)
│   ├── accounts.js            # Đọc Gmail accounts từ Preferences
│   ├── socialAccounts.js      # Kiểm tra đăng nhập mạng xã hội (SQLite cookies)
│   ├── cookieDecrypt.js       # Giải mã cookie AES-256-GCM (Chrome 80+)
│   ├── chromeCdp.js           # CDP client (WebSocket) — hiện không dùng được
│   └── utils.js               # sanitizeFileName
└── assets/
    └── icon.ico
```

### Luồng dữ liệu

```
[renderer.js] → window.app.xxx() → [preload.js contextBridge]
    → ipcRenderer.invoke('event') → [main.js ipcMain.handle]
    → [src/*.js modules] → filesystem / SQLite / PowerShell
```

**Bảo mật Electron:** `contextIsolation: true`, `nodeIntegration: false` — renderer không truy cập Node.js trực tiếp.

---

## 3. TÍNH NĂNG CHÍNH

### 3.1 Quét và hiển thị profile
- Tự động tìm `Chrome\User Data` qua nhiều đường dẫn (LOCALAPPDATA, ổ D/E/F, custom path)
- Đọc `Preferences` JSON để lấy tên, avatar, email Google
- Hiển thị grid card — mỗi card là một profile
- Config metadata (tên, nhóm, ghi chú) lưu trong `config.json` tại Electron userData path

### 3.2 Shortcut Desktop
- Tạo file `.lnk` trên Desktop trỏ đến `chrome.exe --profile-directory="Profile N"`
- Tên file được sanitize (loại bỏ ký tự đặc biệt Windows)
- Kiểm tra duplicate tên trước khi tạo

### 3.3 Nhóm & phân loại
- Nhóm mặc định: Seeding, Ads, BM, Khách hàng, Cá nhân, Khác
- Hỗ trợ sub-group (danh mục con trong nhóm)
- Sidebar lọc theo nhóm, sub-group, trạng thái đăng nhập social
- Đổi tên nhóm tự động cập nhật toàn bộ profiles

### 3.4 Mở Chrome
```js
// shortcuts.js — openProfile()
spawn(chromePath, [
  `--profile-directory=${profileDirectory}`,
  '--remote-debugging-port=9223',   // cố gắng bật debug (không dùng được trên Chrome 130+)
  '--remote-allow-origins=*',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${userDataPath}` // nếu không phải đường dẫn mặc định
], { detached: true, stdio: 'ignore' })
```
**Lưu ý:** `--remote-debugging-port` được giữ lại trong code nhưng KHÔNG có tác dụng trên Chrome 130+ consumer build (xem mục 7.2).

### 3.5 Kiểm tra đăng nhập mạng xã hội
Đây là tính năng phức tạp nhất — xem mục 6 và 7.

### 3.6 Tối ưu dung lượng (Cache)
- Tính tổng size: Cache, Code Cache, GPUCache, Service Worker, DawnCache, ShaderCache, WebStorage, blob_storage
- Xóa an toàn: chỉ nội dung thư mục, không xóa thư mục gốc
- Không xóa cookies, mật khẩu, bookmark, đăng nhập

### 3.7 Dọn tiện ích (Extensions) — ĐÃ GỠ BỎ
> Tính năng cũ "Dọn McAfee/IDM" (+ ngoại lệ `EXEMPT_NAMES`) đã được thay bằng **Quản lý tiện ích tổng quát** (Mục 13). Chi tiết bản cũ: xem `HISTORY.md`.

### 3.8 Lịch sử duyệt web
- Đọc `History` SQLite (copy tạm rồi đọc để tránh lock)
- 25 URL gần nhất, convert Chrome epoch (microseconds từ 1601-01-01)

### 3.9 Gmail accounts
- Đọc `account_info` từ `Preferences` JSON — không cần SQLite

### 3.10 CI/CD Pipeline
Push lên `main` → GitHub Actions (`windows-latest`) →
1. Bump patch version trong `package.json` + commit `[skip ci]`
2. `npm install` + `npx electron-builder --win`
3. Tạo GitHub Release với 2 file: Setup (NSIS installer) + Portable
4. Thông báo Telegram (bot token + chat ID trong GitHub Secrets)

---

## 4. LƯU TRỮ DỮ LIỆU

### config.json
Đường dẫn: `%APPDATA%\Chrome Manager by UP Media\config.json` (Electron userData)

```json
{
  "settings": {
    "chromeUserDataPath": "C:\\...\\User Data",
    "lastScanAt": "2026-06-21T..."
  },
  "groups": ["Seeding", "Ads", "BM", "Khách hàng", "Cá nhân", "Khác"],
  "groupSubs": {
    "Seeding": ["Facebook", "TikTok"],
    "Ads": ["Meta", "Google"]
  },
  "profiles": {
    "Profile 1": {
      "shortcutName": "T93 - FB Seeding 01",
      "groups": ["Seeding"],
      "subGroups": { "Seeding": ["Facebook"] },
      "notes": "Tài khoản chính seeding FB"
    }
  },
  "socialSites": [ /* custom override của DEFAULT_SOCIAL_SITES */ ]
}
```

### Chrome data đọc trực tiếp (read-only)
- `Profile N/Preferences` — tên, email, avatar index
- `Profile N/Network/Cookies` — SQLite, đọc cookie đăng nhập social
- `Profile N/History` — SQLite, lịch sử duyệt web
- `User Data/Local State` — AES master key (DPAPI-encrypted)
- `Profile N/Google Profile Picture.png` — ảnh avatar

---

## 5. HỆ THỐNG MÀU SẮC VÀ BRAND (UP Media)

**Quan trọng:** App phải tuân thủ brand guidelines của UP Media.

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--upm-green` | `#0E5A2A` | Primary action, header, card accent, sidebar active |
| `--upm-yellow` | `#FFE66D` | Accent, highlight, stat numbers |
| `--upm-cream` | `#F5F0E8` | Nền chính (có grain texture) |
| `--upm-grey` | `#C7C6B2` | Scrollbar, divider |

**Signature elements bắt buộc:**
- **Thanh caro** (checkerboard) ngay dưới header: CSS `repeating-conic-gradient(#0E5A2A 0% 25%, #FFFFFF 0% 50%)`, `background-size: 20px 20px`
- **Nền texture** `#F5F0E8` với SVG grain (`feTurbulence`)
- **Font Unbounded** (Google Fonts) cho tiêu đề, modal header, sidebar title
- **Font Be Vietnam Pro** cho body text
- **Pill buttons** (`border-radius: 999px`) — tuyệt đối không dùng bo vuông

**Logo rules:**
- Trong text: "UP Media" (có khoảng cách)
- Trong code/logo SVG: "upmedia" (viết thường liền)
- Không viết "UP MEDIA" / "UPmedia" / "Up media"

---

## 6. TÍNH NĂNG SOCIAL LOGIN DETECTION — CHI TIẾT KỸ THUẬT

### 6.1 Tổng quan

Phần mềm kiểm tra xem mỗi Chrome profile có đang đăng nhập vào các mạng xã hội không bằng cách đọc cookie database SQLite.

**File:** `src/socialAccounts.js` (~745 dòng) — file phức tạp nhất trong toàn bộ codebase.

### 6.2 Cấu hình sites (DEFAULT_SOCIAL_SITES)

```js
const DEFAULT_SOCIAL_SITES = [
  { id: 'facebook',  name: 'Facebook',   domains: ['facebook.com'],  cookieNames: ['c_user', 'xs'] },
  { id: 'instagram', name: 'Instagram',  domains: ['instagram.com'], cookieNames: ['sessionid', 'ds_user_id'] },
  { id: 'x',         name: 'X (Twitter)',domains: ['x.com','twitter.com'], cookieNames: ['auth_token','twid'] },
  { id: 'tiktok',    name: 'TikTok',     domains: ['tiktok.com'],    cookieNames: ['sessionid', 'sid_guard'] },
  { id: 'threads',   name: 'Threads',    domains: ['threads.net','instagram.com'], cookieNames: ['sessionid','ds_user_id'] },
  // ^^ Quan trọng: Threads dùng CÙNG cookie với Instagram (cùng Meta auth system)
  //    Cookie lưu dưới domain instagram.com, không phải threads.net
  { id: 'linkedin',  name: 'LinkedIn',   domains: ['linkedin.com'],  cookieNames: ['li_at', 'JSESSIONID'] },
  { id: 'chotot',    name: 'Chợ Tốt',   domains: ['chotot.com'],    cookieNames: ['access_token','acp_uid'] },
];
```

User có thể override trong Settings (lưu vào `config.json.socialSites`).

### 6.3 Đường dẫn cookie database

```
Profile N/Network/Cookies    ← Chrome 96+ (thư mục Network/)
Profile N/Cookies            ← Chrome cũ hơn (fallback)
```

### 6.4 Đọc SQLite với sql.js

Dùng **sql.js** (pure JS/WASM, không cần native bindings) để đọc file SQLite mà không cần cài thêm gì.

```js
const initSqlJs = require('sql.js');
const SQL = await initSqlJs({ locateFile: f => path.join(wasmDir, f) });
const buf = fs.readFileSync(cookieFile);  // đọc toàn bộ file vào RAM
const db = new SQL.Database(buf);
// Query bình thường với db.prepare(), stmt.step(), stmt.getAsObject()
```

**WASM path khác nhau giữa dev và packaged:**
```js
const wasmDir = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist')
  : path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist');
```
`package.json` cấu hình `asarUnpack: ["node_modules/sql.js/dist/**"]` để WASM không bị đóng gói trong asar.

### 6.5 Mã hóa cookie — 3 thế hệ

| Prefix | Chrome version | Cơ chế | Xử lý |
|---|---|---|---|
| (plain text) | < Chrome 80 | Không mã hóa | `row.value` đọc thẳng |
| `v10` / `v11` | Chrome 80–126 | AES-256-GCM, key DPAPI | `cookieDecrypt.decryptCookieValue()` |
| `v20` | Chrome 127+ | **App-Bound Encryption** | Không giải mã được — nhưng **sự tồn tại = đã đăng nhập** |

**App-Bound Encryption (v20) — điểm cốt lõi:**
Chrome 127 giới thiệu ABE — key mã hóa được bind vào Chrome binary, không thể trích xuất qua DPAPI thông thường nữa. Tuy nhiên, **chỉ cần cookie tồn tại và chưa hết hạn là đủ** để kết luận user đang đăng nhập.

```js
// isCookieValueValid() — src/socialAccounts.js
function isCookieValueValid(rawEncrypted, masterKey) {
  const buf = toBuffer(rawEncrypted);
  if (!buf || buf.length < 3) return false;
  const prefix = buf.slice(0, 3).toString('ascii');

  if (prefix === 'v20') return true;  // ← PHẢI check này TRƯỚC khi thử decrypt
  if (masterKey) {
    const decrypted = cookieDecrypt.decryptCookieValue(buf, masterKey);
    return decrypted !== null && decrypted.length > 0;
  }
  return prefix === 'v10' || prefix === 'v11';
}
```

### 6.6 Chrome file lock — vấn đề lớn nhất

**Triệu chứng:** Khi Chrome đang chạy, file `Network/Cookies` BỊ KHÓA.

**Chi tiết cơ chế lock của Chrome 149:**
- Chrome mở file với `FILE_SHARE_READ` (các process khác CÓ THỂ mở file)
- Nhưng Chrome đặt **byte-range lock** lên toàn bộ file
- Kết quả: `fs.openSync()` THÀNH CÔNG, nhưng `fs.readSync()` trả về 0 bytes

**Cách phát hiện lock:**
```js
let isLocked = false;
try {
  const statSz = fs.statSync(cookieFile).size;
  if (statSz > 0) {
    const fd = fs.openSync(cookieFile, 'r');
    try {
      const testBuf = Buffer.alloc(16);
      const n = fs.readSync(fd, testBuf, 0, 16, 0);
      if (n === 0) isLocked = true;  // file mở được nhưng đọc về 0 bytes = bị lock
    } finally { fs.closeSync(fd); }
  }
} catch { isLocked = true; }

if (isLocked) { result._chromeLocked = true; return result; }
```

**Giải pháp — Kill-Read-Reopen flow:**
```
1. taskkill /F /IM chrome.exe /T  (kill all Chrome processes)
2. Wait 800ms  (lock release ngay khi process chết)
3. Đọc SQLite cookie database  (không còn lock)
4. Reopen Chrome với cùng profile  (user ít bị gián đoạn nhất)
```

Được implement trong `main.js` handler `social-status-kill-reopen`.

### 6.7 Chrome 130+ — Remote Debugging bị tắt

**Thực tế quan trọng:** Chrome 130+ consumer build (không phải enterprise) đã **tắt hoàn toàn TCP remote debugging server**, kể cả khi truyền `--remote-debugging-port=9223`.

- Flag `--remote-debugging-port` vẫn được truyền vào Chrome (để tương thích tương lai)
- Nhưng Chrome 130+ consumer KHÔNG MỞ TCP port nào cả
- CDP (Chrome DevTools Protocol) qua WebSocket KHÔNG hoạt động
- `src/chromeCdp.js` vẫn tồn tại trong code nhưng luôn fail silently

**Hệ quả:** Không thể dùng CDP để đọc cookie "live" — phải dùng SQLite file read.

### 6.8 Luồng hoàn chỉnh của getSocialStatus()

```
1. Tìm cookie file (Network/Cookies → Cookies fallback)
2. Probe lock: openSync + readSync(16 bytes) → nếu n=0 → return {_chromeLocked: true}
3. Lấy Chrome master key: cookieDecrypt.getChromeMasterKey(userDataPath)
   (PowerShell + DPAPI, cache theo userDataPath)
4. Đọc file vào Buffer (readFileBypassed với fallback robocopy/PowerShell)
5. sql.js: mở database, tìm cookie table có host_key column
6. Với mỗi site: query cookies theo domain + cookie name
7. Với mỗi cookie row:
   - Kiểm tra expired (expires_utc so với now)
   - Check encrypted_value prefix:
     - v20 → valid (không cần decrypt)
     - v10/v11 + masterKey → thử decrypt → valid nếu thành công
     - plain value → valid
8. Trả về {[siteId]: {loggedIn: bool, cookieFound: bool}}
```

### 6.9 Debug diagnostic (Dò Cookie)

`debugSocialStatus()` chạy tương tự nhưng trả về thông tin chi tiết hơn cho từng cookie row:

```js
rows.push({
  name: row.name,
  host: row.host_key,
  hasPlainValue: bool,
  prefix: 'v10'|'v11'|'v20'|'',
  decryptOk: true|false|null,  // null = không có masterKey, không thử
  expired: bool,
  expires_utc: number,
})
```

**Bug đã fix (quan trọng):** Trong `siteDiag` builder, phải check `prefix === 'v20'` TRƯỚC khi gọi `decryptCookieValue()`. Nếu không, v20 cookie sẽ trả về `decryptOk = false` (decrypt fail) thay vì `decryptOk = true`.

---

## 7. VẤN ĐỀ ĐÃ GẶP VÀ GIẢI PHÁP — CHRONOLOGICAL

### 7.1 "Tables: (none) | No table with host_key found!"
**Nguyên nhân:** Code cứng tên bảng là `cookies` trong SQL query, nhưng SQLite có thể có tên bảng khác.
**Giải pháp:** PRAGMA table_info để discover tên table thực sự trước khi query.

### 7.2 EBUSY: resource busy or locked
**Nguyên nhân:** Dùng `fs.readFileSync()` trực tiếp — Chrome có FILE_SHARE_NONE trên một số version.
**Giải pháp:** Thêm `readFileBypassed()` với 3 fallback: fd-based read → robocopy /B → PowerShell .NET FileStream.

### 7.3 PowerShell $fs.Length = 0 / zero_len
**Nguyên nhân:** Chrome 149 dùng FILE_SHARE_READ (file mở được) nhưng byte-range lock (đọc về 0 bytes). Cả 3 fallback đều thất bại vì lock ở byte level, không phải file level.
**Giải pháp:** Thêm probe lock detection (`readSync(16 bytes)` → n=0 → locked). Chuyển sang Kill-Read-Reopen flow.

### 7.4 CDP port 9223 không bao giờ mở
**Nguyên nhân:** Chrome 130+ consumer build tắt TCP remote debugging server vĩnh viễn — không phải bug, là thiết kế có chủ ý của Google (bảo mật).
**Giải pháp:** Từ bỏ CDP, dựa hoàn toàn vào SQLite file read. Xóa "Mở Chrome Debug" button. Giữ `chromeCdp.js` nhưng không dùng trong main flow.

### 7.5 Threads hiển thị "Chưa đăng nhập" dù đã login
**Nguyên nhân:** Threads dùng cùng hệ thống auth với Instagram. Cookie `sessionid` và `ds_user_id` được lưu dưới domain `instagram.com`, không phải `threads.net`.
**Giải pháp:** `domains: ['threads.net', 'instagram.com']` cho Threads site config.

### 7.6 v20 cookies hiển thị "không hợp lệ" trong panel chính
**Nguyên nhân:** `isCookieValueValid()` cũ thử decrypt trước, v20 không decrypt được → trả về false.
**Giải pháp:** Check `prefix === 'v20'` TRƯỚC và return `true` ngay.

### 7.7 v20 cookies hiển thị "không hợp lệ" trong Dò Cookie diagnostic
**Nguyên nhân:** `siteDiag` builder trong `debugSocialStatus()` có bug riêng — vẫn gọi `decryptCookieValue()` trước khi check prefix, đặt `decryptOk = false`. Renderer check `decryptOk === null && prefix === 'v20'` nên không match.
**Giải pháp (fix cuối):**
```js
// src/socialAccounts.js — siteDiag builder
if (prefix === 'v20') {
  decryptOk = true;  // App-Bound Encryption — presence = valid
} else if (masterKey) {
  const val = cookieDecrypt.decryptCookieValue(buf, masterKey);
  decryptOk = val !== null && val.length > 0;
}
```

### 7.8 --user-data-dir không được truyền vào Chrome
**Nguyên nhân:** `openProfile()` ban đầu không nhận `userDataPath` parameter.
**Giải pháp:** Tất cả IPC handlers mở Chrome đều lấy `userDataPath` từ `configStore.getConfig().settings.chromeUserDataPath` và truyền vào `shortcuts.openProfile(dir, userDataPath)`.

### 7.9 Diagnostic output quá nhiều noise kỹ thuật
**Nguyên nhân:** Panel "Dò Cookie" hiển thị toàn bộ thông tin raw: CDP port, SQLite tables, PowerShell output, Network/ files listing — không cần thiết cho user bình thường.
**Giải pháp:** Thu gọn thành 1 dòng status bar ("Cookie DB: OK (N rows) | DPAPI: OK") + chỉ giữ per-site cookie chips.

---

## 8. CONSTRAINT BẮT BUỘC (KHÔNG ĐƯỢC VI PHẠM)

### 8.1 Extension exemption — ĐÃ BỎ (không còn hiệu lực)
> `EXEMPT_NAMES` không còn dùng, không cần bảo vệ khi nâng cấp. Chi tiết bản cũ: xem `HISTORY.md`.

### 8.2 Không xóa cookie/mật khẩu khi clear cache
Tính năng "Tối ưu dung lượng" chỉ xóa các thư mục cache kỹ thuật, KHÔNG được đụng đến Cookies, Login Data, Local Storage, IndexedDB.

### 8.3 Chrome path cứng
```js
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];
```
Chỉ tìm Chrome tại 2 đường dẫn chuẩn Windows — không support Chrome beta/canary/custom install.

---

## 9. GIẢI THÍCH CÁC FILE QUAN TRỌNG

### main.js (394 dòng)
Tất cả IPC handlers. Cấu trúc:
- `scan-profiles`: Scan + merge config data
- `save-profile-config`, `delete-chrome-profile`: CRUD profile metadata
- `kill-all-chrome`: `taskkill /F /IM chrome.exe /T`
- `create-shortcut`, `delete-shortcut`, `open-profile`, `open-profile-url`, `open-profiles-batch`
- `get-groups`, `save-groups`, `get-group-subs`, `save-group-subs`
- `create-chrome-profile`: Tìm next Profile N, mở Chrome để tạo
- `get-avatar-data-url`: Đọc PNG → base64 data URL
- `get-cache-size`, `get-all-cache-sizes`, `clear-cache`, `clear-all-cache`
- `remove-bad-extensions`: Dọn McAfee/IDM (trừ EXEMPT_NAMES)
- `get-profile-history`, `get-google-accounts`
- `get-social-status`, `get-social-status-batch`, `debug-social-status`
- `get-social-sites`, `save-social-sites`
- `social-status-kill-reopen`: Kill Chrome → đọc cookie → reopen
- `kill-and-open-debug`: Kill Chrome → mở với debug flags → poll port (luôn fail trên Chrome 130+)
- `get-version`, `rename-group-in-profiles`

### renderer.js (~1500 dòng)
Single-file frontend. Không dùng framework — vanilla JS thuần.
Các function chính:
- `scanProfiles()`, `renderProfiles()`, `renderCard(profile)` — core display
- `openSocialModal(profile)` — mở modal social, re-fetch mỗi lần mở
- `renderSocialList(data, profile)` — render kết quả social với lock UI
- `runCookieDiagnostic()` — debug panel Dò Cookie
- `openHistoryModal()`, `openGmailModal()` — modals phụ
- `openManageSitesModal()` — quản lý danh sách sites
- Sidebar filtering: nhóm, sub-group, social login status
- `updateStat()` — update header stats (Tổng, Có shortcut, Chưa có, Gmail, Social)

### socialAccounts.js (~745 dòng)
File phức tạp nhất. Có cả CDP flow (disabled) và SQLite flow (active).
Functions:
- `getSocialStatus(profilePath, sites)` — main function, trả về kết quả login
- `debugSocialStatus(profilePath, sites)` — extended diagnostic
- `isCookieValueValid(rawEncrypted, masterKey)` — check v20/v10/v11/plain
- `withDb(profilePath, callback)` — wrapper mở SQLite an toàn
- `readFileBypassed(filePath)` — đọc file với fallback (không cần nữa sau khi có lock detection)
- `getSocialStatusViaCdp()` — luôn trả về null trên Chrome 130+

---

## 10. ĐỊNH HƯỚNG PHÁT TRIỂN TƯƠNG LAI

### Tính năng có thể thêm
1. **Bulk open với delay** — mở nhiều profile với khoảng thời gian giãn cách (hiện có `open-profiles-batch` nhưng delay cứng 350ms)
2. **Profile backup/restore** — export/import config và có thể cả cookies
3. **Tìm kiếm nâng cao** — filter theo social login status cụ thể (đã login Facebook nhưng chưa TikTok)
4. **Thống kê** — báo cáo tổng hợp: bao nhiêu profile mỗi nhóm, social coverage
5. **Auto-refresh** — tự động scan lại sau khoảng thời gian
6. **Dark mode** — hiện chỉ có light mode với nền kem UP Media

### Cần chú ý khi upgrade
- Chrome liên tục thay đổi bảo mật cookie (v10 → v11 → v20 → v30?)
- Chrome 127+ dùng v20 ABE — nếu Chrome thêm v30 với cơ chế khác, cần update `isCookieValueValid()`
- Electron version: hiện v28 — có thể upgrade nhưng test kỹ `shell.writeShortcutLink()` và `app.getPath()`
- sql.js: pure JS nên ổn, nhưng watch out cho SQLite schema changes của Chrome
- CI chỉ trigger trên branch `main` — feature branches không build

### Không nên làm
- Thêm remote debugging qua TCP (Chrome 130+ không support)
- Đọc cookie trực tiếp khi Chrome đang chạy (byte-range lock sẽ fail)
- Thay màu `#0E5A2A` bằng màu xanh khác (brand rule tuyệt đối)
- Bỏ thanh caro (signature element của UP Media)

---

## 11. IPC API — NGUỒN CHÂN LÝ: `preload.js`

> ⚠️ Danh sách liệt kê tay ở đây từng bị lệch với code. **Để có danh sách API đầy đủ & chính xác, luôn đọc `preload.js`** (mỗi `window.app.xxx` = một `ipcRenderer.invoke('event')` khớp với `ipcMain.handle('event', …)` trong `main.js`). Dưới đây chỉ là bản đồ nhóm để định hướng:

- **Profile & shortcut:** `scanProfiles`, `saveProfileConfig`, `checkDuplicateName`, `deleteProfile`, `createShortcut`, `deleteShortcut`, `checkShortcutExists`, `createChromeProfile`, `getAvatarDataUrl`, `pickUserDataFolder`, `getSettings`, `getVersion`.
- **Mở Chrome & chống trùng:** `openProfile(dir, opts)`, `openProfileUrl`, `openProfilesBatch`, `getRunningProfiles`, `killAllChrome`.
- **Nhóm/danh mục:** `getGroups`/`saveGroups`, `getGroupSubs`/`saveGroupSubs`, `renameGroupInProfiles`.
- **Cache:** `getCacheSize`, `getAllCacheSizes`, `clearCache`, `clearAllCache`.
- **Tiện ích (policy):** `listProfileExtensions`, `countAllExtensions`, `deleteExtensionEverywhere`, `copyExtensionToAll`, `getExtPolicy`, `clearExtPolicyEntry`, `installExternalExtension`.
- **Cookie/Web Store:** `zipCookieExtension`, `exportCookieExtension`, `saveCookieStoreId`, `get/setCookieExportEnabled`, `exportFacebookCookies`.
- **Social/Gmail/History:** `getSocialStatus`, `getSocialStatusBatch`, `getSocialSites`/`saveSocialSites`, `getCookiesForDomain`, `debugSocialStatus`, `socialStatusKillReopen`, `getGoogleAccounts`, `getProfileHistory`.
- **Excel:** `exportData`, `importData`, `exportTemplate`.
- **Hệ thống:** `getAutoLaunch`/`setAutoLaunch`, `getAutoElevate`/`setAutoElevate`, `openExternal`.

> Đã gỡ: `removeBadExtensions` (theo tính năng "Dọn tiện ích" cũ) — không còn trong preload/main.

---

## 12. THÔNG TIN MÔI TRƯỜNG

- **Owner:** Tuyen Thanh, UP Media Agency (tuyenthanh829)
- **Email liên hệ:** tuyennt.upmedia@gmail.com
- **Platform target:** Windows 10/11 x64 ONLY
- **Electron:** v28
- **Node.js:** v24 (CI)
- **Build output:** NSIS installer + Portable .exe
- **GitHub Secrets cần có:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- **Chrome support:** Chrome 80+ (cookie decrypt), tested on Chrome 149
- **Không support:** macOS, Linux, Chrome beta/canary/enterprise (paths khác)

---

*Tài liệu này được tạo bởi Claude Sonnet để phục vụ các phiên Claude Code tương lai tiếp tục phát triển Chrome Manager by UP Media.*

---

## 13. CẬP NHẬT v1.8.26 → v1.8.42 (bổ sung sau bản gốc)

> Phần này bổ sung cho các mục 1–12 ở trên (đợt v1.8.26 → v1.8.42). Trạng thái mới nhất xem Mục 0 & 14.

### Module mới trong `src/`
- **`extensions.js`** (mở rộng): `listProfileExtensions(profilePath)` đọc `extensions.settings` từ **Secure Preferences** (KHÔNG phải Preferences) + gộp Preferences; giải mã tên `__MSG_` từ `_locales`. `removeExtensionIdsFromProfile()`, `removeQueueForIds()` (xóa hàng chờ registry + External Extensions). `applyExtensionPolicy(forcelist, blocklist, updateUrls)` ghi `ExtensionInstallForcelist`/`Blocklist` vào registry (HKLM+WOW6432Node+HKCU) + policy JSON managed, rồi **đọc lại registry để verify** → trả `{hkcuOk, hklmOk, idsWritten, allWritten}`. `updateUrls[id]` cho phép self-host (mặc định Web Store `clients2.google.com/service/update2/crx`).
- **`extHost.js`** (mới): localhost http server phục vụ `.crx` + `update.xml` (GET) và nhận cookie (POST `/cookies`); đóng gói thư mục tiện ích thành CRX bằng `chrome.exe --pack-extension` với khóa cố định (ID ổn định); `packAndHost()`, `writeTrigger()`, `rehostAll()`.

### configStore mở rộng
- `getExtPolicy()/saveExtPolicy()` → `{forcelist, blocklist, updateUrls}` (tích lũy, ghi đè toàn bộ mỗi lần).
- `getExternalExtensions()/saveExternalExtensions()` → `[{id, version, folder, name}]` (tiện ích tự host).
- `settings` thêm: `cookieExportEnabled`, `cookieExporterId`, `cookieStoreExtId` (sẽ dùng cho Web Store), lastScanAt...

### Tính năng UI mới
1. **Chế độ hiển thị:** nút chuyển **thẻ ⇄ hàng tinh gọn** (localStorage `upm_view_mode`). Hàng hiện: tên · phân loại · social · mail · **số tiện ích** · **lượt mở**. Bấm cả hàng = mở Chrome.
2. **Sắp xếp theo lượt mở:** localStorage `upm_open_counts`, `bumpOpenCount()` khi mở; `applyFilter()` sort giảm dần.
3. **Bộ lọc mới:** "Chưa có nhóm" (`type:'nogroup'`), "Chưa đặt tên" (`type:'login', loginType:'unnamed'`), `isUnnamed(p)`.
4. **Tìm kiếm chuẩn hóa:** `normalizeSearch()` bỏ dấu (NFD + đ→d), hoa/thường, ký tự đặc biệt. Click bộ lọc sidebar tự `clearSearchInput()`.
5. **Cache dung lượng:** KHÔNG auto-scan khi render (gây đơ 50 profile). Lưu localStorage `upm_cache_sizes`, mỗi thẻ có nút "Tính", modal "Tối ưu dung lượng" persist kết quả.
6. **Social Cache:** nút "Load Social Cache" (sidebar), tải thủ công, lưu thời gian localStorage `upm_social_cache_time`, tự làm mới >7 ngày. `backgroundScanSocial()` gọi `applyFilter()` để cập nhật cả 2 chế độ.
7. **Cài đặt (modal mới `#modal-settings`):** mở toàn màn hình (`mainWindow.maximize()`), khởi động cùng Windows (`app.setLoginItemSettings`), chọn profile mở mặc định (localStorage `upm_default_open_profile`), Xuất/Nhập Excel + file mẫu, Xuất extension cookie ra Desktop.
8. **Lịch sử phiên bản:** mảng `CHANGELOG` trong renderer.js; bấm số version ở header mở modal (cuộn được).
9. **Quản lý tiện ích (modal `#modal-extensions`):** liệt kê tiện ích/profile; mỗi tiện ích có "Nhân bản ra tất cả" (force-install Web Store) + "Xóa khỏi tất cả"; khối "Đang bị chặn" + nút "Bỏ chặn"; nút "Nhập tiện ích ngoài store (thư mục)".
10. **Xuất/Nhập Excel:** dùng thư viện `xlsx` (SheetJS, đã thêm vào dependencies + `build.files`). Cột: Thư mục / Tên profile / Nhóm / Danh mục con / Ghi chú. Import tạo `Profile N` mới + mở Chrome khởi tạo (giãn 600ms). `pick()` chấp nhận header có dấu/không dấu.
11. **Cookie Facebook:** extension độc lập `assets/fb-cookie-extension/` (manifest MV3 + popup.html + popup.js) — popup có textarea, nút Lấy / Copy / Đăng nhập bằng cookie (chrome.cookies.get/set), khử trùng lặp theo tên (ưu tiên `.facebook.com`). **ĐÃ lên Chrome Web Store (Unlisted), ID `bkdigiggjmpomfoeafbbgpipjennbhen`** — ép cài hàng loạt bằng ID qua handler `copy-extension-to-all` (Cài đặt → "Extension Cookie Facebook qua Web Store"). Vẫn có thể cài thủ công (load unpacked) khi cần dev/test.

### Đã GỠ BỎ
- Tính năng "Dọn tiện ích" (McAfee/IDM) — thay bằng "Xóa 1 tiện ích khỏi tất cả" tổng quát. `EXEMPT_NAMES` không còn được dùng trong luồng chính (constraint cũ ở mục 8.1 không còn hiệu lực bắt buộc).

### IPC handlers mới (main.js)
`list-profile-extensions`, `count-all-extensions`, `delete-extension-everywhere`, `copy-extension-to-all`, `get-ext-policy`, `clear-ext-policy-entry`, `install-external-extension`, `export-data`, `import-data`, `export-template`, `export-cookie-extension`, `get/set-cookie-export-enabled`, `export-facebook-cookies`, `get/set-auto-launch`.

### Constraint mới
- Chrome 137+ chặn `--load-extension`; Chrome 130+ tắt CDP. Force-install self-host localhost KHÔNG được Chrome chấp nhận ổn định → khuyến nghị dùng **Chrome Web Store Unlisted + ExtensionInstallForcelist**.

---

## 14. CẬP NHẬT v1.8.50 → v1.8.54 (phiên nâng cấp UI/UX + Admin + phím tắt)

> Version hiện tại: **v1.8.54+**. Bổ sung cho mục 13.

### 14.1 Tự chạy dưới quyền Administrator (khắc phục Unikey)
- `main.js`: `isElevated()` chạy `net session` (khác 0 = chưa nâng quyền); `ensureElevated()` relaunch qua PowerShell `Start-Process -FilePath <exe> -ArgumentList '--elevated' -Verb RunAs`. Bấm "No" ở UAC → chạy tiếp bản thường (không mất app). Chỉ áp dụng khi `app.isPackaged`, bỏ qua nếu có `--elevated` hoặc `settings.autoElevate === false`.
- Menu app thay bằng `setupAppMenu()` chỉ còn nhóm "Chỉnh sửa" (undo/redo/cut/copy/paste/selectAll) + `autoHideMenuBar:true` → giải phóng Ctrl+R/Ctrl+Q cho app mà vẫn giữ Copy/Dán.
- IPC: `get-auto-elevate` / `set-auto-elevate`. Toggle trong Cài đặt (`#setting-auto-elevate`). Đổi chế độ cần khởi động lại app.

### 14.2 Phím tắt (renderer.js — mảng `SHORTCUTS`)
Ctrl+F tìm kiếm · Ctrl+N thêm Chrome · Ctrl+O đổi kiểu hiển thị · Ctrl+G nhóm · Ctrl+T dung lượng · Ctrl+L load Social · Ctrl+Q Cài đặt · Ctrl+R quét lại · Ctrl+D xóa bộ lọc / đóng pop-up · Ctrl+~ bảng phím tắt · Esc đóng pop-up. Xử lý trong 1 listener `keydown`; `closeAllModals()` / `anyModalOpen()` / `toggleModalById()`. Ctrl+~ (có Shift) xử lý trước nhánh bail shift.

### 14.3 Icon header + popover
- 2 icon trên **header** (`.header-right > .header-tools`): "Phím tắt" (`#btn-shortcuts`) và "Tiện ích UP Media" (`#btn-upm-exts`). Style nền xanh `.header-icon-btn`, hover vàng. Rê chuột icon Phím tắt → popover `.header-icon-pop` (render từ `SHORTCUTS`).

### 14.4 Tiện ích UP Media trên Store
- Modal `#modal-upm-exts`, dữ liệu mảng `UPMEDIA_EXTENSIONS = [{name, desc, type, url}]` (renderer.js) — thêm tiện ích/tài liệu mới chỉ cần thêm 1 object. Mở link qua IPC `open-external` → `shell.openExternal` (chỉ chấp nhận `https://`). Tiện ích đầu: UP Media - Cookie Facebook (`bkdigiggjmpomfoeafbbgpipjennbhen`).

### 14.5 Typeahead danh mục (nhóm cha + con)
- Helper `addMenuTypeahead(menu, {placeholder, items, onCreate})`: chèn ô input lọc lên đầu menu, Enter/click chọn mục khớp, không khớp → nút "Tạo mới" gọi `onCreate`. Dùng ở `buildGroupTags()` (thẻ) và `buildNewProfileGroupsUI()` (pop-up thêm tài khoản), cho cả nhóm cha lẫn danh mục con. `onCreate` tự `saveGroups`/`saveGroupSubs` + gán vào profile + `renderSidebar()`.

### 14.6 Chống mở trùng Chrome
- `getRunningProfileDirs()` (main.js) parse `wmic process ... get CommandLine` → Set profile-directory đang mở. `open-profile` bỏ qua nếu đang chạy (trả `alreadyOpen:true`, trừ khi `opts.force`); `open-profiles-batch` bỏ qua + đếm `skipped`. IPC phụ `get-running-profiles`. Áp dụng cho mở đơn, mở hàng loạt, và mở profile mặc định lúc khởi động.

### 14.7 Thẻ & toolbar
- Bấm vùng trắng thẻ mở Chrome: `.card-clickable` + handler loại trừ `button, input, textarea, select, a, label, .group-dropdown, .groups-row, .account-badges, .card-actions, .card-form, .cache-info, .notes-section, .card-status`. Helper chung `openProfileFromUI(dir, card)`.
- Dropdown "Chức năng" (`#func-menu-wrap` / `.toolbar-menu`) gộp: Tạo tất cả shortcut, Tối ưu dung lượng, Đóng Chrome (giữ nguyên id nút để binding cũ chạy).
- Pop-up "Tạo tài khoản" thiết kế lại: `.modal-newprofile` (640px) + `.np-*` xếp dọc thoáng.
- Sidebar "Lọc nhóm" đồng bộ theo "Lọc đăng nhập": `.group-dot.gc-*` (chấm màu) + tên thường + count, cùng font. "Tất cả"/"Chưa có nhóm" có icon dẫn đầu.
- Thanh cuộn `.main` dày 12px.

### IPC handlers mới (main.js) — bổ sung
`get-running-profiles`, `get-auto-elevate`, `set-auto-elevate`, `open-external`.
