# Online Quiz Test Deployment Plan

## Trang thai hien tai

Project da duoc day len GitHub:

- Repository: `https://github.com/tuyenthanh829/UP-Media`
- Branch: `claude/loving-cray-5zvqhg`
- Commit: `459934c Add NotebookLM quiz exporter and test app`
- Thu muc project trong repo: `Extension-UP/`

Luu y bao mat:

- `Extension-UP/quiz-test-app/data/quizzes.json` da duoc reset ve `[]` truoc khi push.
- `Extension-UP/quiz-test-app/data/results.json` da duoc reset ve `[]` truoc khi push.
- Khong day du lieu de that hoac ket qua nhan su len public GitHub.

## Thanh phan da co

### Chrome extension

Thu muc:

```text
Extension-UP/extension
```

Chuc nang:

- Lay quiz tu Google NotebookLM thong qua `<app-root data-app-data>`.
- Ho tro iframe/blob cua NotebookLM bang content script MV3.
- Xuat TSV 12 cot:
  - `STT`
  - `Cau hoi`
  - `Phuong an A-D`
  - `Dap an dung`
  - `Giai thich A-D`
  - `Goi y`

### Quiz test app local

Thu muc:

```text
Extension-UP/quiz-test-app
```

Chuc nang:

- Admin dan TSV de tao de test.
- Nhan su chon de, nhap ten/ma nhan su va lam bai.
- Co bo dem thoi gian.
- Het gio tu nop.
- Server cham diem theo cong thuc:

```text
score = correct_count / total_questions * 100
```

- Luu ket qua dung/sai tung cau.
- Xuat CSV va Excel-compatible `.xls`.

Chay local:

```powershell
cd D:\Vibe-coding\Codex\Extension-UP\quiz-test-app
npm start
```

Mo:

```text
http://localhost:5175
```

## Nhu cau tiep theo

Can dua bai test len online de nhan su truy cap bang mot duong link cong khai/noi bo, dang nhap, chon de va lam bai.

Admin can co cach day data de len nhanh gon, khong phu thuoc file JSON local.

## Kien truc de xuat nhanh gon

Khuyen nghi:

- Host app: **Render Web Service**
- Database: **Supabase Postgres**
- Login/Auth: **Supabase Auth**
- Data quiz/result: **Supabase**, khong dung `data/*.json` khi chay online.

Ly do:

- Render deploy truc tiep tu GitHub va cap URL online dang `*.onrender.com`.
- Supabase co san Postgres + Auth + dashboard de xem data.
- Khong can tu van hanh server/database phuc tap.
- Phu hop MVP nhanh cho HR/admin.

## Luong online de xuat

1. Admin vao link online, vi du:

```text
https://upmedia-quiz.onrender.com
```

2. Admin dang nhap.
3. Admin vao tab `Tao de`.
4. Admin paste TSV tu extension hoac upload file TSV.
5. Server parse TSV va luu vao Supabase.
6. Nhan su dang nhap hoac nhap ma nhan su theo cau hinh.
7. Nhan su chon de test dang active.
8. Nhan su lam bai co timer.
9. Nop bai hoac het gio tu nop.
10. Server cham diem va luu ket qua vao Supabase.
11. Admin vao tab `Ket qua`, loc theo de/nhan su va tai Excel.

## Schema database de xuat

```sql
profiles
- id uuid primary key
- email text
- full_name text
- employee_code text
- role text -- admin | staff
- created_at timestamptz

quizzes
- id uuid primary key
- title text
- duration_minutes integer
- created_by uuid
- created_at timestamptz
- is_active boolean

questions
- id uuid primary key
- quiz_id uuid references quizzes(id)
- order_index integer
- question text
- hint text

options
- id uuid primary key
- question_id uuid references questions(id)
- key text -- A/B/C/D
- text text
- rationale text
- is_correct boolean

attempts
- id uuid primary key
- quiz_id uuid references quizzes(id)
- user_id uuid
- participant_name text
- employee_code text
- started_at timestamptz
- submitted_at timestamptz
- score numeric
- correct_count integer
- total_questions integer

attempt_answers
- id uuid primary key
- attempt_id uuid references attempts(id)
- question_id uuid references questions(id)
- selected_answer text
- correct_answer text
- is_correct boolean
```

## Cach admin day data de nhanh nhat

Giai doan MVP:

