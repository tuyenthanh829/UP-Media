# Chrome Manager by UP Media

App desktop Windows (Electron) quản lý hàng chục–trăm Chrome profile trên 1 máy: tạo shortcut, phân nhóm, kiểm tra đăng nhập mạng xã hội, quản lý tiện ích, xuất/nhập cấu hình và nhiều hơn nữa.

> Phiên bản hiện tại: **v1.8.42+** — xem `CHANGELOG.md` để biết lịch sử đầy đủ.

## Tính năng chính

- **Quét & hiển thị profile:** đọc `Chrome\User Data`, hiện dạng thẻ hoặc **dạng hàng tinh gọn** (tên · phân loại · social · mail · số tiện ích · lượt mở).
- **Shortcut Desktop:** tạo/xóa `.lnk` theo từng profile hoặc tất cả.
- **Nhóm & danh mục con:** đa nhóm, sub-group, đổi tên nhóm & danh mục con, lọc theo nhóm / chưa có nhóm / chưa đặt tên.
- **Kiểm tra đăng nhập mạng xã hội:** đọc cookie SQLite (Facebook, Instagram, TikTok, X, Threads, LinkedIn, Chợ Tốt). Nút **Load Social Cache** tải thủ công + tự làm mới sau 7 ngày.
- **Quản lý tiện ích:** liệt kê tiện ích của profile; **xóa 1 tiện ích khỏi tất cả Chrome** (kể cả hàng chờ); **nhân bản/ép cài 1 tiện ích ra tất cả Chrome** qua policy; bỏ chặn tiện ích.
- **Nhập tiện ích ngoài store:** đóng gói thư mục thành CRX + ép cài (self-host localhost).
- **Cookie Facebook:** extension độc lập (`assets/fb-cookie-extension/`) — lấy/nhập cookie kể cả httpOnly (`xs`).
- **Tối ưu dung lượng:** tính & xóa cache an toàn (không đụng cookie/mật khẩu).
- **Xuất/Nhập Excel:** xuất cấu hình ra `.xlsx`, sửa rồi nhập để **tự tạo Chrome mới** theo từng dòng (có file mẫu).
- **Cài đặt:** mở toàn màn hình, khởi động cùng Windows, chọn profile mở mặc định, sắp xếp theo lượt mở.
- **Lịch sử phiên bản** ngay trong app (bấm số version ở header).

## Hệ thống màu (brand UP Media)

`--upm-green #0E5A2A` · `--upm-yellow #FFE66D` · `--upm-cream #F5F0E8`. Nút bo tròn (pill), thanh caro dưới header, font `Unbounded` (tiêu đề) + `Be Vietnam Pro` (body).

---

## Dành cho Developer

### Cài đặt & chạy
```bash
npm install
npm start           # chạy dev
npm run build:win   # build .exe (NSIS + Portable) → dist/
```

### CI/CD
Push lên nhánh `main` → GitHub Actions (windows-latest) tự bump version, build `.exe`, tạo Release, gửi Telegram. Secrets cần: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

### Cấu trúc thư mục
```
chrome-shortcut-manager/
├─ main.js              # Electron main + tất cả IPC handlers
├─ preload.js           # contextBridge → window.app.*
├─ renderer/            # index.html · styles.css · renderer.js (UI vanilla JS)
├─ src/
│  ├─ chromeProfiles.js # Quét profile
│  ├─ shortcuts.js      # Tạo/xóa .lnk, mở Chrome, findChrome
│  ├─ configStore.js    # config.json (profiles, groups, extPolicy, externalExts, settings)
│  ├─ extensions.js     # Liệt kê/xóa tiện ích, applyExtensionPolicy (force/block)
│  ├─ extHost.js        # Localhost host CRX + /cookies + đóng gói CRX
│  ├─ storage.js        # Cache size / clear
│  ├─ history.js        # Lịch sử duyệt (SQLite)
│  ├─ accounts.js       # Gmail accounts (Preferences)
│  ├─ socialAccounts.js # Kiểm tra đăng nhập social (SQLite cookies)
│  ├─ cookieDecrypt.js  # Giải mã cookie AES/DPAPI
│  └─ utils.js
└─ assets/
   ├─ icon.ico
   ├─ cookie-exporter/      # Extension nội bộ (force-install localhost — thử nghiệm)
   └─ fb-cookie-extension/  # Extension độc lập lấy/nhập cookie FB (khuyến nghị)
```

### Config
`%APPDATA%\Chrome Manager by UP Media\config.json` — chứa `profiles`, `groups`, `groupSubs`, `socialSites`, `extPolicy` (forcelist/blocklist/updateUrls), `externalExts`, `settings`.

### Lưu ý kỹ thuật
- Windows only. Chrome tìm ở `Program Files` / `Program Files (x86)`.
- Chrome 130+ tắt CDP; Chrome 137+ chặn `--load-extension` — không dùng.
- Cookie v20 (App-Bound, Chrome 127+) không giải mã offline được; sự tồn tại = đã đăng nhập.
- Extension `extensions.settings` nằm trong **Secure Preferences** (không phải Preferences).
- Force-install tiện ích: ghi `ExtensionInstallForcelist`/`Blocklist` vào registry HKLM+HKCU + policy JSON.
