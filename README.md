# School ERP Backend — Phase 0 + Student Management

Multi-tenant SaaS backend. Node/Express + Supabase (Postgres). Login/auth is
**not built yet** — see "Temporary tenant handling" below.

## What's included

- **Phase 0 (foundation):** `schools`, `users`, `roles`, `user_roles`,
  `academic_years`, `classes` — all tenant-scoped with Row Level Security.
- **Phase 1 (Student Management):** admissions, profiles, guardians,
  emergency contacts, medical records, documents, bulk import/export,
  search/filter/pagination.

## Setup

1. Create a Supabase project at supabase.com.
2. In the Supabase SQL editor, run the migrations **in order**:
   - `migrations/001_init_core.sql`
   - `migrations/002_students.sql`
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

## Next up (Phase 2)

Academic Management expansion → Attendance → Exams → Finance → Portals,
then login/auth to replace the `x-school-id` header with real JWT-based
tenant resolution.
