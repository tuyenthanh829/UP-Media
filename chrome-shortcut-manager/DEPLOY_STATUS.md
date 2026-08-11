# TRẠNG THÁI TRIỂN KHAI — Chrome Manager by UP Media

> Ghi lại bản nào ĐÃ CÀI & NGHIỆM THU trên máy thật. Cập nhật file này **mỗi lần cài bản mới** để phân biệt "đã build trên CI" (repo/Release) với "đã dùng thật" (máy owner).
> Bản mới nhất trên repo/Release **không đồng nghĩa** đã được nghiệm thu.

## Bản đang dùng thật tại UP Media

| Ngày cài | Version | Commit | Release | Máy | Người nghiệm thu | Kết quả |
|----------|---------|--------|---------|-----|------------------|---------|
| _(chưa ghi)_ | v1.8.49 | _(n/a)_ | v1.8.49 | Máy owner | Tuyen Thanh | ✅ Đã dùng để force-install cookie extension (Web Store ID) thành công |
| _(điền)_ | v1.8.54 / v1.8.55 | _(điền)_ | _(điền)_ | _(điền)_ | _(điền)_ | ⏳ CHƯA xác nhận đã cài & nghiệm thu |

## Hạng mục cần nghiệm thu trên Windows thật (bản v1.8.50 → v1.8.55)

Đánh dấu `[x]` khi đã test đạt trên máy thật:

- [ ] Tự nâng quyền Administrator (UAC hiện lên, chọn Yes → app chạy elevated; chọn No → vẫn chạy thường)
- [ ] Gõ tiếng Việt (Unikey) ổn định khi app chạy quyền Admin
- [ ] Toàn bộ phím tắt: Ctrl+F/N/O/G/T/L/Q/R/D, Ctrl+~, Esc
- [ ] Chống mở trùng Chrome (mở sẵn profile → quét lại / mở lại KHÔNG mở cửa sổ trùng)
- [ ] Typeahead nhóm/danh mục con (gõ để lọc + tạo mới, đồng bộ sidebar)
- [ ] Bấm vùng trắng thẻ để mở Chrome
- [ ] Menu "Chức năng" (Tạo shortcut / Tối ưu dung lượng / Đóng Chrome)
- [ ] 2 icon header (Phím tắt hover popover + Tiện ích UP Media mở link Store)
- [ ] Copy/Dán trong ô cookie vẫn hoạt động (sau khi rút gọn menu app)
- [ ] Luồng nhập tiện ích ngoài store (self-host CRX) — nếu còn dùng

## Cách lấy thông tin điền bảng
- **Version/Release:** xem tag Release mới nhất trên GitHub, hoặc số version ở header app (bấm để xem lịch sử).
- **Commit:** `git log -1 --oneline` tại thời điểm build (hoặc dòng cuối trong Release).
