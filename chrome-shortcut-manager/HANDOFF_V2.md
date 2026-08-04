# BÀN GIAO SANG PHIÊN VER 2 — Chrome Manager by UP Media

> Đọc file này + `CLAUDE.md` (đặc biệt Mục 13) + `CHANGELOG.md` là nắm được toàn bộ trạng thái.
> **LUÔN đọc nhánh `main` mới nhất**, KHÔNG dùng link pin theo commit hash cũ.
> Version tại thời điểm bàn giao: **v1.8.48**.

## 1. TRẠNG THÁI HIỆN TẠI (đã làm xong & đã build)
- Giao diện brand UP Media; 2 chế độ hiển thị (thẻ / hàng tinh gọn); tìm kiếm chuẩn hóa; bộ lọc "Chưa có nhóm" / "Chưa đặt tên"; sắp xếp theo lượt mở.
- Cài đặt: mở toàn màn hình, khởi động cùng Windows, profile mở mặc định, Lịch sử phiên bản.
- Cache dung lượng: không auto-scan (tránh đơ), nút "Tính" từng thẻ.
- Social login detection + Load Social Cache (thủ công + tự làm mới 7 ngày).
- Quản lý tiện ích: liệt kê / nhân bản ra tất cả / xóa khỏi tất cả / bỏ chặn; nhập tiện ích ngoài store (self-host CRX).
- Xuất/Nhập Excel (.xlsx) + file mẫu; tự tạo Chrome mới theo từng dòng.
- Cookie Facebook: extension độc lập `assets/fb-cookie-extension/` (lấy/copy/nhập cookie, có icon) + **Codex đã thêm force-install qua Web Store** (commit `b283131`).

## 2. HẠNG MỤC CẦN KIỂM THỬ TRÊN MÁY THẬT (chưa verify được ở môi trường AI — Windows/Chrome/registry)
Các tính năng sau đã viết code nhưng CHƯA test trên Chrome 149 thật, cần chạy thử + báo lỗi:
- [ ] **Nhập tiện ích ngoài store** (đóng gói CRX + force-install localhost) — kiểm tra `chrome://extensions` có extension nhãn "Installed by enterprise policy".
- [ ] **Force-install cookie extension qua Web Store** (Codex làm) — cần **up extension lên Chrome Web Store dạng Unlisted (5$)** để lấy **Extension ID**, rồi nhập ID vào app. Xem mục 4.
- [ ] **Cookie export nội bộ (localhost)** — luồng cũ; hiện khuyến nghị dùng extension độc lập thay thế.
- Lưu ý: nếu policy không ghi được → chạy app bằng **Run as administrator** (HKLM). HKCU không cần admin.

## 3. VIỆC ĐANG DANG DỞ — CÀI COOKIE EXTENSION CHO TẤT CẢ CHROME (Web Store)
- **App đã sẵn sàng** force-install theo Extension ID (Codex commit `b283131` + hạ tầng `applyExtensionPolicy`).
- **Việc còn lại của người dùng:** tạo tài khoản Chrome Web Store Developer (5$ một lần) → upload `assets/fb-cookie-extension/` dạng **Unlisted** → chờ duyệt → lấy **Extension ID (32 ký tự a–p)** → nhập vào app → bấm cài cho tất cả Chrome → đóng-mở lại Chrome.
- Cần đóng gói `.zip` để upload (có thể thêm nút "Đóng gói .zip" dùng PowerShell `Compress-Archive`).

## 4. NGHIÊN CỨU ĐÃ BÀN — CHƯA TRIỂN KHAI (giữ lại để Ver 2 tiếp tục)

### 4.1 Anti-Detect Browser (tạm dừng ở khâu nghiên cứu)
Mục tiêu: tránh checkpoint khi đăng nhập nhiều nick. Nguyên nhân gốc: mọi profile **chung 1 IP + chung 1 vân tay Chrome**.
- **Giai đoạn 1 (khuyến nghị làm trước, ROI cao):** proxy riêng từng profile (`--proxy-server`), chặn rò WebRTC, khớp timezone/ngôn ngữ theo proxy (đặt biến môi trường `TZ` khi spawn Chrome — không cần CDP). Thêm trường `proxy/timezone/locale` vào config mỗi profile.
- **Giai đoạn 2:** extension "Guard" nội bộ spoof Canvas/WebGL/Audio theo seed cố định mỗi profile + proxy có auth.
- **Giai đoạn 3 (chỉ khi cần):** nhúng Chromium anti-detect fork (nặng, đổi kiến trúc).
- Ràng buộc: Chrome 130+ tắt CDP, 137+ chặn `--load-extension` → không dùng 2 cái này. Anti-detect KHÔNG cứu được hành vi spam (cần proxy tốt + warm-up).

### 4.2 Xuất cookie qua localhost (đã thay bằng extension độc lập)
Đã thử extension nội bộ + localhost `/cookies` (còn trong `assets/cookie-exporter/` + `src/extHost.js`) nhưng force-install self-host không ổn định → chuyển sang **extension độc lập** (`assets/fb-cookie-extension/`) + hướng Web Store (mục 3).

## 5. QUY TRÌNH LÀM VIỆC (skill đã có sẵn trong repo)
- `.claude/skills/plan-product/SKILL.md` — khung lên kế hoạch (mọi loại sản phẩm).
- `.claude/skills/ship-upmedia/SKILL.md` — quy trình phát hành: sửa → push `main` → CI build .exe → Telegram → test PC.
- **Push lên `main`** để CI build; CI tự bump version + gửi Telegram. Trước khi sửa: `git fetch origin main && git checkout -B work-main origin/main`.

## 6. LƯU Ý CODEX ĐANG LÀM SONG SONG
Trong phiên này Codex cũng push lên `main` (ví dụ `b283131`, thêm `execFile` vào main.js). Khi Ver 2 tiếp tục, luôn rebase trên `origin/main` mới nhất để tránh xung đột.
