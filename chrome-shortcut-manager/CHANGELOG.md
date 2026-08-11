# Changelog — Chrome Manager by UP Media

Tất cả thay đổi theo từng phiên bản.

---

## v1.8.54
- Chuyển icon **"Phím tắt"** và **"Tiện ích UP Media"** lên thanh header (cạnh cụm thống kê) cho gọn, dễ thấy.

## v1.8.53
- Thiết kế lại pop-up **"Tạo tài khoản Chrome mới"**: rộng hơn (640px), bố cục xếp dọc thoáng, hết chồng chéo.
- Gộp **Tạo tất cả shortcut / Tối ưu dung lượng / Đóng Chrome** vào menu **"Chức năng"** trên toolbar.
- Phím tắt chuyển thành **icon** (rê chuột xem nhanh) + thêm **Ctrl+~** mở bảng phím tắt.
- Thêm **"Tiện ích UP Media trên Store"**: danh sách extension chính thức, mở bằng trình duyệt (extension đầu tiên: UP Media - Cookie Facebook). Danh sách dạng dữ liệu để dễ thêm về sau.
- Đồng bộ giao diện mục **"Lọc nhóm"** theo **"Lọc đăng nhập"** (icon/chấm màu + tên + số đếm, cùng font).

## v1.8.52
- **Typeahead danh mục:** gõ tên để lọc nhóm/danh mục con có sẵn hoặc **tạo mới** ngay (tự lưu & đồng bộ). Áp dụng cả trên thẻ lẫn pop-up thêm tài khoản.
- **Bấm vùng trắng của thẻ** để mở Chrome (không cần đúng nút "Mở").
- **Chống mở trùng:** khi quét lại / mở hàng loạt / mở mặc định lúc khởi động, bỏ qua các Chrome đang mở sẵn.
- **Esc / Ctrl+D** đóng mọi pop-up.
- Thêm phím tắt **Ctrl+O** (đổi kiểu hiển thị), **Ctrl+G** (nhóm), **Ctrl+T** (dung lượng), **Ctrl+L** (load Social); thêm nút/bảng danh sách phím tắt.
- Thanh cuộn danh sách Chrome dày hơn (dễ kéo).

## v1.8.51
- **Tự chạy dưới quyền Administrator** khi khởi động (khắc phục lỗi thỉnh thoảng không gõ được tiếng Việt/Unikey) — có thể tắt trong Cài đặt.
- Thêm phím tắt: **Ctrl+F** (tìm kiếm), **Ctrl+N** (thêm Chrome), **Ctrl+D** (xóa bộ lọc), **Ctrl+Q** (Cài đặt), **Ctrl+R** (quét lại).

## v1.8.42
- Extension cookie: thêm ô textarea xem/sửa cookie, nút Lấy / Copy / Đăng nhập bằng cookie (nhập), khử trùng lặp cho chuỗi cookie chuẩn.

## v1.8.41
- Lấy cookie Facebook chuyển sang **extension độc lập** (`assets/fb-cookie-extension/`): Cài đặt → "Xuất extension ra Desktop" → tự cài (load unpacked) → bấm icon để Copy/Nhập cookie.
- Sửa modal Cài đặt bị che nút phía dưới (thêm thanh cuộn).

## v1.8.40
- Thêm nút "Tải file mẫu" Excel để điền thông tin nhập profile hàng loạt.
- Cải thiện thông báo lỗi khi Copy cookie.

## v1.8.39
- Xuất cookie Facebook (opt-in, qua extension nội bộ + localhost) — sau này thay bằng extension độc lập.

## v1.8.38
- **Nhập tiện ích ngoài store hàng loạt:** đóng gói thư mục thành CRX + ép cài lên tất cả Chrome (self-host localhost, không cần Developer Mode).

## v1.8.37
- Xuất / Nhập dữ liệu chuyển sang **Excel (.xlsx)** thay JSON — mỗi dòng tạo 1 Chrome mới.

## v1.8.36
- Bỏ chặn tiện ích đang bị chặn; hiện số tiện ích ở chế độ hàng; Xuất/Nhập dữ liệu; đổi khẩu hiệu header.

## v1.8.34–1.8.35
- **Quản lý tiện ích:** liệt kê tiện ích của profile (đọc Secure Preferences); nhân bản/ép cài 1 tiện ích ra tất cả Chrome (policy + verify registry); xóa 1 tiện ích khỏi tất cả (kể cả hàng chờ).

