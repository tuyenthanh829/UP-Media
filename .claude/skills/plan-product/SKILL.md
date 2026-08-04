---
name: plan-product
description: >-
  Khung lên KẾ HOẠCH & CHIẾN LƯỢC triển khai một sản phẩm/tính năng trước khi
  code, giúp Claude Code làm việc mạch lạc, giảm rủi ro và làm ra thứ đúng ý.
  DÙNG SKILL NÀY ngay khi bắt đầu một sản phẩm/tính năng mới, khi yêu cầu còn
  mơ hồ hoặc lớn, khi cần chọn giữa nhiều hướng kỹ thuật, hoặc khi người dùng
  nói "lên kế hoạch", "chiến lược", "nên làm thế nào", "tư vấn phương án",
  "thiết kế", "roadmap", "bắt đầu dự án", "phân tích yêu cầu". Chạy TRƯỚC khi
  viết code; sau khi kế hoạch được duyệt mới chuyển sang triển khai.
---

# SKILL: Lên kế hoạch & chiến lược triển khai sản phẩm

Mục tiêu: biến một yêu cầu (thường mơ hồ hoặc lớn) thành **kế hoạch rõ ràng, phân
luồng, có khuyến nghị và điểm quyết định** — để làm đúng thứ cần làm, đúng thứ tự,
với rủi ro thấp nhất. KHÔNG nhảy vào code trước khi qua khung này.

## NGUYÊN TẮC LÕI

1. **Hiểu trước, làm sau.** Không suy diễn yêu cầu; làm rõ mục tiêu thật sự
   (người dùng muốn KẾT QUẢ gì, không phải chỉ giải pháp họ nghĩ ra).
2. **Trung thực về giới hạn.** Nói rõ cái gì làm được, cái gì không, cái gì
   không test được ở môi trường hiện tại. Không hứa "sẽ chạy" khi chưa chắc.
3. **Giá trị/công sức trước.** Ưu tiên việc chắc chắn + giá trị cao; để việc
   fragile/rủi ro về sau.
4. **Quyết định là của người dùng.** Khi có ngã rẽ thật sự (đánh đổi tiền/thời
   gian/độ bền), đưa phương án + khuyến nghị rồi để họ chọn — đừng tự quyết thay.

## QUY TRÌNH 6 BƯỚC

### Bước 1 — PHÂN LOẠI & LÀM RÕ
- Xác định loại việc: **Nghiên cứu/Tư vấn** (chưa code, cần đề xuất) hay
  **Triển khai** (đã rõ, code luôn).
- Làm rõ tối thiểu trước khi lập kế hoạch: **Mục tiêu** (kết quả mong muốn),
  **Người dùng cuối**, **Ràng buộc** (nền tảng, hiệu năng, bảo mật, thương hiệu),
  **Định nghĩa "xong"** (nghiệm thu thế nào).
- Chỉ hỏi khi câu trả lời làm ĐỔI kế hoạch. Việc có mặc định hợp lý thì tự quyết
  và nói rõ mình đã chọn gì.

### Bước 2 — ĐÁNH GIÁ KHẢ THI & RỦI RO
- Với mỗi hướng: nó có khả thi trong ràng buộc không? Chỗ nào **dễ vỡ**? Chỗ nào
  **không tự test được** (ví dụ tính năng phụ thuộc OS/phần cứng/dịch vụ ngoài)?
- Nêu rủi ro THẲNG trong kế hoạch, kèm cách giảm thiểu (thêm chẩn đoán, chia nhỏ,
  làm bản thử nghiệm trước).
- Nếu một hướng đang bị nền tảng "bịt" (ví dụ API bị deprecated) → cảnh báo sớm,
  đừng đầu tư vào ngõ cụt.

