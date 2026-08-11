# AGENTS.md — app Chrome Manager by UP Media

> **Nguồn chính là `/AGENTS.md` ở repo root** (và `/CLAUDE.md` Mục 0). File này đặt cạnh app để agent (Codex…) tự nạp được **dù mở repo root hay mở thẳng thư mục `chrome-shortcut-manager/`**. Nội dung dưới chỉ là tối thiểu — ĐỌC 2 file gốc trước khi triển khai.

## Bắt buộc đọc trước khi làm
- `/AGENTS.md` (repo root) — quy trình đầy đủ cho agent.
- `/CLAUDE.md` — Mục 0 (TRẠNG THÁI CHUẨN): còn hiệu lực / đã gỡ.
- `preload.js` — nguồn chân lý IPC (`window.app.*` ↔ `ipcMain.handle`).
- `.claude/skills/ship-upmedia/SKILL.md` — quy trình phát hành + checklist cập nhật tài liệu.

## 5 điều không được quên
1. Nhánh phát hành: `main`. `git checkout -B work-main origin/main` → sửa → `git push origin work-main:main` (KHÔNG mở PR trừ khi được yêu cầu).
2. Push code lên `main` → CI tự bump version + `npm ci` + `npm test` + build `.exe` + Release + Telegram. Push chỉ-tài-liệu (`*.md`, `.github/**`, `.claude/**`) KHÔNG build.
3. Trước khi push: `node --check` file JS đã đổi + `npm test` xanh.
4. **Cuối phiên BẮT BUỘC cập nhật tài liệu** theo Định nghĩa Hoàn thành (ship-upmedia Mục 4): changelog in-app + `CHANGELOG.md` + `CLAUDE.md` (0/13-14) + `README`/`HANDOFF_V2`/`DEPLOY_STATUS` khi cần. Chưa đủ = chưa xong.
5. Windows only; brand UP Media (xanh `#0E5A2A`, vàng `#FFE66D`, kem `#F5F0E8`, pill, thanh caro); không xóa cookie/mật khẩu khi clear cache; Chrome 130+ tắt CDP, 137+ chặn `--load-extension`.
