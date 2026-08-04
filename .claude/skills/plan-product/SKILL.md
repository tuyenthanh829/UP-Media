---
name: plan-product
description: >-
  Khung lên KẾ HOẠCH & CHIẾN LƯỢC triển khai bất kỳ SẢN PHẨM nào trước khi bắt
  tay làm — phần mềm (desktop/web/mobile), API/backend, công cụ AI/agent, tự
  động hóa/dữ liệu, nội dung/marketing, thiết kế, khóa học, phần cứng/IoT...
  Giúp làm ra đúng thứ cần, đúng thứ tự, rủi ro thấp. DÙNG SKILL NÀY ngay khi
  bắt đầu một sản phẩm/tính năng mới, khi yêu cầu còn mơ hồ hoặc lớn, khi cần
  chọn giữa nhiều hướng, hoặc khi người dùng nói "lên kế hoạch", "chiến lược",
  "nên làm thế nào", "tư vấn phương án", "thiết kế", "roadmap", "bắt đầu dự án",
  "phân tích yêu cầu". Chạy TRƯỚC khi thực thi; duyệt xong mới triển khai.
---

# SKILL: Lên kế hoạch & chiến lược triển khai sản phẩm (mọi loại hình)

Mục tiêu: biến một yêu cầu (thường mơ hồ hoặc lớn) thành **kế hoạch rõ ràng, phân
luồng, có khuyến nghị và điểm quyết định**. Áp dụng cho MỌI loại sản phẩm, không
chỉ phần mềm. KHÔNG bắt tay thực thi phần lớn/khó đảo ngược trước khi qua khung này.

## NGUYÊN TẮC LÕI (đúng cho mọi sản phẩm)

1. **Hiểu trước, làm sau.** Bám vào KẾT QUẢ người dùng thật sự muốn, không phải
   chỉ giải pháp họ nghĩ ra. Hỏi "để làm gì / đo lường thành công thế nào".
2. **Trung thực về giới hạn.** Nói rõ cái làm được, cái không, cái không kiểm
   chứng được ở đây. Không hứa chắc khi chưa chắc.
3. **Giá trị/công sức trước.** Làm cái chắc chắn + giá trị cao trước; để phần
   fragile/rủi ro/phụ thuộc bên ngoài về sau.
4. **Quyết định là của người dùng.** Gặp ngã rẽ thật (đánh đổi tiền/thời gian/độ
   bền/phạm vi) → đưa phương án + khuyến nghị rồi để họ chọn.
5. **Nhỏ và kiểm chứng được.** Chia thành đơn vị giao được, mỗi đơn vị tự nghiệm
   thu; ưu tiên có "bản chạy được sớm" hơn là hoàn hảo muộn.

## QUY TRÌNH 6 BƯỚC

### Bước 1 — PHÂN LOẠI & LÀM RÕ
- Loại việc: **Nghiên cứu/Tư vấn** (chưa thực thi, cần đề xuất) hay **Triển khai**.
- Xác định **loại sản phẩm** (xem bảng "Theo loại sản phẩm" bên dưới) để biết
  rủi ro, khâu khó và "đầu ra" đặc thù.
- Chốt tối thiểu: **Mục tiêu** (kết quả + cách đo thành công), **Đối tượng/người
  dùng**, **Ràng buộc** (nền tảng, ngân sách, thời hạn, pháp lý/bảo mật, thương
  hiệu), **Định nghĩa "xong"** (nghiệm thu).
- Chỉ hỏi khi câu trả lời làm ĐỔI kế hoạch. Việc có mặc định hợp lý thì tự quyết
  và nói rõ đã chọn gì.

### Bước 2 — ĐÁNH GIÁ KHẢ THI & RỦI RO
- Mỗi hướng: khả thi trong ràng buộc? Chỗ nào **dễ vỡ**? Chỗ nào **không tự kiểm
  chứng được** (phụ thuộc OS/phần cứng/dịch vụ ngoài/duyệt bên thứ ba/ngân sách)?
- Nêu rủi ro THẲNG + cách giảm thiểu (thêm chẩn đoán, làm bản thử, chia nhỏ,
  chuẩn bị phương án B).
- Nếu hướng đang bị "bịt" (API deprecated, chính sách chặn, hết vòng đời) → cảnh
  báo sớm, tránh ngõ cụt.

### Bước 3 — SO SÁNH PHƯƠNG ÁN (khi có ngã rẽ)
- Bảng 2–4 phương án: **cách làm · ưu · nhược · công sức · độ tin cậy/bền**.
- Đưa **1 khuyến nghị rõ ràng** kèm lý do (không liệt kê trung lập).
- Dùng **AskUserQuestion** để chốt khi lựa chọn ảnh hưởng tiền/thời gian/kiến
  trúc/độ bền. Option khuyến nghị để đầu, ghi "(khuyến nghị)".

### Bước 4 — CHIA GIAI ĐOẠN (roadmap)
- Bẻ nhỏ theo **ROI giảm dần** và **phụ thuộc**. Xác định "lát cắt mỏng chạy
  được sớm" (MVP) để có phản hồi nhanh.