- Giu UI `Tao de` hien tai.
- Admin paste TSV vao textarea.
- Server parse TSV.
- Server ghi vao cac bang `quizzes`, `questions`, `options`.

Khong nen:

- Khong upload JSON/TSV len GitHub.
- Khong luu de that trong repo public.
- Khong dung `data/quizzes.json` tren production.

Giai doan sau:

- Them upload file `.tsv`.
- Them import tu Google Sheet.
- Them duplicate/deactivate/delete de.
- Them version de test.

## Viec can sua trong code

### Server

File:

```text
Extension-UP/quiz-test-app/server.js
```

Can lam:

- Them Supabase client hoac REST query.
- Thay `readJson/writeJsonAtomic` bang query database.
- Them auth/session middleware.
- Chi cho admin goi:
  - `POST /api/quizzes`
  - `GET /api/results`
  - `GET /api/results.csv`
  - `GET /api/results.xls`
- Public/staff duoc goi:
  - `GET /api/quizzes`
  - `GET /api/quizzes/:id`
  - `POST /api/quizzes/:id/submit`

### Frontend

File:

```text
Extension-UP/quiz-test-app/public/app.js
```

Can lam:

- Them man dang nhap.
- Luu session.
- An tab `Tao de` va `Ket qua` voi staff.
- Staff chi thay tab `Lam bai`.
- Admin thay ca 3 tab.

### Deploy

Render settings de xuat:

```text
Root Directory: Extension-UP/quiz-test-app
Build Command: npm install
Start Command: npm start
Environment:
  PORT = 10000 hoac de Render tu gan
  SUPABASE_URL = ...
  SUPABASE_SERVICE_ROLE_KEY = ...
  SESSION_SECRET = ...
```

Can sua server de bind dung host/port online:

```js
server.listen(PORT, "0.0.0.0", async () => {
  await ensureDataFiles();
  console.log(`Quiz test app running on port ${PORT}`);
});
```

## Prompt de hoi AI khac

```text
Ban la senior full-stack engineer. Hay review va de xuat cach dua app quiz noi bo nay len online cho nhan su lam bai qua mot duong link.

Repo:
https://github.com/tuyenthanh829/UP-Media

Branch:
claude/loving-cray-5zvqhg

Thu muc can xem:
Extension-UP/

Thanh phan hien co:
1. Extension-UP/extension
   - Chrome MV3 extension lay quiz tu Google NotebookLM qua app-root data-app-data.
   - Xuat TSV 12 cot: STT, Cau hoi, Phuong an A-D, Dap an dung, Giai thich A-D, Goi y.

2. Extension-UP/quiz-test-app
   - Node HTTP server thuan, chua dung Express.
   - Local app chay tai http://localhost:5175.
   - Admin paste TSV de tao de.
   - Nhan su lam bai co timer.
   - Het gio tu nop.
   - Server cham diem thang 100.
   - Luu de/ket qua vao data/quizzes.json va data/results.json khi chay local.
   - Xuat ket qua CSV va Excel-compatible .xls.

Yeu cau san pham tiep theo:
- Dua app len online.
- Nhan su truy cap bang link, dang nhap, chon de va lam bai.
- Admin dang nhap, import TSV/upload TSV de tao de.
- Admin xem va xuat ket qua.
- Khong luu de that/ket qua nhan su trong GitHub public.
- Giai phap can nhanh gon, de van hanh, it phuc tap.

Kien truc dang duoc can nhac:
- Render Web Service de host app.
- Supabase Postgres de luu data.
- Supabase Auth de dang nhap.

Hay review xem kien truc nay co kha dung khong. Neu co, hay dua ra:
1. Phuong an kien truc khuyen nghi.
2. Schema database cu the.
3. Luong dang nhap admin/staff.
4. Cach admin import TSV nhanh gon.
5. Cac API can co.
6. Cac rui ro bao mat va cach giam thieu.
7. Ke hoach migrate code tu JSON file sang database.
8. Checklist deploy Render/Supabase.
9. Neu khong nen dung Render/Supabase, hay de xuat phuong an tot hon va ly do.

Rang buoc:
- Uu tien MVP nhanh.
- Giu code don gian.
- Khong them dependency qua nhieu neu khong can.
- Chay duoc cho nhom nhan su nho/trung binh.
- Ket qua diem phai cham o server, client khong duoc tu gui diem.
- Public quiz API khong duoc tra correctAnswer.
```

