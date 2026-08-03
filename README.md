# School ERP Backend — Phase 0 + Student Management

Multi-tenant SaaS backend. Node/Express + Supabase (Postgres). Login/auth is
**not built yet** — see "Temporary tenant handling" below.

## What's included

- **Phase 0 (foundation):** `schools`, `users`, `roles`, `user_roles`,
  `academic_years`, `classes` — all tenant-scoped with Row Level Security.
- **Phase 1 (Student Management):** admissions, profiles, guardians,
  emergency contacts, medical records, documents, bulk import/export,
  search/filter/pagination.
- **Phase 2 (Academic Management):** departments, subjects, terms/
  semesters (with a "set current" endpoint), full CRUD on academic years
  and classes, and course allocation (`class_subjects` — which subject is
  taught in which class by which teacher).

### Academic Management endpoints

| Resource | Base path | Notes |
|---|---|---|
| Academic years | `/api/academic-years` | + `POST /:id/set-current` |
| Terms | `/api/terms` | + `POST /:id/set-current` (scoped to its academic year) |
| Classes | `/api/classes` | |
| Departments | `/api/departments` | |
| Subjects | `/api/subjects` | |
| Course allocation | `/api/class-subjects` | links class ↔ subject ↔ teacher |

All support `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`.
List endpoints support `?page=&limit=` and `?filter[field]=value`.

These six were built off a shared `src/utils/crudFactory.js` +
`src/utils/routeFactory.js` — reference/lookup tables share the same
tenant-scoped CRUD pattern, so new ones like this are cheap to add later
(e.g. exam types, fee categories).

- **Phase 3 (Attendance):** student attendance (per class, per day, bulk
  mark for a whole class in one call) and teacher attendance, both with
  upsert-on-remark semantics and a summary/counts endpoint.

- **Phase 4 (Finance):** fee categories, fee structures (per class/term/
  year), invoice generation from those structures with discounts applied
  as line items, manual payment recording, live M-Pesa Daraja STK push
  (initiate + callback), balance and financial summary reports.

### Finance endpoints

| Endpoint | Notes |
|---|---|
| `/api/finance/fee-categories` | standard CRUD |
| `/api/finance/fee-structures` | standard CRUD — `class_id` null = applies to all classes |
| `/api/finance/discounts` | standard CRUD — student scholarships/discounts, `fee_category_id` null = whole-invoice discount |
| `POST /api/finance/invoices/generate` | `{ student_id, academic_year_id, term_id?, due_date? }` — builds invoice from matching fee structures + discounts |
| `GET /api/finance/invoices` | filters: `student_id`, `status`, `academic_year_id`, `term_id` |
| `GET /api/finance/invoices/:id` | full invoice with line items + payments |
| `PATCH /api/finance/invoices/:id` | manual `status`/`due_date` correction |
| `POST /api/finance/payments` | record a manual payment (cash/bank/cheque/already-confirmed mpesa) |
| `GET /api/finance/payments` | filters: `student_id`, `invoice_id`, `method`, `status`, `from`, `to` |
| `POST /api/finance/payments/mpesa/initiate` | `{ student_id, invoice_id?, amount, phone, account_reference? }` — sends a real STK push |
| `POST /api/finance/payments/mpesa/callback` | **public**, no `x-school-id` — Safaricom posts here; not behind tenant middleware |
| `GET /api/finance/students/:studentId/balance` | outstanding balance for one student |
| `GET /api/finance/reports/summary` | filters: `academic_year_id`, `term_id`, `class_id` — totals invoiced/collected/outstanding |

**M-Pesa setup:** get sandbox credentials at developer.safaricom.co.ke,
fill in the `MPESA_*` vars in `.env`, and make sure `MPESA_CALLBACK_URL`
is a public HTTPS URL Safaricom can reach (use ngrok for local testing —
Daraja cannot call `localhost`).

### Exams endpoints

| Endpoint | Notes |
|---|---|
| `/api/exams/types` | standard CRUD — CAT, Midterm, Final, etc. |
| `/api/exams/grading-scales` | standard CRUD — school-configurable score→grade boundaries (e.g. 80-100 = A, GPA 4.0) |
| `/api/exams` | standard CRUD — an exam sitting within a term |
| `/api/exams/schedule` | standard CRUD on `exam_subjects` — the timetable: one subject paper for one class within an exam (`max_marks`, `exam_date`, `start_time`, `end_time`) |
| `POST /api/exams/marks/bulk` | `{ exam_subject_id, records: [{student_id, marks_obtained, remarks?}] }` — enters a whole class's scores for one paper in one call, auto-grades each via `grading_scales` |
| `GET /api/exams/marks` | filters: `exam_subject_id`, `student_id` |
| `PATCH /api/exams/marks/:id` | correct one score — re-grades automatically |
| `GET /api/exams/:examId/report-cards/:studentId` | per-subject scores/grades, average, overall grade, GPA |
| `GET /api/exams/:examId/rankings?class_id=` | every student in the class ranked by average marks across the exam's subjects |

Auto-grading resolves against whatever's configured in `grading_scales` for
the school — set that up before entering marks, or grades will come back
`null` (scores still save fine).

### Portals endpoints

