BÀN GIAO SANG PHIÊN VER 2 — Chrome Manager by UP Media
Đọc file này + `CLAUDE.md` (đặc biệt Mục 13) + `CHANGELOG.md` là nắm được toàn bộ trạng thái. LUÔN đọc nhánh `main` mới nhất, KHÔNG dùng link pin theo commit hash cũ. Version tại thời điểm bàn giao: v1.8.54.

0.A. PHIÊN NÂNG CẤP UI/UX & TIỆN ÍCH (v1.8.50 → v1.8.54) — MỚI NHẤT
Cập nhật — đã làm xong & đã push `main`, CI build tuần tự các bản:

* Tự chạy dưới quyền Administrator khi khởi động (khắc phục lỗi thỉnh thoảng không gõ được tiếng Việt/Unikey): `ensureElevated()` trong `main.js` dùng `net session` để dò quyền, relaunch qua PowerShell `Start-Process -Verb RunAs`; bấm "No" ở UAC vẫn chạy tiếp bản thường. Có toggle tắt trong Cài đặt (`settings.autoElevate`). Menu app rút gọn còn nhóm "Chỉnh sửa" để giải phóng Ctrl+R/Ctrl+Q cho phần mềm (vẫn giữ Copy/Dán).
* Phím tắt: Ctrl+F (tìm kiếm), Ctrl+N (thêm Chrome), Ctrl+O (đổi kiểu hiển thị), Ctrl+G (nhóm), Ctrl+T (dung lượng), Ctrl+L (load Social), Ctrl+Q (Cài đặt), Ctrl+R (quét lại), Ctrl+D (xóa bộ lọc / đóng pop-up), Ctrl+~ (bảng phím tắt), Esc (đóng pop-up). Danh sách trong mảng `SHORTCUTS` (renderer.js).
* Icon "Phím tắt" + "Tiện ích UP Media" nằm trên **header** (cạnh cụm thống kê): `.header-tools` / `.header-icon-btn`. Rê chuột vào icon Phím tắt hiện popover danh sách.
* "Tiện ích UP Media trên Store": modal `#modal-upm-exts`, dữ liệu ở mảng `UPMEDIA_EXTENSIONS` (renderer.js) — thêm tiện ích/tài liệu mới chỉ cần thêm 1 object `{name, desc, type, url}`. Mở link qua IPC `open-external` (shell.openExternal). Tiện ích đầu: UP Media - Cookie Facebook (link store trong mảng).
* Typeahead danh mục (nhóm cha + con) ở cả thẻ và pop-up thêm tài khoản: helper `addMenuTypeahead()`. Gõ để lọc, không khớp thì nút "Tạo mới" → tự `saveGroups`/`saveGroupSubs` + gán vào profile + đồng bộ sidebar.
* Chống mở trùng Chrome: `open-profile` và `open-profiles-batch` (main.js) kiểm tra tiến trình đang chạy qua `getRunningProfileDirs()` (wmic) → bỏ qua profile đã mở. IPC `get-running-profiles`.
* Bấm vùng trắng của thẻ để mở Chrome (`.card-clickable`, loại trừ nút/ô nhập/nhóm).
* Gộp "Tạo tất cả shortcut / Tối ưu dung lượng / Đóng Chrome" vào dropdown "Chức năng" trên toolbar (`#func-menu-wrap`).
* Pop-up "Tạo tài khoản Chrome mới" thiết kế lại rộng 640px, xếp dọc thoáng (`.modal-newprofile`, `.np-*`).
* Đồng bộ giao diện sidebar "Lọc nhóm" theo "Lọc đăng nhập" (chấm màu `.group-dot` + tên + count, cùng font).
* Thanh cuộn danh sách chính dày 12px (`.main::-webkit-scrollbar`).
* CẦN TEST TRÊN WINDOWS THẬT: (1) tự nâng quyền Admin + gõ tiếng Việt; (2) chống mở trùng Chrome (dựa trên wmic); (3) các phím tắt.

0. CẬP NHẬT (cookie extension đã lên Web Store & cài hàng loạt xong)
Cập nhật ngày 11/08/2026 — hạng mục cookie extension đã đi hết luồng, không còn dang dở:

* Đã đăng ký tài khoản Chrome Web Store Developer (phí 5$ một lần) — thanh toán thành công.
* Extension "UP Media - Cookie Facebook" (phiên bản 1.1.0) đã được Web Store duyệt, để chế độ Unlisted (không công khai) — chỉ ai có link mới thấy.
* Extension ID chính thức: `bkdigiggjmpomfoeafbbgpipjennbhen`
* Đã force-install hàng loạt theo Extension ID vào tất cả Chrome trên máy thành công qua Chrome Manager by UP Media v1.8.49 (đúng kế hoạch Mục 3 cũ).
* Extension ID này đã được nhập sẵn trong app (Cài đặt → "Extension Cookie Facebook qua Web Store"). Khi đổi extension/tài khoản dev, chỉ cần thay ID mới vào ô này rồi bấm "Cài cookie cho tất cả Chrome".

1. TRẠNG THÁI HIỆN TẠI (đã làm xong & đã build)

