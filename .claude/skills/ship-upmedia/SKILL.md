---
name: ship-upmedia
description: >-
  Quy trình chuẩn để phát triển & phát hành phần mềm Chrome Manager by UP Media
  (và các app Electron tương tự trong repo này) qua luồng Claude Code → GitHub
  (nhánh main) → GitHub Actions build .exe → thông báo Telegram → anh tải về PC test.
  DÙNG SKILL NÀY mỗi khi: nâng cấp/sửa/thêm tính năng cho app, phát hành phiên bản
  mới, hoặc bất kỳ tác vụ nào cần commit + push để ra bản build .exe. Trigger khi
  người dùng nói "nâng cấp", "thêm chức năng", "sửa lỗi", "ra bản mới", "build",
  "phát hành", "deploy app", hoặc mô tả một tính năng cần đưa vào phần mềm.
---

# SKILL: Ship UP Media App (Claude Code → GitHub → CI → Telegram → PC)

Skill này đóng gói quy trình phát triển–phát hành đã thiết lập sẵn. Các kết nối
(GitHub repo, bot Telegram qua Secrets, workflow CI) **đã cấu hình cố định** —
KHÔNG cấu hình lại, chỉ điều phối đúng luồng.

## 0. HẰNG SỐ MÔI TRƯỜNG (không hỏi lại)

- **Repo:** `tuyenthanh829/UP-Media` · code trong `chrome-shortcut-manager/`.
- **Nhánh phát hành:** `main` (CI chỉ build khi push lên `main`).
- **CI:** `.github/workflows/build-electron.yml` — tự bump patch version, `electron-builder --win`, tạo Release (Setup + Portable), gửi Telegram (Secrets `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`).
- **Ngôn ngữ giao tiếp với người dùng:** tiếng Việt. **Ngôn ngữ commit:** tiếng Anh.
- **Brand:** xanh `#0E5A2A`, vàng `#FFE66D`, kem `#F5F0E8`; nút bo tròn (pill); font `Unbounded` (tiêu đề) + `Be Vietnam Pro` (body); thanh caro dưới header. KHÔNG đổi các yếu tố này.
- **Tài liệu tham chiếu:** `CLAUDE.md` (kỹ thuật) + `README.md` + `CHANGELOG.md`. Đọc khi cần nắm lại context.

## 1. PHÂN LUỒNG YÊU CẦU (làm đầu tiên, luôn luôn)

Xác định yêu cầu thuộc loại nào và nói rõ với người dùng đang ở luồng nào:

- **A. NGHIÊN CỨU / TƯ VẤN** ("nghiên cứu", "tư vấn", "có giải pháp nào", "đề xuất"):
  → KHÔNG code. Trình bày phương án + đánh đổi + khuyến nghị, rồi HỎI để duyệt
  (dùng AskUserQuestion). Chỉ chuyển sang luồng B khi được chọn.
- **B. TRIỂN KHAI** ("nâng cấp", "thêm", "sửa", "làm"):
  → Vào quy trình mục 2–6.
- Nếu 1 tin nhắn có nhiều việc: liệt kê ngắn, làm tuần tự, commit theo từng cụm
  logic (mỗi tính năng lớn 1 commit) để CI build kiểm chứng được từng phần.

## 2. ĐỒNG BỘ NHÁNH TRƯỚC KHI SỬA (bắt buộc)

CI hay tự commit bump version lên `main`, nên local dễ lệch. Luôn base trên
`origin/main` mới nhất:

```bash
git fetch origin main -q
git stash -u -q 2>/dev/null            # nếu đang có thay đổi dở
git checkout -B work-main origin/main
git stash pop 2>/dev/null              # lấy lại thay đổi (nếu có)
```

Làm việc trên `work-main`, cuối cùng push bằng `work-main:main` (mục 5).

## 3. TRIỂN KHAI