| Endpoint | Notes |
|---|---|
| `/api/announcements` | standard CRUD — `audience`: `all`/`students`/`parents`/`teachers`, optional `class_id` to target one class |
| `GET /api/portal/students/:studentId` | student dashboard: profile, 30-day attendance summary, fee balance, 5 most recent marks, relevant announcements |
| `GET /api/portal/parents/:studentId` | same payload as the student dashboard — a parent views their child's data |
| `GET /api/portal/teachers/:teacherId` | teacher dashboard: assigned classes/subjects, whether each class's attendance was marked today, relevant announcements |

These are read-only aggregation endpoints over data you've already built
(students, attendance, finance, exams, announcements) — they don't add
new tables beyond `announcements`. Once login/auth exists, these become
the natural landing views for each role after sign-in.

### Attendance endpoints

| Endpoint | Notes |
|---|---|
| `POST /api/attendance/students/bulk` | `{ class_id, term_id?, attendance_date, records: [{student_id, status?, notes?}] }` — marks a whole class at once, upserts per student/day |
| `GET /api/attendance/students` | filters: `class_id`, `student_id`, `status`, `date`, `from`, `to` |
| `GET /api/attendance/students/summary` | `student_id` or `class_id`, plus `from`/`to` — returns present/absent/late/excused counts |
| `PATCH /api/attendance/students/:id` / `DELETE /:id` | correct or remove a single record |
| `POST /api/attendance/teachers` | `{ teacher_id, attendance_date, status?, notes? }` — upserts on teacher+day |
| `GET /api/attendance/teachers` | filters: `teacher_id`, `status`, `date`, `from`, `to` |
| `GET /api/attendance/teachers/summary` | `teacher_id` (required), plus `from`/`to` |
| `PATCH /api/attendance/teachers/:id` / `DELETE /:id` | correct or remove a single record |

## Setup

1. Create a Supabase project at supabase.com.
2. In the Supabase SQL editor, run the migrations **in order**:
   - `migrations/001_init_core.sql`
   - `migrations/002_students.sql`
   - `migrations/003_academic.sql`
   - `migrations/004_attendance.sql`
   - `migrations/005_finance.sql`
   - `migrations/006_exams.sql`
   - `migrations/007_portals.sql`
3. Copy `.env.example` to `.env` and fill in your Supabase URL + service
   role key (Project Settings → API).
4. Install and run:
   ```
   npm install
   npm run dev
   ```
5. API runs at `http://localhost:4000`.

## Temporary tenant handling (until login is built)

There's no auth yet, so every request to `/api/*` (except `/api/health`)
must include a header:

```
x-school-id: <uuid of a row in the schools table>
```

This is enforced by `src/middleware/tenantContext.js` and is **not
secure** — it's a stand-in so Student Management can be built and tested
now. When login/auth is added:

1. Supabase Auth will issue a JWT with a `school_id` custom claim.
2. The RLS policies already in the migrations (`current_school_id()`)
   will start enforcing tenant isolation at the database level.
3. Swap the backend from the service-role key to the user's JWT
   (or keep service-role + verify JWT in middleware — either works),
   and `tenantContext.js` reads `school_id` from the verified token
   instead of the header.

No schema changes needed at that point — this was designed for it.

## Testing it now

First, insert a school and get its id (via Supabase table editor or SQL):

```sql
insert into schools (name, subdomain) values ('Test Academy', 'test-academy') returning id;
```

Then, with that id as `x-school-id`:

```bash
# Create a student
curl -X POST http://localhost:4000/api/students \
  -H "Content-Type: application/json" \
  -H "x-school-id: <school-id>" \
  -d '{
    "admission_number": "ADM001",
    "first_name": "Jane",
    "last_name": "Wanjiru",
    "gender": "female",
    "guardians": [
      { "full_name": "Peter Wanjiru", "relationship": "father", "phone": "0700000000", "is_primary_contact": true }
    ]
  }'

# List students
curl "http://localhost:4000/api/students?page=1&limit=20" -H "x-school-id: <school-id>"

# Search
curl "http://localhost:4000/api/students?q=Jane" -H "x-school-id: <school-id>"

# Get one
curl http://localhost:4000/api/students/<student-id> -H "x-school-id: <school-id>"

# Update
curl -X PATCH http://localhost:4000/api/students/<student-id> \
  -H "Content-Type: application/json" -H "x-school-id: <school-id>" \
  -d '{"status": "active"}'

# Soft delete
curl -X DELETE http://localhost:4000/api/students/<student-id> -H "x-school-id: <school-id>"
```

## Project structure

```
migrations/           SQL migrations (run in order in Supabase SQL editor)
src/
  config/supabase.js  Supabase client
  middleware/          tenantContext (temp), errorHandler
  controllers/         studentController.js
  routes/              studentRoutes.js, index.js
  app.js               Express app + middleware wiring
  server.js            Entry point
```

## Next up (Phase 7 — the last one)

Login/auth: Supabase Auth issuing JWTs with a `school_id` custom claim,
replacing the temporary `x-school-id` header in `tenantContext.js`. Once
that's in, the RLS policies already sitting in every migration start
enforcing tenant isolation at the database level and this whole system
moves from "dev-mode" to production-safe.