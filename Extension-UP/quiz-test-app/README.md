# Quiz Test Center

Web app noi bo de nhap TSV tu extension NotebookLM, cho nhan su lam bai co bo dem thoi gian, cham diem tren thang 100 va luu ket qua dung/sai.

## Chay app

```powershell
cd D:\Vibe-coding\Codex\Extension-UP\quiz-test-app
npm start
```

Hoac double-click `start-quiz-test.bat`.

Mo trinh duyet tai:

```text
http://localhost:5175
```

## Cach dung

1. Vao tab `Tao de`.
2. Dan TSV 12 cot tu extension vao o TSV.
3. Nhap ten bai test va thoi gian lam bai.
4. Bam `Luu bai test`.
5. Copy link trong danh sach de de gui cho nhan su, hoac nhan su vao tab `Lam bai` va chon de.
6. Nhan su nhap ho ten/ma nhan su, bam `Bat dau lam bai`.
7. Het gio app tu nop bai. Neu nop som, bam `Nop bai`.
8. Vao tab `Ket qua` de xem diem, dung/sai tung cau, hoac bam `Tai Excel` / `Tai CSV`.

Neu dang mo server san va vua cap nhat code, dong cua so terminal dang chay `Quiz test app running...`, sau do chay lai `npm start` hoac double-click `start-quiz-test.bat`.

## Luu tru

- De test: `data/quizzes.json`
- Ket qua: `data/results.json`

Diem duoc tinh tren server:

```text
score = correct_count / total_questions * 100
```

Ket qua moi luu: ten, ma nhan su, bai test, thoi gian nop, tong cau, so cau dung, diem va chi tiet dung/sai tung cau.
