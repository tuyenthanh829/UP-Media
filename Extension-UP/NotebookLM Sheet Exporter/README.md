# NotebookLM Sheet Exporter

Chrome extension de doc quiz do NotebookLM sinh ra tu `data-app-data` va xuat thanh TSV/CSV de dan vao Google Sheets.

## Cach cai dat local

1. Mo `chrome://extensions`.
2. Bat `Developer mode`.
3. Chon `Load unpacked`.
4. Chon thu muc `extension`.

## Cach dung

1. Mo notebook tren `https://notebooklm.google.com`.
2. Mo panel `Studio > Ung dung` co bo cau hoi/trac nghiem va doi quiz tai xong.
3. Bam icon extension.
4. Chon `Auto scan all`.
5. Kiem tra preview.
6. Chon `Copy & open Google Sheets` de copy TSV va mo trang tinh moi, sau do chon o A1 va dan vao. Co the dung `Download CSV` hoac `Copy TSV` neu muon xuat thu cong.

## Cot du lieu xuat ra

- `STT`
- `Câu hỏi`
- `Phương án A`
- `Phương án B`
- `Phương án C`
- `Phương án D`
- `Đáp án đúng`
- `Giải thích A`
- `Giải thích B`
- `Giải thích C`
- `Giải thích D`
- `Gợi ý`

## Ghi chu ky thuat

NotebookLM dat quiz trong iframe `usercontent.goog` va iframe `blob:` ben trong. Extension dung content script `all_frames` + `match_origin_as_fallback` de frame nao doc duoc `<app-root data-app-data>` thi parse JSON va gui ket qua ve popup. Extension chi lay app co mang `quiz`/`questions` va tung cau co `answerOptions`, bo qua cac app/output khac cung co `data-app-data`.
