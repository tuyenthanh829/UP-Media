---
name: bootstrap-repo
description: >-
  Biến MỘT repo bất kỳ thành "tự đủ ngữ cảnh" để mọi AI/dev (Claude Code, Codex…)
  mở lên là triển khai nâng cấp được mà không cần hỏi lại kiến trúc/quy trình.
  Khảo sát repo rồi SINH tài liệu điểm-vào + quy trình + CI sạch cho khớp stack
  của repo đó (KHÔNG copy nội dung dự án khác). DÙNG SKILL NÀY khi người dùng nói
  "/bootstrap-repo", "chuẩn hóa repo", "làm repo tự đủ cho AI", "thiết lập bàn
  giao AI cho repo này", hoặc mở một repo mới của UP Media và muốn áp cùng
  phương thức bàn giao đa-AI. KHÔNG dùng cho việc code tính năng thường.
---

# SKILL: Bootstrap Repo — repo tự đủ ngữ cảnh cho bàn giao đa-AI

Mục tiêu: bất kỳ AI/dev nào mở repo là đủ ngữ cảnh + quy trình để nâng cấp độc
lập. Chạy **1 lần/repo** để "gieo mầm"; sau đó chính các file skill sinh ra sẽ tự
duy trì.

> **Nguyên tắc bất di bất dịch**
> 1. **KHÔNG copy nội dung từ repo khác.** Phải KHẢO SÁT repo hiện tại rồi sinh cho khớp (ngôn ngữ, build, CI, nền tảng khác nhau).
> 2. **Một nguồn chân lý** — trỏ tới file code thật (vd file "hợp đồng" API), không liệt kê tay dễ lệch.
> 3. **Trung thực** — không khẳng định khi chưa verify; chỗ nào chưa rõ thì HỎI người dùng, đừng bịa.
> 4. Thay đổi ở bước này là **docs/CI** → thường không ảnh hưởng sản phẩm; push theo đúng nhánh phát hành của repo.

## 1. KHẢO SÁT (đọc code thật; tóm tắt cho người dùng DUYỆT trước khi tạo file)

Trả lời được các câu sau bằng bằng chứng trong repo:
- Ngôn ngữ/stack; **mã nguồn nằm ở root hay thư mục con nào?**
- Lệnh chạy/dev, test, build. Có **lockfile** & **test tự động** không?
- CI/CD: nhà cung cấp (GitHub Actions…?), file workflow, **nhánh phát hành**, cách
  ra release/tag, có tự bump version không, **default branch** là gì.
- Có "sản phẩm cài đặt/triển khai" cần theo dõi bản đã nghiệm thu không?
- Ràng buộc đặc thù (OS, thương hiệu, bảo mật…). **File "hợp đồng API/interface"** ở đâu.
- Tài liệu hiện có: cái nào đúng, cái nào lỗi thời/mâu thuẫn.
- Đã có `CLAUDE.md` / `AGENTS.md` chưa.

→ **Dừng lại, trình bày bản tóm tắt + kế hoạch tạo file, hỏi người dùng duyệt.**
Chỉ sang bước 2 sau khi được đồng ý (đề phòng hiểu sai stack lạ).

## 2. SINH / CẬP NHẬT TÀI LIỆU (tailored)

1. **`AGENTS.md` ở repo root** — điểm vào cho agent không phải Claude (Codex…),
   tool-agnostic. Nếu mã nguồn ở thư mục con → thêm **1 bản rút gọn trong thư mục
   đó** trỏ về bản root (để agent tự nạp dù mở root hay mở thư mục con). Ghi chú
   giữ 2 bản đồng bộ.
2. **`CLAUDE.md`** — mở đầu bằng **"Mục 0: TRẠNG THÁI CHUẨN — đọc trước"**: điều
   gì còn hiệu lực / đã gỡ; liệt kê **nguồn chân lý** (trỏ tới file code thật cho
   API/interface, changelog…); 1 dòng bắt buộc "cuối phiên phải cập nhật tài liệu".
   Đánh dấu rõ phần cũ; nội dung đã gỡ đưa sang **`HISTORY.md`**.