### Bước 3 — SO SÁNH PHƯƠNG ÁN (khi có ngã rẽ)
- Trình bày 2–4 phương án dạng bảng: **cách làm · ưu · nhược · công sức · độ tin cậy**.
- Đưa **1 khuyến nghị rõ ràng** kèm lý do (không chỉ liệt kê trung lập).
- Dùng **AskUserQuestion** để chốt hướng khi lựa chọn ảnh hưởng tiền/thời
  gian/kiến trúc/độ bền. Option khuyến nghị để đầu, ghi "(khuyến nghị)".

### Bước 4 — CHIA GIAI ĐOẠN (roadmap)
- Bẻ nhỏ thành các giai đoạn/tính năng độc lập, xếp theo **ROI giảm dần** và
  **phụ thuộc kỹ thuật**.
- Với mỗi hạng mục: mô tả ngắn, **thay đổi dữ liệu/UI cần có**, **công sức ước
  lượng** (ngày/buổi), **rủi ro**.
- Ưu tiên "làm A trước, B sau" khi B fragile hoặc phụ thuộc A. Mỗi tính năng lớn
  nên là 1 đơn vị commit/kiểm thử riêng.

### Bước 5 — CHỐT KẾ HOẠCH ĐỂ DUYỆT
- Tổng hợp thành kế hoạch gọn: mục tiêu → phương án chọn → các giai đoạn → thứ tự
  → tiêu chí nghiệm thu → phần cần người dùng làm (nếu có) → phần chưa test được.
- Nếu đang ở plan mode: dùng ExitPlanMode để trình kế hoạch xin duyệt.
- Chưa được duyệt thì KHÔNG bắt đầu code phần gây thay đổi lớn/khó đảo ngược.

### Bước 6 — CHUYỂN GIAO SANG TRIỂN KHAI
- Khi duyệt xong: chuyển sang skill/quy trình triển khai (ví dụ `ship-upmedia`
  cho repo này) theo đúng thứ tự giai đoạn đã chốt.
- Giữ ghi chú: mỗi giai đoạn xong cập nhật trạng thái + changelog, báo rõ đã
  làm gì, còn gì, cần test gì.

## MẪU TRÌNH BÀY KẾ HOẠCH (dùng khi phản hồi người dùng)

```
## Mục tiêu
<kết quả người dùng thật sự muốn>

## Ràng buộc & rủi ro chính
- <nền tảng / bảo mật / cái không test được>

## Phương án
| Cách | Ưu | Nhược | Công sức | Độ tin cậy |
|------|----|-------|----------|------------|
...
→ Khuyến nghị: <phương án + lý do>

## Lộ trình (nếu triển khai)
- Giai đoạn 1 (làm trước): <...> — ~<công sức>
- Giai đoạn 2: <...>
- (Để sau/không nên: <...>)

## Cần anh quyết
<1 câu hỏi rõ ràng, hoặc "đã có mặc định, em làm luôn nếu anh đồng ý">
```

## CỜ ĐỎ CẦN DỪNG LẠI HỎI

- Việc **hard-to-reverse / hướng ra ngoài** (xóa dữ liệu, publish, đụng tài khoản
  thật, chi phí tiền) → xác nhận trước.
- Yêu cầu **lớn/nhiều nhánh** mà chưa rõ ưu tiên → chốt phạm vi & thứ tự trước.
- Giải pháp **phụ thuộc yếu tố ngoài tầm** (tài khoản trả phí, dịch vụ bên thứ ba,
  môi trường không test được) → nêu rõ điều kiện + rủi ro trước khi cam kết.

## CHECKLIST TRƯỚC KHI RỜI KHÂU KẾ HOẠCH

- [ ] Đã rõ mục tiêu + định nghĩa "xong"?
- [ ] Đã nêu rủi ro & phần không test được?
- [ ] Đã so sánh phương án + đưa khuyến nghị (nếu có ngã rẽ)?
- [ ] Đã chia giai đoạn theo ROI + phụ thuộc?
- [ ] Đã chốt điểm quyết định với người dùng?