* Giao diện brand UP Media; 2 chế độ hiển thị (thẻ / hàng tinh gọn); tìm kiếm chuẩn hóa; bộ lọc "Chưa có nhóm" / "Chưa đặt tên"; sắp xếp theo lượt mở.
* Cài đặt: mở toàn màn hình, khởi động cùng Windows, profile mở mặc định, Lịch sử phiên bản.
* Cache dung lượng: không auto-scan (tránh đơ), nút "Tính" từng thẻ.
* Social login detection + Load Social Cache (thủ công + tự làm mới 7 ngày).
* Quản lý tiện ích: liệt kê / nhân bản ra tất cả / xóa khỏi tất cả / bỏ chặn; nhập tiện ích ngoài store (self-host CRX).
* Xuất/Nhập Excel (.xlsx) + file mẫu; tự tạo Chrome mới theo từng dòng.
* Cookie Facebook: extension độc lập `assets/fb-cookie-extension/` (lấy/copy/nhập cookie, có icon) + force-install qua Web Store (commit `b283131`).
* Force-install cookie extension qua Web Store: ĐÃ CHẠY THẬT THÀNH CÔNG — extension Unlisted `bkdigiggjmpomfoeafbbgpipjennbhen` cài hàng loạt qua v1.8.49. Có sẵn nút "Đóng gói extension (.zip)" và "Xuất extension ra Desktop" trong Cài đặt.

2. HẠNG MỤC CẦN KIỂM THỬ TRÊN MÁY THẬT (Windows/Chrome/registry)

* [x] Force-install cookie extension qua Web Store — ĐÃ XONG. Đã up Unlisted, lấy Extension ID `bkdigiggjmpomfoeafbbgpipjennbhen`, nhập vào app, cài cho tất cả Chrome thành công qua v1.8.49.
* [ ] Nhập tiện ích ngoài store (đóng gói CRX + force-install localhost) — kiểm tra `chrome://extensions` có extension nhãn "Installed by enterprise policy". (Luồng self-host CRX vẫn chưa verify trên Chrome 149 thật — khác với luồng Web Store ở trên đã xong.)
* [ ] Cookie export nội bộ (localhost) — luồng cũ; hiện khuyến nghị dùng extension độc lập thay thế.
* Lưu ý: nếu policy không ghi được → chạy app bằng Run as administrator (HKLM). HKCU không cần admin.

3. HẠNG MỤC CÀI COOKIE EXTENSION QUA WEB STORE — ĐÃ HOÀN THÀNH
Toàn bộ luồng đã đi hết và verify trên máy thật:

* [x] Đăng ký Chrome Web Store Developer (5$) — xong.
* [x] Đóng gói `assets/fb-cookie-extension/` thành .zip (nút "Đóng gói extension (.zip)" trong app) — xong.
* [x] Upload lên Web Store dạng Unlisted → được duyệt — xong (extension "UP Media - Cookie Facebook" v1.1.0).
* [x] Lấy Extension ID: `bkdigiggjmpomfoeafbbgpipjennbhen` — xong.
* [x] Nhập ID vào app → "Cài cookie cho tất cả Chrome" → đóng/mở lại Chrome — xong, hàng loạt thành công qua v1.8.49.

Vận hành về sau: mỗi khi cần cài lại (máy mới / thêm Chrome), chỉ cần mở Cài đặt → dán đúng Extension ID → "Cài cookie cho tất cả Chrome".
4. NGHIÊN CỨU ĐÃ BÀN — CHƯA TRIỂN KHAI (giữ lại để Ver 2 tiếp tục)
4.1 Anti-Detect Browser (tạm dừng ở khâu nghiên cứu)
Mục tiêu: tránh checkpoint khi đăng nhập nhiều nick. Nguyên nhân gốc: mọi profile chung 1 IP + chung 1 vân tay Chrome.

* Giai đoạn 1 (khuyến nghị làm trước, ROI cao): proxy riêng từng profile (`--proxy-server`), chặn rò WebRTC, khớp timezone/ngôn ngữ theo proxy (đặt biến môi trường `TZ` khi spawn Chrome — không cần CDP). Thêm trường `proxy/timezone/locale` vào config mỗi profile.
* Giai đoạn 2: extension "Guard" nội bộ spoof Canvas/WebGL/Audio theo seed cố định mỗi profile + proxy có auth.
* Giai đoạn 3 (chỉ khi cần): nhúng Chromium anti-detect fork (nặng, đổi kiến trúc).
* Ràng buộc: Chrome 130+ tắt CDP, 137+ chặn `--load-extension` → không dùng 2 cái này. Anti-detect KHÔNG cứu được hành vi spam (cần proxy tốt + warm-up).

4.2 Xuất cookie qua localhost (đã thay bằng extension độc lập)
Đã thử extension nội bộ + localhost `/cookies` (còn trong `assets/cookie-exporter/` + `src/extHost.js`) nhưng force-install self-host không ổn định → chuyển sang extension độc lập (`assets/fb-cookie-extension/`) + hướng Web Store (đã hoàn thành, xem Mục 3).
5. QUY TRÌNH LÀM VIỆC (skill đã có sẵn trong repo)

* `.claude/skills/plan-product/SKILL.md` — khung lên kế hoạch (mọi loại sản phẩm).
* `.claude/skills/ship-upmedia/SKILL.md` — quy trình phát hành: sửa → push `main` → CI build .exe → Telegram → test PC.
* Push lên `main` để CI build; CI tự bump version + gửi Telegram. Trước khi sửa: `git fetch origin main && git checkout -B work-main origin/main`.

6. LƯU Ý CODEX ĐANG LÀM SONG SONG
Trong phiên trước Codex cũng push lên `main` (ví dụ `b283131`, thêm `execFile` vào main.js). Khi Ver 2 tiếp tục, luôn rebase trên `origin/main` mới nhất để tránh xung đột.