- Mỗi hạng mục: mô tả ngắn · **đầu ra cụ thể** · **công sức ước lượng** · **rủi ro**.
- "Làm A trước, B sau" khi B fragile hoặc phụ thuộc A. Mỗi hạng mục lớn là 1 đơn
  vị giao/kiểm thử riêng.

### Bước 5 — CHỐT KẾ HOẠCH ĐỂ DUYỆT
- Tổng hợp gọn: mục tiêu → phương án chọn → giai đoạn → thứ tự → nghiệm thu →
  phần người dùng cần làm → phần chưa kiểm chứng được.
- Nếu ở plan mode: dùng ExitPlanMode trình kế hoạch xin duyệt.
- Chưa duyệt thì KHÔNG thực thi phần lớn/khó đảo ngược.

### Bước 6 — CHUYỂN GIAO THỰC THI
- Duyệt xong → chuyển sang quy trình/skill triển khai phù hợp với loại sản phẩm
  (ví dụ skill phát hành riêng của dự án, hoặc quy trình build/deploy tương ứng).
- Giữ ghi chú: mỗi giai đoạn xong cập nhật trạng thái, báo rõ đã làm gì / còn gì
  / cần kiểm thử gì.

## THEO LOẠI SẢN PHẨM — điều cần chú ý riêng ở khâu kế hoạch

| Loại sản phẩm | Khâu khó / rủi ro hay gặp | "Đầu ra" & nghiệm thu điển hình |
|---|---|---|
| **Phần mềm desktop (.exe, Electron…)** | Đóng gói, quyền hệ điều hành, tương thích phiên bản OS/nền tảng bên thứ ba, khó test trên môi trường khác | File cài đặt chạy được trên máy đích + checklist thao tác |
| **Web app / website** | Trạng thái/logic, responsive, hiệu năng, SEO, tương thích trình duyệt | URL chạy được + luồng chính hoạt động |
| **Mobile app** | Store review, quyền, khác biệt iOS/Android, offline | Bản build cài thử được + đạt guideline store |
| **API / backend / automation** | Hợp đồng dữ liệu, lỗi biên, idempotency, bảo mật/khóa, rate limit | Endpoint/luồng chạy + test case + tài liệu dùng |
| **Công cụ AI / agent / tích hợp** | Ranh giới năng lực mô hình, prompt/tool design, chi phí token, dữ liệu không tin cậy | Kịch bản mẫu chạy đúng + xử lý ca lỗi |
| **Dữ liệu / phân tích / báo cáo** | Chất lượng nguồn, định nghĩa chỉ số, tái lập được | Số liệu/biểu đồ đúng + cách tính minh bạch |
| **Nội dung / marketing / thiết kế / khóa học** | Đúng đối tượng & thông điệp, nhất quán thương hiệu, đo hiệu quả | Bản thảo/thiết kế/giáo trình + tiêu chí đánh giá |
| **Phần cứng / IoT** | Chi phí linh kiện, sai số thực địa, an toàn, không mô phỏng hết được | Nguyên mẫu + kịch bản kiểm thử thực tế |

> Nếu loại sản phẩm nằm ngoài bảng: vẫn theo 6 bước, tự nêu 2–3 rủi ro đặc thù và
> "đầu ra nghiệm thu" tương ứng.

## MẪU TRÌNH BÀY KẾ HOẠCH (dùng khi phản hồi)

```
## Mục tiêu (kết quả + cách đo thành công)
<...>

## Loại sản phẩm & ràng buộc / rủi ro chính
- <nền tảng · ngân sách · thời hạn · pháp lý/bảo mật · cái không kiểm chứng được>

## Phương án
| Cách | Ưu | Nhược | Công sức | Độ tin cậy |
|------|----|-------|----------|------------|
...
→ Khuyến nghị: <phương án + lý do>

## Lộ trình
- Giai đoạn 1 (làm trước, giá trị cao/chắc): <...> — ~<công sức>
- Giai đoạn 2: <...>
- (Để sau / không nên: <...>)

## Cần bạn quyết
<1 câu hỏi rõ ràng, hoặc "đã có mặc định, làm luôn nếu đồng ý">
```

## CỜ ĐỎ CẦN DỪNG LẠI HỎI

- Việc **khó đảo ngược / hướng ra ngoài** (xóa dữ liệu, publish, đụng tài khoản
  thật, phát sinh chi phí) → xác nhận trước.
- Yêu cầu **lớn/nhiều nhánh** chưa rõ ưu tiên → chốt phạm vi & thứ tự trước.
- Giải pháp **phụ thuộc yếu tố ngoài tầm** (trả phí, dịch vụ bên thứ ba, duyệt
  store, môi trường không test được) → nêu điều kiện + rủi ro trước khi cam kết.

## CHECKLIST TRƯỚC KHI RỜI KHÂU KẾ HOẠCH

- [ ] Rõ mục tiêu + cách đo thành công + định nghĩa "xong"?
- [ ] Đã nhận diện loại sản phẩm + rủi ro & phần không kiểm chứng được?
- [ ] Đã so sánh phương án + đưa khuyến nghị (nếu có ngã rẽ)?
- [ ] Đã chia giai đoạn theo ROI + phụ thuộc, có lát cắt chạy sớm?
- [ ] Đã chốt điểm quyết định với người dùng?
