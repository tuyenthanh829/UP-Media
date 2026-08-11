# Chrome Web Store Listing

## Thông tin production

- **Name:** UP Media - Cookie Facebook
- **Extension ID:** `bkdigiggjmpomfoeafbbgpipjennbhen`
- **Visibility:** Unlisted / Không công khai
- **Category gợi ý:** Productivity
- **Language:** Tiếng Việt
- **Icon:** 128×128
- **Screenshot:** tối thiểu 1280×800

## Detailed description

```text
UP Media - Cookie Facebook là công cụ nội bộ hỗ trợ nhân sự được ủy quyền quản lý phiên đăng nhập Facebook của chính agency.

Chức năng chính:
• Hiển thị số lượng cookie Facebook và UID đang đăng nhập.
• Đọc và xuất cookie Facebook theo định dạng chuỗi hoặc JSON.
• Sao chép cookie vào clipboard theo yêu cầu của người dùng.
• Nhập cookie của tài khoản agency được ủy quyền để khôi phục phiên đăng nhập.

Extension chỉ truy cập cookie trên facebook.com và messenger.com. Dữ liệu được xử lý cục bộ trên thiết bị, không được gửi tới máy chủ của nhà phát triển, không bán, không chia sẻ và không dùng cho quảng cáo.

Cookie có giá trị tương đương thông tin đăng nhập. Người dùng chỉ được sử dụng extension với tài khoản thuộc quyền sở hữu hoặc được agency cho phép quản lý.
```

## Single purpose

```text
Cho phép nhân sự được ủy quyền đọc, sao chép và nhập cookie Facebook/Messenger của tài khoản agency nhằm quản lý và khôi phục phiên đăng nhập trên thiết bị của chính người dùng.
```

## Permission justification: cookies

```text
Quyền cookies được sử dụng để đọc cookie Facebook/Messenger đang có trong trình duyệt, bao gồm cookie httpOnly, và ghi cookie khi người dùng chủ động sử dụng chức năng nhập phiên đăng nhập. Đây là chức năng cốt lõi duy nhất của extension.
```

## Host permissions justification

```text
Quyền truy cập chỉ giới hạn ở facebook.com và messenger.com để đọc hoặc ghi cookie phục vụ quản lý phiên đăng nhập. Extension không truy cập website ngoài hai miền này.
```

## Test instructions for reviewer

```text
No external account or server is required.

1. Install the extension.
2. Open its toolbar popup.
3. The popup displays the number of Facebook cookies available in the current Chrome profile.
4. Click “Lấy cookie” to display cookies locally in the text area.
5. Click “Copy” to copy the displayed value to the clipboard.
6. The import function accepts a cookie string or Cookie-Editor JSON and writes it only to facebook.com.

All authentication data is processed locally. No data is transmitted to the developer or third parties.
```

## Quy tắc cập nhật Store

- Luôn upload package vào item hiện tại; không chọn New item.
- Mô tả phải khớp với chức năng thật trong source.
- Nếu thay đổi permission hoặc data handling, cập nhật listing và privacy trước khi Submit for Review.
- Không cung cấp cookie hoặc tài khoản Facebook thật cho reviewer.
