# Changelog — Chrome Shortcut Manager

Tất cả thay đổi theo từng phiên bản.

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
