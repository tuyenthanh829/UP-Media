# Extension UP Media Chrome Store

Tài liệu và source snapshot của extension **UP Media - Cookie Facebook** đã được Chrome Web Store duyệt.

> **SOURCE OF TRUTH — PRODUCTION.** Khi thay đổi extension, phải cập nhật đồng thời source, tài liệu trong thư mục này và [trang Notion Source of Truth](https://app.notion.com/p/3b9ac0980c4a8125a5b0f5fd8552a74b?pvs=204).

## Trạng thái đã xác nhận

| Trường | Giá trị |
|---|---|
| Tên Store | UP Media - Cookie Facebook |
| Extension ID | `bkdigiggjmpomfoeafbbgpipjennbhen` |
| Chrome Web Store | Published |
| Visibility | Unlisted / Không công khai |
| Manifest version | 1.1.0 |
| Chrome Manager đã nghiệm thu | v1.8.49 |
| Developer account | Đã đăng ký và thanh toán phí 5 USD |
| Ngày item được tạo | 04/08/2026 |
| Ngày xác nhận production | 11/08/2026 |
| Owner | Tuyền Thanh / UP Media |

Extension ID là ID công khai của Store, không phải mật khẩu. Tuyệt đối không commit cookie hay thông tin đăng nhập thật.

## Cấu trúc

```text
Extension UP Media Chrome Store/
├── README.md
├── CHANGELOG.md
├── extension-metadata.json
├── extension-source/
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── docs/
    ├── STORE_LISTING.md
    ├── PRIVACY_POLICY.md
    └── INSTALLATION_AND_UPGRADE.md
```

## Kiến trúc cài hàng loạt

```text
Chrome Manager
  → lưu Web Store Extension ID
  → ExtensionInstallForcelist
  → Chrome Web Store update service
  → tất cả Chrome profile dùng chung policy máy nhận extension
```

- Update URL: `https://clients2.google.com/service/update2/crx`.
- Chrome Manager ghi policy HKLM, HKCU và WOW6432Node, sau đó đọc lại để xác minh.
- Policy được lưu tích lũy trong `config.json`; không được làm mất ID extension khác.
- Không dùng `--load-extension`, CDP hoặc localhost self-hosted CRX cho luồng production.

## Vị trí tích hợp trong Chrome Manager

Mã tích hợp production nằm trên nhánh `main`:

- `chrome-shortcut-manager/assets/fb-cookie-extension/`
- `chrome-shortcut-manager/main.js`
  - `zip-cookie-extension`
  - `save-cookie-store-id`
  - `copy-extension-to-all`
  - `clear-ext-policy-entry`
- `chrome-shortcut-manager/preload.js`
- `chrome-shortcut-manager/src/extensions.js`
- `chrome-shortcut-manager/src/configStore.js`
- `chrome-shortcut-manager/renderer/`

Commit nền tảng Web Store ban đầu: `b283131 feat: force-install Facebook cookie extension via Web Store`.

`extension-source/` trong thư mục này là bản đồng bộ để bảo trì Store. Khi thay đổi, phải đồng bộ lại với `chrome-shortcut-manager/assets/fb-cookie-extension/` trên `main`.

## Chức năng extension

- Hiển thị số cookie Facebook và UID từ `c_user`.
- Đọc cookie Facebook, kể cả `httpOnly`.
- Xuất chuỗi `name=value` hoặc JSON tương thích Cookie-Editor.
- Sao chép cookie vào clipboard theo thao tác người dùng.
- Nhập cookie của tài khoản agency được ủy quyền và ghi lại lên Facebook.
- Chỉ có quyền `cookies` và host permissions cho `facebook.com`, `messenger.com`.

## Quy tắc bắt buộc cho AI/dev

1. Không tạo Web Store item mới khi nâng cấp.
2. Không thay Extension ID.
3. Mỗi package mới phải tăng `manifest.version`.
4. Không thêm permission nếu không phục vụ trực tiếp tính năng người dùng.
5. Nếu đổi quyền hoặc cách xử lý dữ liệu, phải cập nhật Store Listing, Privacy practices, Privacy Policy và Notion.
6. Không lưu cookie, token, mật khẩu, tài khoản thật hoặc log chứa dữ liệu phiên.
7. Sau mỗi bản phát hành, nghiệm thu trên ít nhất hai Chrome profile.
8. Ghi lại version, ngày publish, commit và kết quả test trong `CHANGELOG.md`.

## Tài liệu

- [Store Listing và hướng dẫn reviewer](./docs/STORE_LISTING.md)
- [Privacy Policy và khai báo dữ liệu](./docs/PRIVACY_POLICY.md)
- [Cài đặt, gỡ và nâng cấp](./docs/INSTALLATION_AND_UPGRADE.md)
- [Nhật ký thay đổi](./CHANGELOG.md)
- [Notion Source of Truth](https://app.notion.com/p/3b9ac0980c4a8125a5b0f5fd8552a74b?pvs=204)