3. **Quy trình phát hành + ĐỊNH NGHĨA HOÀN THÀNH** — skill riêng của repo trong
   `.claude/skills/<ship-xxx>/SKILL.md`: nhánh phát hành, cách ra bản, và
   **checklist BẮT BUỘC cuối phiên** liệt kê ĐÚNG các file phải cập nhật mỗi lần
   thay đổi (changelog, CLAUDE.md, README version, deploy-status, test…).
4. **`DEPLOY_STATUS.md`** — CHỈ khi repo có bản cài/triển khai: bảng ngày/version/
   commit/nơi/người/kết quả + checklist nghiệm thu; ghi rõ "bản mới nhất ≠ đã nghiệm thu".
5. **`README.md`** — cập nhật dòng version + mục "đọc gì trước khi nâng cấp".

## 3. CI SẠCH (chỉ sửa nếu repo CÓ CI và đang thiếu)

- **Build tái lập:** commit lockfile + dùng lệnh cài "khoá" (npm ci / pip từ lock /
  go mod / … tùy stack).
- **Không build khi push CHỈ đụng tài liệu:** thêm `paths-ignore` cho `**/*.md`,
  `.github/**`, `.claude/**`… (hoặc cơ chế tương đương của CI đó).
- **Tag/Release trỏ ĐÚNG commit đã build:** vd set `target_commitish` = commit trên
  nhánh phát hành; cảnh giác nếu **default branch không phải nhánh phát hành** →
  tag dễ rơi nhầm. Nếu tag cũ đã sai: ghi chú lại "commit nguồn đúng", quyết định
  sửa hay giữ (hỏi người dùng).
- Nếu có bump version tự động: đảm bảo cập nhật **cả** manifest lẫn lockfile để lệnh
  cài "khoá" không lệch.

## 4. THÊM TEST TỐI THIỂU (nếu chưa có, khi khả thi)
- Ưu tiên test cho **hàm logic thuần** (không phụ thuộc OS/hạ tầng), dùng test
  runner sẵn của stack (vd `node:test`, `pytest`…), không thêm phụ thuộc nặng.
- Phần phụ thuộc nền tảng: ghi rõ "chỉ verify được trên môi trường thật".

## 5. CHỐT LẠI
- Commit **docs/CI-only** (message tiếng Anh, WHAT+WHY, kèm `Co-Authored-By`) và
  push theo đúng nhánh phát hành của repo. KHÔNG mở PR trừ khi được yêu cầu.
- Báo người dùng: đã tạo/sửa file gì, cần họ **duyệt/nghiệm thu** gì, và các bước
  chỉ verify được trên môi trường thật.

## 6. CHECKLIST NHANH
- [ ] Đã khảo sát + trình bày tóm tắt cho người dùng DUYỆT (mục 1)?
- [ ] `AGENTS.md` root (+ bản thư mục con nếu cần) (mục 2.1)?
- [ ] `CLAUDE.md` Mục 0 + `HISTORY.md` nếu có nội dung đã gỡ (mục 2.2)?
- [ ] Skill phát hành có ĐỊNH NGHĨA HOÀN THÀNH cập nhật tài liệu (mục 2.3)?
- [ ] `DEPLOY_STATUS.md` (nếu có bản cài/triển khai) + README version (mục 2.4–2.5)?
- [ ] CI: lockfile/npm-ci · paths-ignore docs · tag đúng commit (mục 3)?
- [ ] Commit docs-only + push đúng nhánh + báo cáo trung thực (mục 5)?

## 7. LƯU Ý PHẠM VI
- Đây là bước **event-based, 1 lần/repo**. KHÔNG biến thành cron chạy định kỳ
  (tài liệu phải mô tả thay đổi thật).
- Để dùng cho **mọi repo** bằng Claude Code: đặt skill này ở **cấp người dùng**
  `~/.claude/skills/bootstrap-repo/` trên máy của bạn (bản trong repo chỉ là bản
  gốc để sao chép/chia sẻ). Với Codex/web: dán prompt tương đương vào Custom
  Instructions của tài khoản.
