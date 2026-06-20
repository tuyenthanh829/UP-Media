# CONTEXT: Chrome Shortcut Manager — Tóm tắt dự án

*Dùng file này để tiếp tục phát triển trong session Claude Code mới.*

---

## 1. Bối cảnh dự án

Người dùng (Tuyen Thanh, UP Media) cần app Windows giúp quản lý nhiều Chrome Profile và tạo shortcut ra Desktop. Mục tiêu: bấm icon ngoài Desktop là mở đúng Chrome profile. Người dùng **không rành kỹ thuật**, không muốn gõ lệnh.

---

## 2. Thông tin máy thực tế của người dùng

| Thông số | Giá trị |
|---|---|
| Username Windows | `Lenovo` |
| Chrome exe | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| **Chrome User Data** | `D:\No Delete\Google\Chrome\User Data` ← **ổ D, không phải ổ C** |
| Python | `C:\Users\Lenovo\AppData\Local\Programs\Python\Python311\python.exe` |
| Desktop | `C:\Users\Lenovo\OneDrive\Desktop` ← nằm trong OneDrive |

> **Lưu ý quan trọng:** Chrome User Data nằm ở ổ D (không phải `%LOCALAPPDATA%` mặc định). App phải tự quét nhiều đường dẫn hoặc cho phép người dùng chọn thủ công.

---

## 3. Công nghệ sử dụng

- **Electron + HTML + CSS + JavaScript/Node.js**
- Build ra `.exe` bằng `electron-builder`
- Không dùng framework frontend (vanilla JS)

---

## 4. Repository

- **Repo:** `tuyenthanh829/UP-Media`
- **Branch làm việc:** `claude/loving-cray-5zvqhg`
- **Thư mục app:** `chrome-shortcut-manager/`

---

## 5. Cấu trúc thư mục đã tạo

```
chrome-shortcut-manager/
├─ package.json
├─ main.js              # Electron main process + tất cả IPC handlers
├─ preload.js           # Context bridge — expose window.app API
├─ renderer/
│  ├─ index.html        # Giao diện chính (tiếng Việt)
│  ├─ styles.css        # UI card, màu nhóm, toast, responsive
│  └─ renderer.js       # Logic UI: render card, filter, scan, tạo shortcut
├─ src/
│  ├─ chromeProfiles.js # Quét profile Chrome, đọc file Preferences
│  ├─ shortcuts.js      # Tạo/xóa .lnk, mở Chrome, tìm chrome.exe
│  ├─ configStore.js    # Đọc/ghi config.json
│  └─ utils.js          # sanitizeFileName, formatDateTime
└─ assets/
   └─ icon.ico
```

---

## 6. API nội bộ (window.app.*)

| Hàm | Mô tả |
|---|---|
| `scanProfiles()` | Quét profile, trả về `{ profiles, userDataPath }` |
| `saveProfileConfig(dir, data)` | Lưu `shortcutName` và `group` vào config |
| `createShortcut(dir, name)` | Tạo file `.lnk` ra Desktop |
| `deleteShortcut(name)` | Xóa file `.lnk` khỏi Desktop |
| `openProfile(dir)` | Mở Chrome với `--profile-directory` |
| `openDesktop()` | Mở thư mục Desktop |
| `checkShortcutExists(name)` | Kiểm tra shortcut đã tồn tại chưa |
| `pickUserDataFolder()` | Mở dialog chọn thư mục Chrome User Data thủ công |
| `getSettings()` | Đọc settings từ config |

---

## 7. Config lưu ở đâu

```
%APPDATA%\Chrome Shortcut Manager\config.json
```

Cấu trúc:
```json
{
  "profiles": {
    "Default": { "shortcutName": "Chrome Cá Nhân", "group": "Cá nhân" },
    "Profile 1": { "shortcutName": "Seeding 01", "group": "Seeding" }
  },
  "settings": {
    "chromeUserDataPath": "D:\\No Delete\\Google\\Chrome\\User Data",
    "lastScanAt": "2026-06-20T00:00:00.000Z"
  }
}
```