## v1.8.31–1.8.33
- Bỏ "Dọn tiện ích"; mở toàn màn hình; Cài đặt (khởi động cùng Windows, profile mở mặc định); sắp xếp theo lượt mở; **chế độ hàng tinh gọn**; lọc "Chưa đặt tên" / "Chưa có nhóm"; sửa tên danh mục con; **Lịch sử phiên bản** trong app; changelog cuộn được.

## v1.8.30
- Sửa lỗi đơ: bỏ tự động quét cache dung lượng từng thẻ; thêm nút "Tính" cache riêng.

## v1.8.29
- Tìm kiếm không phân biệt hoa/thường, dấu tiếng Việt, khoảng trắng, ký tự đặc biệt; tự xóa ô tìm kiếm khi bấm bộ lọc; Social Cache tải thủ công + tự làm mới 7 ngày.

## v1.8.26
- Nâng cấp toàn bộ giao diện theo nhận diện thương hiệu UP Media.

## v1.8.0–1.8.25
- Kiểm tra đăng nhập mạng xã hội qua cookie SQLite (v10/v11/v20); đọc Gmail, lịch sử duyệt; xử lý khóa file Chrome (Kill-Read-Reopen); tối ưu cache.

---

## v1.3.0 — 2026-06-20

### Thêm mới
- **Đa nhóm (Multi-group):** Mỗi profile có thể thuộc nhiều nhóm cùng lúc. Hiển thị dạng tag chip, click vào tag để xóa nhóm đó, nút `+` để thêm nhóm mới.
- **Đánh số profile:** Badge `#1`, `#2`... hiện ngay trên ảnh đại diện dựa theo tên thư mục (`Profile 1`, `Profile 2`...). Profile Default hiện `★`.
- **Tối ưu dung lượng:** Nút cam "Tối ưu dung lượng" trên toolbar — xem dung lượng cache từng profile, xóa cache tất cả hoặc từng profile riêng lẻ. Chỉ xóa cache, không đụng vào cookie/mật khẩu/đăng nhập.
- **Ghi chú per profile:** Mỗi card có nút ghi chú, click để mở/đóng textarea. Tự động lưu khi blur. Hiện dấu chấm đỏ khi có nội dung. Nội dung ghi chú được tìm kiếm cùng với tên profile.

### Thay đổi kỹ thuật
- `src/storage.js` — file mới, xử lý tính dung lượng và xóa cache
- `src/configStore.js` — migration tự động từ `group` (string) sang `groups` (array)
- `main.js` — thêm 4 IPC handler: `get-cache-size`, `get-all-cache-sizes`, `clear-cache`, `clear-all-cache`
- `preload.js` — expose 4 API mới: `getCacheSize`, `getAllCacheSizes`, `clearCache`, `clearAllCache`

---

## v1.2.0 — 2026-06-19

### Thêm mới
- **Quản lý nhóm tùy chỉnh:** Thêm, sửa, xóa nhóm trong modal "Quản lý nhóm". Không bị giới hạn bởi 6 nhóm mặc định.
- **Đồng bộ ảnh avatar Chrome:** App đọc file `Google Profile Picture.png` trong thư mục profile và hiển thị ảnh thật của từng tài khoản Google.
- **Tạo Chrome profile mới:** Nút "Thêm tài khoản" mở Chrome với profile rỗng để tạo tài khoản mới. Sau đó bấm "Quét lại" để thấy profile mới.

---

## v1.1.0 — 2026-06-18

### Thêm mới
- **Chọn thư mục thủ công:** Nút "Chọn thư mục thủ công" cho phép chỉ định đường dẫn Chrome User Data khi app không tự tìm được (ví dụ: Chrome cài ở ổ D).
- **Quét đa ổ đĩa:** Tự động quét đường dẫn Chrome User Data ở ổ C, D, E, F.
- **Tìm kiếm:** Ô tìm kiếm trên toolbar, tìm theo tên profile và shortcut name.
- **Lọc theo nhóm:** Dropdown lọc profile theo nhóm.

---

## v1.0.0 — 2026-06-17

### Ra mắt ban đầu
- Quét tự động Chrome profile từ `%LOCALAPPDATA%\Google\Chrome\User Data`
- Hiển thị profile dạng card với tên, ảnh đại diện, trạng thái shortcut
- Đổi tên profile thành tên thân thiện
- Gán nhóm cho profile: Seeding, Ads, BM, Khách hàng, Cá nhân, Khác
- Tạo shortcut `.lnk` ra Desktop theo từng profile hoặc tất cả cùng lúc
- Mở Chrome profile trực tiếp từ app
- Xóa shortcut
- Lưu config tại `%APPDATA%\Chrome Shortcut Manager\config.json`
- Thống kê: Tổng profile / Có shortcut / Chưa có shortcut / Chưa đặt tên
