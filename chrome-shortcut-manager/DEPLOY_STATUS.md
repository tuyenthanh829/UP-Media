# TRẠNG THÁI TRIỂN KHAI — Chrome Manager by UP Media

> Ghi lại bản nào ĐÃ CÀI & NGHIỆM THU trên máy thật. Cập nhật file này **mỗi lần cài bản mới** để phân biệt "đã build trên CI" (repo/Release) với "đã dùng thật" (máy owner).
> Bản mới nhất trên repo/Release **không đồng nghĩa** đã được nghiệm thu.

## Bản đang dùng thật tại UP Media

| Ngày cài | Version | Commit | Release | Máy | Người nghiệm thu | Kết quả |
|----------|---------|--------|---------|-----|------------------|---------|
| _(chưa ghi)_ | v1.8.49 | _(n/a)_ | v1.8.49 | Máy owner | Tuyen Thanh | ✅ Đã dùng để force-install cookie extension (Web Store ID) thành công |
| 11/08/2026 | **v1.8.56** | `13a9b25` | v1.8.56 | Máy owner | Tuyen Thanh | ✅ Đã cài & nghiệm thu — **mọi chức năng đều khả dụng** |

## Hạng mục cần nghiệm thu trên Windows thật (bản v1.8.50 → v1.8.56)

Đánh dấu `[x]` khi đã test đạt trên máy thật. **Nghiệm thu tại v1.8.56 (11/08/2026): mọi chức năng khả dụng.**

- [x] Tự nâng quyền Administrator (UAC hiện lên, chọn Yes → app chạy elevated; chọn No → vẫn chạy thường)
- [x] Gõ tiếng Việt (Unikey) ổn định khi app chạy quyền Admin
- [x] Toàn bộ phím tắt: Ctrl+F/N/O/G/T/L/Q/R/D, Ctrl+~, Esc
- [x] Chống mở trùng Chrome (mở sẵn profile → quét lại / mở lại KHÔNG mở cửa sổ trùng)
- [x] Typeahead nhóm/danh mục con (gõ để lọc + tạo mới, đồng bộ sidebar)
- [x] Bấm vùng trắng thẻ để mở Chrome
- [x] Menu "Chức năng" (Tạo shortcut / Tối ưu dung lượng / Đóng Chrome)
- [x] 2 icon header (Phím tắt hover popover + Tiện ích UP Media mở link Store)
- [x] Copy/Dán trong ô cookie vẫn hoạt động (sau khi rút gọn menu app)
- [ ] Luồng nhập tiện ích ngoài store (self-host CRX) — _chưa test riêng, không nằm trong nhóm nghiệm thu v1.8.56_

## ⚠️ Ghi chú: tag Release cũ trỏ SAI commit (đã biết — quyết định KHÔNG sửa)

Default branch của repo không phải `main` (là một nhánh `claude/*`), nên các tag `v1.8.26`–`v1.8.56` bị GitHub gắn vào **commit ngoài main** (vd commit "Document online quiz…"), không phải commit bump version.

- **File `.exe` đính kèm mỗi Release vẫn ĐÚNG & chạy được** — chỉ "Source code (zip)" trên trang Release là trỏ sai.
- **Commit nguồn ĐÚNG của từng bản = commit `chore: bump version to vX` trên `main`.** Bản đang dùng thật: **v1.8.56 = `13a9b25`** (xem bảng đầu file).
- Đã sửa workflow (`target_commitish` trỏ commit bump trên main) → **từ v1.8.57 trở đi tag tự trỏ đúng.**
- Quyết định (11/08/2026): **giữ nguyên tag cũ** (phương án pragmatic) — không rollback theo tag cũ; nếu cần checkout source bản cũ thì dùng commit bump tương ứng trên `main`, không dùng tag.

## Cách lấy thông tin điền bảng
- **Version/Release:** xem tag Release mới nhất trên GitHub, hoặc số version ở header app (bấm để xem lịch sử).
- **Commit:** `git log -1 --oneline` tại thời điểm build (hoặc dòng cuối trong Release).