---

## 8. Logic quan trọng trong từng file

### `src/chromeProfiles.js`
- Hàm `findUserDataPath(customPath)` — thử lần lượt nhiều đường dẫn: `%LOCALAPPDATA%`, ổ D/E/F với các tên phổ biến, custom path đã lưu
- Hàm `scanProfiles(customPath)` — trả về `{ profiles[], userDataPath }`
- Đọc file `Preferences` trong mỗi profile để lấy tên thật (`profile.name`)
- Fallback về tên thư mục nếu không đọc được

### `src/shortcuts.js`
- Dùng `electron.shell.writeShortcutLink()` để tạo file `.lnk` (Windows only)
- Chrome path tìm theo thứ tự: `Program Files` → `Program Files (x86)`
- Args shortcut: `--profile-directory="Profile 1"`
- Icon lấy từ `chrome.exe` (iconIndex: 0)

### `src/configStore.js`
- Hàm: `init(path)`, `load()`, `save(config)`, `saveProfileConfig(dir, data)`, `saveSettings(settings)`, `getConfig()`
- Không crash nếu file config lỗi — fallback về object rỗng

### `main.js`
- IPC handlers: `scan-profiles`, `save-profile-config`, `create-shortcut`, `delete-shortcut`, `open-profile`, `open-desktop`, `check-shortcut-exists`, `pick-user-data-folder`, `get-settings`
- Khi scan: đọc `chromeUserDataPath` từ config để truyền vào `scanProfiles()`
- Sau khi tìm thấy path: gọi `configStore.saveSettings({ chromeUserDataPath })` để nhớ cho lần sau

### `renderer/renderer.js`
- Auto scan khi mở app (`DOMContentLoaded`)
- Hiển thị đường dẫn đang dùng sau khi scan thành công
- Khi scan lỗi: hiện nút **"Chọn thư mục Chrome thủ công"** gọi `pickUserDataFolder()`
- Filter: tìm kiếm theo tên + lọc theo nhóm
- Mỗi card: đổi tên (blur → save), đổi nhóm (change → save), mở, tạo shortcut, xóa shortcut

---

## 9. Nhóm profile mặc định

| Nhóm | Màu badge | Màu avatar |
|---|---|---|
| Seeding | xanh lá | gradient xanh lá |
| Ads | cam | gradient cam |
| BM | tím | gradient tím |
| Khách hàng | xanh dương | gradient xanh dương |
| Cá nhân | xám | gradient xám |
| Khác | xám nhạt | gradient xám nhạt |

---

## 10. Trạng thái hiện tại (tính đến lúc tạo file này)

- [x] MVP hoàn chỉnh: quét profile, hiển thị card, đổi tên, phân nhóm, tạo/xóa shortcut, mở profile, tìm kiếm, lọc nhóm, lưu config
- [x] Fix lỗi Chrome User Data ở ổ D: tự quét nhiều đường dẫn + nút chọn thủ công
- [x] UI tiếng Việt, card bo góc, màu theo nhóm, toast notification
- [ ] Dark mode (chưa làm — Mốc 3)
- [ ] Backup/restore config (chưa làm — Mốc 3)
- [ ] Đổi icon shortcut theo nhóm (chưa làm — Mốc 3)
- [ ] Build ra `.exe` (chưa test — cần chạy `npm run build:win`)

---

## 11. Lệnh chạy

```bash
# Cài thư viện (lần đầu)
npm install

# Chạy dev
npm start

# Build ra .exe
npm run build:win
```

---

## 12. Lỗi đã gặp và cách fix

| Lỗi | Nguyên nhân | Cách fix |
|---|---|---|
| "Không tìm thấy thư mục profile Chrome" | Chrome User Data ở `D:\No Delete\...` thay vì ổ C | Cập nhật `findUserDataPath()` quét nhiều đường dẫn + thêm nút chọn thủ công |
