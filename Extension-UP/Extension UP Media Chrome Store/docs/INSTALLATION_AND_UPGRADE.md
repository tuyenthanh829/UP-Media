# Cài đặt, gỡ và nâng cấp

## Cài hàng loạt bằng Chrome Manager

### Điều kiện

- Store item đang Published.
- Extension ID: `bkdigiggjmpomfoeafbbgpipjennbhen`.
- Chrome Manager by UP Media v1.8.49 hoặc mới hơn có Web Store policy.

### Thao tác

1. Mở Chrome Manager → **Cài đặt**.
2. Dán Extension ID.
3. Bấm **Cài cookie cho tất cả Chrome**.
4. Xác nhận UI hiển thị **Đang ép cài** cùng đúng ID.
5. Đóng hẳn mọi tiến trình Chrome, kể cả Chrome trong khay hệ thống.
6. Mở lại Chrome.
7. Vào `chrome://extensions`; kiểm tra extension có nhãn Installed by enterprise policy/Được cài đặt bởi quản trị viên.
8. Nghiệm thu trên ít nhất hai profile.

Nếu extension chưa xuất hiện, mở `chrome://policy`, bấm **Reload policies**, sau đó đóng/mở lại Chrome. Nếu Chrome Manager không ghi được registry, chạy bằng **Run as administrator**.

## Gỡ khỏi tất cả Chrome

1. Mở Chrome Manager → Cài đặt.
2. Bấm **Gỡ cookie khỏi tất cả Chrome**.
3. Đóng hẳn Chrome rồi mở lại.
4. Kiểm tra ít nhất hai profile.

Không xóa hoặc unpublish Store item chỉ để gỡ extension trên một máy; hãy gỡ policy trên máy đó.

## Tạo ZIP cho Chrome Web Store

Từ Chrome Manager:

1. Cài đặt → **Đóng gói extension (.zip)**.
2. Nhận `fb-cookie-extension.zip` trên Desktop.
3. Xác nhận `manifest.json` nằm ngay root của ZIP.

Có thể nén trực tiếp nội dung `extension-source/`, nhưng không được bọc cả folder `extension-source` bên ngoài package.

## Quy trình nâng cấp Store

1. Kiểm tra version Published hiện tại trên Developer Dashboard.
2. Pull code mới nhất của cả nhánh tích hợp `main` và nhánh chứa `Extension-UP`.
3. Sửa source extension.
4. Đồng bộ nội dung giữa:
   - `Extension-UP/Extension UP Media Chrome Store/extension-source/`
   - `chrome-shortcut-manager/assets/fb-cookie-extension/` trên `main`.
5. Tăng `version` trong `manifest.json`; không được giảm version.
6. Chạy kiểm tra:
   - `node --check popup.js`.
   - Manifest JSON hợp lệ, `manifest_version: 3`.
   - Icon 16/48/128 tồn tại.
   - ZIP có `manifest.json` tại root.
   - Lấy, Copy và Nhập cookie hoạt động trên profile thử nghiệm được ủy quyền.
7. Mở item **UP Media - Cookie Facebook** hiện tại trên Dashboard.
8. Upload package mới; **không bấm New item**.
9. Rà lại Store Listing, Privacy practices và Test instructions.
10. Submit for Review.
11. Sau khi Published, đóng/mở Chrome và nghiệm thu hai profile.
12. Cập nhật `extension-metadata.json`, `CHANGELOG.md` và [Notion Source of Truth](https://app.notion.com/p/3b9ac0980c4a8125a5b0f5fd8552a74b?pvs=204).

## Rollback khi bản mới lỗi

- Chrome Web Store không cho upload version thấp hơn để downgrade.
- Sửa lỗi và phát hành một manifest version cao hơn.
- Nếu cần dừng ngay trên một máy, gỡ ID khỏi policy bằng Chrome Manager.
- Chỉ unpublish item sau khi đã đánh giá tác động đến mọi máy đang force-install.

## Checklist nghiệm thu mỗi bản

- [ ] Manifest version lớn hơn bản Published trước.
- [ ] Source trong hai nhánh/thư mục khớp nhau.
- [ ] `node --check popup.js` thành công.
- [ ] ZIP đúng cấu trúc.
- [ ] Store status = Published.
- [ ] Profile 1 nhận bản mới.
- [ ] Profile 2 nhận bản mới.
- [ ] Privacy disclosures vẫn khớp mã nguồn.
- [ ] Changelog và Notion đã cập nhật.
