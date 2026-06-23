# UP Assessment — NotebookLM Importer Extension

Chrome Extension (Manifest V3) để import câu hỏi quiz từ NotebookLM vào UP Assessment Platform.

---

## Cài đặt (Developer mode)

1. Mở Chrome → `chrome://extensions`
2. Bật **Developer mode** (góc trên phải)
3. Nhấn **Load unpacked**
4. Chọn thư mục `up-assessment-extension/`

> Icons placeholder đang dùng file SVG. Thay bằng PNG 16/48/128px trước khi ship production.

---

## Cấu hình lần đầu

1. Click icon extension → nhấn ⚙️ (Settings)
2. Điền **API URL**: `https://your-app.com` (hoặc `http://localhost:3000` khi dev)
3. Điền **Auth Token**: lấy từ UP Assessment app → Profile → Copy API Token
4. Nhấn Lưu

---

## Cách sử dụng

### Scan từ DOM (tự động)

1. Mở NotebookLM, vào notebook có quiz
2. Hiển thị câu hỏi trên màn hình
3. Click icon extension
4. Nhấn **Scan câu hiện tại** hoặc **Scan tất cả**
5. Kiểm tra preview, chỉnh đáp án đúng nếu chưa detect được
6. Nhập **Course Code** (VD: `HR-3P-001`)
7. Nhấn **Import vào UP Assessment**

### Nhập thủ công (Manual paste)

Dùng khi DOM scan không hoạt động:

1. Copy text quiz từ NotebookLM
2. Click **✏️ Nhập thủ công**
3. Paste vào ô text theo format:

```
Câu hỏi là gì?
A. Đáp án A
B. Đáp án B
C. Đáp án C
D. Đáp án D
Đáp án: B
Giải thích: Vì lý do X...

Câu hỏi tiếp theo?
A. ...
```

4. Nhấn **Parse** → kiểm tra preview → Import

---

## Webhook Notion Automation (optional)

Để auto-sync khi publish câu hỏi trong Notion:

- Notion Automation trigger: Status changed to "Published"
- Action: HTTP POST `https://your-app.com/api/webhooks/notion?secret=<NOTION_WEBHOOK_SECRET>`
- Body: `{ "page_id": "{{Page ID}}" }`

---

## Security notes

- Extension **không lưu** Supabase service role key
- Auth Token lưu trong `chrome.storage.local` (encrypted, chỉ extension đọc được)
- Chỉ hoạt động trên `notebooklm.google.com` (host_permissions)
- Không background-scan tự động — chỉ khi user chủ động nhấn nút
