# HISTORY — Chrome Manager by UP Media (nội dung cũ / đã gỡ)

> File này lưu các mô tả **lịch sử / tính năng đã gỡ bỏ**, tách khỏi `CLAUDE.md` để tài liệu chính chỉ còn trạng thái ĐANG ĐÚNG (tránh AI/dev đọc nhầm).
> - Lịch sử thay đổi theo từng bản → `CHANGELOG.md`.
> - Trạng thái chuẩn hiện tại → `CLAUDE.md` (Mục 0, 13, 14).

---

## Tính năng đã GỠ BỎ

### "Dọn tiện ích" McAfee/IDM (cũ — CLAUDE.md Mục 3.7 bản gốc)
Bản gốc có chức năng xóa McAfee WebAdvisor + IDM khỏi tất cả profile, xóa qua Preferences JSON, thư mục `Extensions/`, registry, policy JSON; không có confirm dialog (batch operation).

**Ngoại lệ cũ (`EXEMPT_NAMES` — CLAUDE.md Mục 8.1 bản gốc):**
```js
// src/extensions.js (cũ)
const EXEMPT_NAMES = ['Tuyennt.upmedia Default', 'T93 Profile 1'];
```
Hai profile này không bị xóa extension bởi tính năng "Dọn tiện ích" (kiểm tra bằng `shortcutName`).

**Đã thay bằng** (xem CLAUDE.md Mục 13 — "Quản lý tiện ích" tổng quát):
- Liệt kê tiện ích của từng profile (đọc **Secure Preferences**).
- Xóa 1 tiện ích khỏi tất cả Chrome (kể cả hàng chờ registry + External Extensions).
- Nhân bản / ép cài 1 tiện ích ra tất cả Chrome qua policy `ExtensionInstallForcelist` (+ verify registry).
- Bỏ chặn tiện ích; nhập tiện ích ngoài store (self-host CRX).

→ `EXEMPT_NAMES` **không còn được dùng** trong luồng chính và **không còn là constraint bắt buộc**.