- Sửa file trong `chrome-shortcut-manager/`. Bám sát code & style hiện có.
- Kiến trúc: `main.js` (IPC) ↔ `preload.js` (`window.app.*`) ↔ `renderer/*`. Module trong `src/`.
- Ràng buộc: Windows only; Chrome 130+ tắt CDP, 137+ chặn `--load-extension`;
  `extensions.settings` ở **Secure Preferences**; cache KHÔNG auto-scan (gây đơ).
- Sau khi sửa: `node --check <file>` mọi file JS đã đổi.

## 4. GHI CHÚ & NOTE (rành mạch — không bỏ qua)

Mỗi lần có thay đổi người dùng thấy được:
1. **Changelog trong app:** thêm 1 mục MỚI vào ĐẦU mảng `CHANGELOG` trong
   `renderer/renderer.js`, version = patch kế tiếp (CI sẽ bump tới số này). Ghi
   ngắn gọn tiếng Việt từng thay đổi.
2. **Tài liệu (khi thay đổi lớn/định kỳ):** cập nhật `CHANGELOG.md`, `README.md`,
   và mục bổ sung trong `CLAUDE.md` / `HUONG_DAN_SU_DUNG.md`.
3. **Commit message (tiếng Anh)** mô tả rõ WHAT + WHY, kết thúc bằng:
   ```
   Co-Authored-By: <tên AI> <noreply@anthropic.com>
   ```
   (KHÔNG ghi model id nội bộ vào commit/PR/code.)

## 5. COMMIT & PUSH LÊN MAIN (ra bản build)

```bash
git add <các file>            # KHÔNG add node_modules/ (đã .gitignore)
git commit -q -m "<message tiếng Anh + Co-Authored-By>"
git push -u origin work-main:main
```

**Nếu push bị từ chối** (CI vừa bump version trên remote):
```bash
git fetch origin main -q && git rebase origin/main && git push origin work-main:main
```
Nếu rebase xung đột do CI chỉ đổi `package.json` version → ưu tiên giữ bản remote
version, apply thay đổi của mình lên trên.

**KHÔNG tạo Pull Request** trừ khi người dùng yêu cầu. Chỉ push thẳng `main`.

## 6. BÀN GIAO TEST (đóng vòng)

Sau khi push:
- Báo người dùng: "Đã đẩy `main`, CI đang build **vX.Y.Z**, Telegram sẽ báo sau vài phút."
- Có thể kiểm tra run CI qua GitHub MCP (`mcp__github__actions_list`) nếu cần xác nhận build đang chạy/đã xong.
- Với tính năng KHÔNG test được ở đây (Windows/Chrome/registry): nói RÕ là chưa test, liệt kê **các bước người dùng cần làm để test** + **dữ kiện cần chụp lại gửi về** (toast/thông báo lỗi) để khoanh đúng lỗi.
- Không khẳng định "đã chạy" khi chưa verify được — báo trung thực.

## 7. VÒNG LẶP PHẢN HỒI

Khi người dùng báo lỗi kèm ảnh/mô tả:
- Khoanh vùng nguyên nhân (đọc code liên quan), sửa, lặp lại mục 2–6.
- Nếu lỗi thuộc môi trường không test được: đưa bản có **thêm chẩn đoán** (thông báo/verify) để lần test sau người dùng gửi lại dữ kiện chính xác.

## 8. CHECKLIST NHANH MỖI LẦN DÙNG SKILL

- [ ] Đã phân luồng Nghiên cứu vs Triển khai (mục 1)?
- [ ] Đã `fetch + checkout -B work-main origin/main` (mục 2)?
- [ ] `node --check` sạch (mục 3)?
- [ ] Đã thêm mục CHANGELOG mới + note (mục 4)?
- [ ] Commit tiếng Anh + Co-Authored-By, push `work-main:main` (mục 5)?
- [ ] Đã báo version + hướng dẫn test cho người dùng (mục 6)?
