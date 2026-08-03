# School ERP Backend

Multi-tenant SaaS backend. Node/Express + Supabase (Postgres). Full auth
is wired in — see the "Auth" section below for how login/registration
works.

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

- **Phase 5 (Exams):** exam types, grading scales, exams, subject/class
  scheduling, marks entry with auto-grading, report cards, class rankings.

- **Phase 6 (Portals):** announcements + student/parent/teacher dashboard
  aggregation endpoints over everything else that's been built.

- **Phase 7 (Auth):** school self-registration, login, staff/user
  registration, current-user profile — backed by Supabase Auth for
  credential storage, with this API issuing its own JWT for all other
  routes. No new migration needed — reuses the `users`/`roles` tables
  from Phase 0.

- **Phase 8 (Library, Hostel, Transport, HR):** the four modules the
  original spec listed that were deferred earlier. See the dedicated
  sections below for each.

### Library endpoints

| Endpoint | Notes |
|---|---|
| `/api/library/books` | standard CRUD |
| `POST /api/library/borrowings` | `{ book_id, student_id? or borrower_user_id?, due_date? }` — fails if no copies available, decrements `available_copies` |
| `POST /api/library/borrowings/:id/return` | computes a fine (`LIBRARY_FINE_PER_DAY` × days late) automatically, restores `available_copies` |
| `GET /api/library/borrowings` | filters: `status`, `book_id`, `student_id`, `borrower_user_id` |
| `GET /api/library/overdue` | everything still `borrowed` past its `due_date` |

### Hostel endpoints

| Endpoint | Notes |
|---|---|
| `/api/hostel/rooms` | standard CRUD |
| `/api/hostel/visitors` | standard CRUD — visitor log per student |
| `POST /api/hostel/allocations` | `{ room_id, student_id }` — fails if room is at capacity or student already has an active allocation |
| `POST /api/hostel/allocations/:id/vacate` | frees the room |
| `GET /api/hostel/allocations` | filters: `room_id`, `student_id`, `status` |

### Transport endpoints

| Endpoint | Notes |
|---|---|
| `/api/transport/vehicles` | standard CRUD |
| `/api/transport/routes` | standard CRUD |
| `/api/transport/pickup-points` | standard CRUD — scoped to a route, `sequence_order` for stop ordering |
| `/api/transport/assignments` | standard CRUD — assigns a student to a route/pickup point (one active assignment per student) |

### HR endpoints

| Endpoint | Notes |
|---|---|
| `GET /api/hr/employees` | lists `users` with employment fields + roles; filters: `department_id`, `employment_status`, `role` |
| `GET /api/hr/employees/:id` | one employee's full profile |
| `PATCH /api/hr/employees/:id` | updates `job_title`, `department_id`, `employment_date`, `employment_status`, `phone` — employee *creation* still happens via `POST /api/auth/register`, since every employee is a `users` row |
| `POST /api/hr/leave-requests` | `{ user_id, leave_type, start_date, end_date, reason? }` |
| `GET /api/hr/leave-requests` | filters: `user_id`, `status`, `leave_type` |
| `POST /api/hr/leave-requests/:id/decide` | `{ status: 'approved'\|'rejected', approved_by? }` |
| `/api/hr/payroll` | standard CRUD — `net_salary` auto-computed by Postgres (`basic_salary + allowances - deductions`) |
| `POST /api/hr/payroll/:id/mark-paid` | flips a record to `paid` with today's date |

**Intentionally out of scope for HR:** recruitment, performance reviews,
and training — these need workflow/document features beyond what a
handful of tables would meaningfully capture. `employees` also isn't a
separate table — it deliberately reuses `users` (every employee already
has a login), extended with employment columns.

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
| `POST /api/finance/payments/mpesa/callback` | **public** — Safaricom posts here directly; not behind the `authenticate` middleware |
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
   (Auth/Phase 7 needs no new migration — it reuses `users`/`roles` from 001.)
   - `migrations/008_library.sql`
   - `migrations/009_hostel.sql`
   - `migrations/010_transport.sql`
   - `migrations/011_hr.sql`
