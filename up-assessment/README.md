# UP Assessment & KPI Platform

Nền tảng kiểm tra và quản lý KPI nội bộ — Next.js 15 + Supabase PostgreSQL.

---

## Setup

### 1. Tạo Supabase project

Vào [supabase.com](https://supabase.com) → New Project.

### 2. Tạo `.env.local`

```bash
cp .env.example .env.local
```

Điền URL và keys từ Supabase Dashboard → Settings → API.

### 3. Chạy migrations (001 → 010 trước)

Vào Supabase Dashboard → SQL Editor, chạy từng file theo thứ tự:

```
db/migrations/001_schemas_and_enums.sql
db/migrations/002_app_schema.sql
db/migrations/003_content_schema.sql
db/migrations/004_assessment_schema.sql
db/migrations/005_attempts_schema.sql
db/migrations/006_results_schema.sql
db/migrations/007_private_schema.sql
db/migrations/008_secure_grading_rpc.sql
db/migrations/009_rls_policies.sql
db/migrations/010_views.sql
```

### 4. Bật pg_cron ⚠️ TRƯỚC khi chạy migration 011

Supabase Dashboard → **Integrations → Cron → Enable**

> Nếu chạy `011` trước bước này sẽ lỗi `function cron.schedule() does not exist`.

### 5. Chạy migration 011

```
db/migrations/011_deadline_jobs.sql
```

### 6. Chạy seed data

```
db/seeds/001_baseline.sql
```

### 7. Khởi động dev server

```bash
npm install
npm run dev
```

---

## Cấu trúc project

```
up-assessment/
  db/
    migrations/   # SQL migrations (chạy theo thứ tự)
    seeds/        # Seed data cơ bản
  src/
    app/          # Next.js App Router pages & API routes
    components/   # UI components (learner/manager/hr/kpi/shared)
    lib/          # Supabase client, permissions, utils
    modules/      # Business logic (auth, scoring, results, assessment)
    types/        # TypeScript types aligned to DB schema
```

## Roles

| Role | Mô tả |
|---|---|
| `learner` | Nhân viên tham gia bài kiểm tra |
| `manager` | Xem kết quả nhân viên trực thuộc |
| `content_reviewer` | Review và publish câu hỏi |
| `hr_ld` | Quản lý đào tạo, xác nhận kết quả |
| `kpi_admin` | Khóa kết quả KPI chính thức |
| `director` | Phê duyệt cấp cao |
| `system_admin` | Quản trị kỹ thuật |

## Security notes

- `is_correct` và answer keys **không bao giờ** được gửi về browser
- Grading chạy hoàn toàn trong PostgreSQL RPC (`submit_and_grade_attempt`)
- `SUPABASE_SERVICE_ROLE_KEY` chỉ dùng server-side (invite flow)
- RLS enabled trên tất cả tables — frontend hiding không phải lớp bảo vệ duy nhất
