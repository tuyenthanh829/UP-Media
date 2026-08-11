# AGENTS.md — Hướng dẫn cho AI agent (Codex & tương tự)

> File này là **điểm vào cho mọi AI agent KHÔNG phải Claude Code** (Codex, Cursor…).
> Claude Code tự đọc `CLAUDE.md`; các agent khác đọc file này. **Cả hai cùng trỏ về một bộ quy trình** — đừng nhân bản nội dung, hãy đọc đúng nguồn chân lý bên dưới.
>
> Đây là **bản chính**. Có 1 bản rút gọn tại `chrome-shortcut-manager/AGENTS.md` (để agent tự nạp khi mở thẳng thư mục app) — sửa file này thì rà lại bản đó cho khớp.

## Đọc trước khi làm bất cứ việc gì (nguồn chân lý)
1. **`CLAUDE.md` — Mục 0 (TRẠNG THÁI CHUẨN):** điều gì còn hiệu lực / đã gỡ. Khi mâu thuẫn, Mục 0 + 13 + 14 là mới nhất và ĐÚNG.
2. **`chrome-shortcut-manager/preload.js`:** danh sách IPC API đầy đủ (`window.app.*` ↔ `ipcMain.handle` trong `main.js`). Đây là hợp đồng renderer↔main.
3. **`chrome-shortcut-manager/HANDOFF_V2.md`** (bàn giao + định hướng), **`CHANGELOG.md`** (lịch sử), **`HISTORY.md`** (tính năng đã gỡ), **`DEPLOY_STATUS.md`** (bản đang dùng thật).
4. **Quy trình phát hành:** `.claude/skills/ship-upmedia/SKILL.md` — đọc toàn bộ. Nội dung tool-agnostic; nếu skill nhắc tool riêng của Claude (vd GitHub MCP), dùng công cụ tương đương của agent bạn.

## Bối cảnh tối thiểu
- **App:** `chrome-shortcut-manager/` — Electron (Windows 10/11 x64 ONLY). `main.js` (IPC) ↔ `preload.js` ↔ `renderer/*`. Module trong `src/`.
- **Nhánh phát hành:** `main`. Sửa xong push thẳng `main` (KHÔNG mở PR trừ khi được yêu cầu). Trước khi sửa: `git fetch origin main && git checkout -B work-main origin/main`, làm việc, rồi `git push origin work-main:main`.
- **CI (GitHub Actions `.github/workflows/build-electron.yml`):** push lên `main` **có đụng code** → tự bump patch version (`npm version`, cập nhật cả `package.json` + `package-lock.json`), `npm ci`, `npm test`, build `.exe` (NSIS + Portable), tạo Release (tag trỏ đúng commit bump nhờ `target_commitish`), gửi Telegram.
- **Không build khi push CHỈ đụng tài liệu/CI:** đã cấu hình `paths-ignore` cho `**/*.md`, `.claude/**`, `.github/**`… → push docs không tốn build.
- **Kiểm thử:** `npm test` (node:test, phủ hàm logic thuần) phải xanh; `node --check` mọi file JS đã đổi. Phần phụ thuộc Windows (Admin/UAC, registry, `wmic`, cookie SQLite) chỉ verify được trên máy thật → nhờ owner test, cập nhật `DEPLOY_STATUS.md`.
- **Commit message tiếng Anh**, mô tả WHAT + WHY, kết thúc bằng `Co-Authored-By: <tên AI> <noreply@anthropic.com>`. KHÔNG ghi model id nội bộ vào commit/PR/code.

## BẮT BUỘC — cập nhật tài liệu cuối phiên (Definition of Done)
Cơ chế cập nhật tài liệu là **thủ công theo phiên** (không có gì tự động). Sau MỖI phiên có thay đổi, đồng bộ để phiên sau đủ ngữ cảnh — theo checklist đầy đủ ở **`.claude/skills/ship-upmedia/SKILL.md` Mục 4**:
- Changelog in-app (mảng `CHANGELOG` trong `renderer/renderer.js`) + `CHANGELOG.md`.
- `CLAUDE.md` Mục 0/13-14 (gỡ tính năng → chuyển mô tả sang `HISTORY.md`).
- `README.md` (dòng version) · `HANDOFF_V2.md` / `DEPLOY_STATUS.md` khi cần.
- Thêm/sửa hàm logic thuần → thêm test trong `chrome-shortcut-manager/test/`.

**Chưa cập nhật đủ = phiên CHƯA xong.**

## Ràng buộc không được vi phạm
- Brand UP Media: xanh `#0E5A2A`, vàng `#FFE66D`, kem `#F5F0E8`; nút bo tròn (pill); thanh caro dưới header; font Unbounded (tiêu đề) + Be Vietnam Pro (body).
- Không xóa cookie/mật khẩu khi "Tối ưu dung lượng".
- Windows only; Chrome path cứng (`Program Files` / `Program Files (x86)`).
- Chrome 130+ tắt CDP; Chrome 137+ chặn `--load-extension`.
