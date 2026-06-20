# Chrome Shortcut Manager

App Windows giúp quản lý Chrome profile và tạo shortcut Desktop chỉ với vài nút bấm.

## Cách dùng cho người dùng cuối

```
Bước 1: Mở app Chrome Shortcut Manager
Bước 2: App tự quét profile → danh sách hiện ra
Bước 3: Đổi tên profile thành tên dễ nhớ (VD: Seeding 01, Ads TPL)
Bước 4: Bấm "Tạo shortcut" hoặc "Tạo tất cả shortcut"
Bước 5: Ra Desktop và bấm shortcut vừa tạo để mở đúng Chrome
```

Nếu có thêm profile mới:
```
Mở app → Bấm "Quét lại profile" → Đặt tên → Tạo shortcut
```

---

## Dành cho Developer

### Yêu cầu

- Node.js 18+
- npm

### Cài đặt

```bash
npm install
```

### Chạy dev

```bash
npm start
```

### Build ra .exe

```bash
npm run build:win
```

File output: `dist/Chrome Shortcut Manager Setup.exe`

---

### Cấu trúc thư mục

```
chrome-shortcut-manager/
├─ main.js          # Electron main process + IPC handlers
├─ preload.js       # Context bridge API
├─ renderer/
│  ├─ index.html    # Giao diện chính
│  ├─ styles.css    # Style
│  └─ renderer.js   # Logic UI
├─ src/
│  ├─ chromeProfiles.js   # Quét Chrome profile
│  ├─ shortcuts.js        # Tạo/xóa shortcut .lnk
│  ├─ configStore.js      # Lưu/đọc config JSON
│  └─ utils.js            # Helper functions
└─ assets/
   └─ icon.ico
```

### Config được lưu ở

```
%APPDATA%\Chrome Shortcut Manager\config.json
```

---

### Lưu ý kỹ thuật

- Dùng `electron.shell.writeShortcutLink` để tạo file `.lnk` (Windows only)
- Chrome path tự tìm ở `Program Files` và `Program Files (x86)`
- Chrome User Data mặc định: `%LOCALAPPDATA%\Google\Chrome\User Data`
- App đọc file `Preferences` trong mỗi profile để lấy tên thật của profile
