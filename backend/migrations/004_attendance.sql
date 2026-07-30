-- ============================================================
-- 004_attendance.sql
-- Attendance: student attendance (per class, per day) and teacher attendance
-- ============================================================

-- ------------------------------------------------------------
-- STUDENT ATTENDANCE
-- ------------------------------------------------------------
create table if not exists student_attendance (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  term_id uuid references terms(id) on delete set null,
  attendance_date date not null,
  status text not null default 'present' check (status in ('present', 'absent', 'late', 'excused')),
  marked_by uuid references users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);

-- ------------------------------------------------------------
-- TEACHER ATTENDANCE
-- ------------------------------------------------------------
create table if not exists teacher_attendance (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  teacher_id uuid not null references users(id) on delete cascade,
  attendance_date date not null,
  status text not null default 'present' check (status in ('present', 'absent', 'late', 'excused')),
  marked_by uuid references users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, attendance_date)
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_student_attendance_school on student_attendance(school_id);
create index if not exists idx_student_attendance_class_date on student_attendance(class_id, attendance_date);
create index if not exists idx_student_attendance_student on student_attendance(student_id, attendance_date);
create index if not exists idx_teacher_attendance_school on teacher_attendance(school_id);
create index if not exists idx_teacher_attendance_teacher on teacher_attendance(teacher_id, attendance_date);

create trigger trg_student_attendance_updated_at before update on student_attendance
  for each row execute function set_updated_at();

create trigger trg_teacher_attendance_updated_at before update on teacher_attendance
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table student_attendance enable row level security;
alter table teacher_attendance enable row level security;

create policy tenant_isolation_student_attendance on student_attendance
  using (school_id = current_school_id());

create policy tenant_isolation_teacher_attendance on teacher_attendance
  using (school_id = current_school_id());