3. Copy `.env.example` to `.env` and fill in your Supabase URL + service
   role key (Project Settings → API), plus a random `JWT_SECRET` (used to
   sign this API's own tokens — see the Auth section below).
4. Install and run:
   ```
   npm install
   npm run dev
   ```
5. API runs at `http://localhost:4000`.

## Auth

Real login/auth is now wired in — the old `x-school-id` header stand-in is
gone. Every protected route reads `req.schoolId`, `req.userId`, and
`req.roles` from a verified JWT instead.

**How it works:** Supabase Auth stores credentials and verifies passwords
(proper hashing, etc). Once a login succeeds, this API signs its **own**
JWT (via `JWT_SECRET`, not Supabase's own token) containing
`{ sub: userId, school_id, roles }`, and that's what you send as
`Authorization: Bearer <token>` on every other request. This means no
manual Supabase Dashboard configuration (Auth Hooks, custom claims) was
needed to get this working.

### Auth endpoints

| Endpoint | Notes |
|---|---|
| `POST /api/auth/register-school` | **public** — onboards a brand-new school + its first user (owner). `{ school_name, subdomain, owner_full_name, owner_email, owner_password }` → returns a token immediately |
| `POST /api/auth/login` | **public** — `{ email, password }` → `{ token, user }` |
| `POST /api/auth/register` | **protected**, restricted to `school_owner`/`principal`/`registrar`/`super_admin` roles — creates additional staff/parent/student accounts within the caller's own school. `{ email, password, full_name, phone?, role }` |
| `GET /api/auth/me` | **protected** — current user's profile + roles |

Every other route under `/api/*` (students, finance, exams, etc.) now
requires `Authorization: Bearer <token>` — get one from `login` or
`register-school` first.

### Roles

`role` in `/register` and `/register-school` is a free-text string —
`roles` is a simple per-school lookup table (already existed from Phase
0), so any role name works and gets created on first use. Use whatever
matches your school's structure: `school_owner`, `principal`, `teacher`,
`parent`, `student`, `accountant`, etc.

### Locking down more routes

Only `/api/auth/register` is role-restricted so far (via the
`requireRole()` middleware in `src/middleware/authenticate.js`). Every
other route just requires *any* valid token right now — it doesn't yet
check *which* role is calling it. To restrict something further, add
`requireRole('teacher', 'class_teacher')` (or whichever roles apply) as
middleware on that specific route, the same way `authRoutes.js` does it.
This wasn't retrofitted onto all ~40 existing routes in this pass —
worth doing incrementally as you decide which actions should be
role-gated.

### Old temporary file

`src/middleware/tenantContext.js` (the old `x-school-id` header stand-in)
is no longer referenced anywhere — `app.js` now uses
`src/middleware/authenticate.js` instead. You can delete
`tenantContext.js` from your repo; it's dead code at this point.

## Testing it now

First, register a school (this replaces the old manual SQL insert) and
grab the token it returns:

```bash
curl -X POST http://localhost:4000/api/auth/register-school \
  -H "Content-Type: application/json" \
  -d '{
    "school_name": "Test Academy",
    "subdomain": "test-academy",
    "owner_full_name": "Jane Owner",
    "owner_email": "owner@test-academy.com",
    "owner_password": "a-strong-password"
  }'
```

That returns `{ data: { token, school, user } }` — save the `token`, then
use it as a Bearer token on everything else:

```bash
TOKEN="<paste the token here>"

# Create a student
curl -X POST http://localhost:4000/api/students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
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
curl "http://localhost:4000/api/students?page=1&limit=20" -H "Authorization: Bearer $TOKEN"

# Search
curl "http://localhost:4000/api/students?q=Jane" -H "Authorization: Bearer $TOKEN"

# Get one
curl http://localhost:4000/api/students/<student-id> -H "Authorization: Bearer $TOKEN"

# Update
curl -X PATCH http://localhost:4000/api/students/<student-id> \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "active"}'

# Soft delete
curl -X DELETE http://localhost:4000/api/students/<student-id> -H "Authorization: Bearer $TOKEN"
```

On subsequent runs, log back in instead of re-registering the school:

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "owner@test-academy.com", "password": "a-strong-password"}'
```

## Project structure

```
migrations/           SQL migrations (run in order in Supabase SQL editor)
src/
  config/supabase.js  Supabase client
  middleware/          authenticate.js (auth + requireRole), errorHandler.js
  controllers/         one per resource/module — students, finance, exams, auth, etc.
  routes/               one per resource, plus index.js mounting them all
  utils/               crudFactory.js, routeFactory.js (shared CRUD pattern), mpesaService.js
  app.js               Express app + middleware wiring
  server.js            Entry point
```

## Status: full spec built

Every module from the original spec is built and wired together:
foundation/multi-tenancy, Student Management, Academic Management,
Attendance, Finance (incl. live M-Pesa STK push), Exams, Portals, Auth,
Library, Hostel, Transport, and HR. `src/middleware/tenantContext.js` is
dead code — safe to delete.

**What's left, roughly in order of value:**
1. Lock down more routes with `requireRole()` (see the Auth section
   above) — most routes right now just require *any* valid token, not a
   specific role
2. Add automated tests (none exist yet — this was built for speed of
   iteration, not test coverage)
3. API documentation (Swagger/OpenAPI, per the original spec)
4. Genuinely deferred: Inventory, AI features (report generation,
   predictive analytics, chatbots, timetable optimization), multi-school
   branding/subdomain routing, PWA/offline support — these need either
   a product decision (which AI features actually matter) or
   infrastructure beyond a REST API (subdomain routing, service workers)







   ## 👤 Author

**Wamuhu Martin** (Pantane1)

- Support: [pay-me](https://pantane.is-a.dev/support)

<p align="center">
  <a href="#"><img src="https://github.com/Pantane1/nf/blob/main/public/ph.png" alt="ph-logo">
</p>

<p align="center">
  <a href="#"><img src="http://readme-typing-svg.herokuapp.com?color=ACAF50&center=true&vCenter=true&multiline=false&lines=Built+Different" alt="pantane">
</p>