# Hướng Dẫn Dùng Script Deploy — Quiz Test Center

Tài liệu này dành cho admin không rành kỹ thuật. Đọc từng phần theo thứ tự.

---

## Phần 1 — Cài Đặt Lần Đầu (chỉ làm 1 lần)

### Bước 1: Kết nối SSH vào AZDIGI

**Cách 1 — Dùng Web Terminal trong cPanel (dễ nhất):**
1. Đăng nhập vào cPanel tại địa chỉ hosting AZDIGI của bạn.
2. Tìm mục **"Terminal"** hoặc **"Web Terminal"** trong cPanel.
3. Nhấp vào để mở terminal ngay trên trình duyệt.

**Cách 2 — Dùng PuTTY (trên Windows):**
1. Tải PuTTY tại: https://www.putty.org
2. Mở PuTTY, nhập **Host Name** là địa chỉ server AZDIGI.
3. Port: `22`, Connection type: `SSH`.
4. Nhấn **Open**, đăng nhập bằng tài khoản hosting.

---

### Bước 2: Điều hướng đến thư mục app

Sau khi kết nối SSH thành công, gõ lệnh sau (thay `<ten-hosting>` bằng tên tài khoản hosting thực tế):

```bash
cd /home/<ten-hosting>/public_html/test.upmedia.vn/quiz-test-app
```

Ví dụ nếu tên hosting là `upmedia`:

```bash
cd /home/upmedia/public_html/test.upmedia.vn/quiz-test-app
```

---

### Bước 3: Cấp quyền thực thi cho script (chỉ làm 1 lần)

```bash
chmod +x deploy.sh
```

Lệnh này cho phép chạy file `deploy.sh`. Chỉ cần làm đúng 1 lần duy nhất.

---

### Bước 4: Kết nối Git repo (nếu chưa clone)

Nếu thư mục chưa có code, chạy lệnh sau để kéo code từ GitHub về:

```bash
git remote set-url origin https://github.com/tuyenthanh829/UP-Media.git
git pull
```

---

## Phần 2 — Quy Trình Deploy Thông Thường (mỗi lần có code mới)

Mỗi khi có code mới trên GitHub, thực hiện 2 lệnh sau:

```bash
cd /home/<ten-hosting>/public_html/test.upmedia.vn/quiz-test-app
./deploy.sh
```

### Những gì bạn sẽ thấy trên terminal khi deploy thành công:

```
======================================================
  DEPLOY BẮT ĐẦU: 2025-01-15 10:30:00
======================================================
----> Bước 1/7 — Kiểm tra môi trường...
[OK]  Thư mục app hợp lệ: /home/upmedia/public_html/...
----> Bước 2/7 — Git pull từ remote...
Already up to date.
[OK]  Git pull thành công. Commit hiện tại: abc1234
----> Bước 3/7 — Kiểm tra package.json thay đổi...
[OK]  package.json không đổi — bỏ qua npm install.
----> Bước 4/7 — Cài đặt dependencies (nếu cần)...
[OK]  Bỏ qua npm install.
----> Bước 5/7 — Restart Passenger (Node.js app)...
[OK]  Đã touch tmp/restart.txt — Passenger sẽ restart app.
----> Bước 6/7 — Kiểm tra app sau deploy...
  Chờ Passenger khởi động lại (tối đa 15 giây)...
  Lần 1 — HTTP status: 200
[OK]  App đang chạy bình thường (HTTP 200).
----> Bước 7/7 — Ghi kết quả deploy...

======================================================
  ✔ DEPLOY THÀNH CÔNG
  Thời gian:   2025-01-15 10:30:15
  Commit:      abc1234def5678
  Port:        5175
======================================================
```

Khi thấy dòng **DEPLOY THÀNH CÔNG** màu xanh lá — bạn đã hoàn tất.

---

## Phần 3 — Đọc Log Nếu Có Lỗi

Khi deploy bị lỗi, xem chi tiết bằng lệnh:

```bash
tail -50 tmp/deploy.log
```

Lệnh này hiển thị 50 dòng cuối của file log. File log lưu toàn bộ lịch sử deploy với timestamp.

Để xem toàn bộ log:

```bash
cat tmp/deploy.log
```

---

## Phần 4 — Xử Lý Lỗi Thường Gặp

| Lỗi trên terminal | Nguyên nhân | Cách xử lý |
|---|---|---|
| `Not in app directory` hoặc `Không tìm thấy file app` | Đang đứng sai thư mục | Chạy `cd /home/<ten-hosting>/public_html/test.upmedia.vn/quiz-test-app` rồi thử lại |
| `Git pull thất bại` | Conflict code hoặc mất kết nối mạng | Kiểm tra kết nối mạng, hoặc báo người quản lý code giải quyết conflict |
| `npm install thất bại` | Lỗi dependency hoặc thiếu package | Xem log chi tiết bằng `tail -50 tmp/deploy.log`, liên hệ người quản lý code |
| `Health check thất bại` / `App chưa phản hồi` | App cần thêm thời gian khởi động | Chờ 30 giây, rồi thử mở `https://test.upmedia.vn` xem đã lên chưa |
| `Permission denied` khi chạy `./deploy.sh` | Chưa cấp quyền thực thi | Chạy `chmod +x deploy.sh` rồi thử lại |
| `command not found: git` | Môi trường thiếu git | Liên hệ AZDIGI hỗ trợ kích hoạt git |

---

## Phần 5 — Rollback Nếu Deploy Lỗi

Nếu deploy xong nhưng app bị lỗi, bạn có thể quay về phiên bản cũ:

### Bước 1: Xem lịch sử các commit gần đây

```bash
git log --oneline -5
```

Kết quả trông giống như:

```
abc1234 Cập nhật giao diện câu hỏi
def5678 Sửa lỗi đăng nhập
ghi9012 Thêm tính năng xuất kết quả
jkl3456 Cập nhật thư viện
mno7890 Phiên bản ổn định đầu tiên
```

### Bước 2: Quay về commit trước đó

Chép mã commit muốn quay về (7 ký tự đầu), rồi chạy:

```bash
git checkout <commit-hash>
```

Ví dụ: `git checkout def5678`

### Bước 3: Restart lại app

```bash
touch tmp/restart.txt
```

### Bước 4: Kiểm tra app đã phục hồi chưa

Mở trình duyệt, truy cập `https://test.upmedia.vn` và kiểm tra.

---

> **Lưu ý:** Sau khi rollback, hãy báo người quản lý code biết để họ kiểm tra và sửa lỗi trên GitHub trước khi deploy lại.
