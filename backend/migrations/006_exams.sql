-- ============================================================
-- 006_exams.sql
-- Examination System: exam types, grading scales, exams, exam schedule
-- per subject/class, marks entry
-- ============================================================

-- ------------------------------------------------------------
-- EXAM TYPES (CAT, Midterm, Final, Assignment, Project...)
-- ------------------------------------------------------------
create table if not exists exam_types (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  weight numeric(5,2) default 100, -- % weight toward a combined term grade, if used
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

-- ------------------------------------------------------------
-- GRADING SCALES (school-configurable boundaries for auto-grading)
-- e.g. 80-100 = A / 4.0, 70-79 = B / 3.0 ...
-- ------------------------------------------------------------
create table if not exists grading_scales (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  grade text not null, -- 'A', 'B+', etc.
  min_score numeric(5,2) not null,
  max_score numeric(5,2) not null,
  grade_point numeric(3,2), -- for GPA calculation
  remarks text, -- 'Excellent', 'Good', ...
  created_at timestamptz not null default now(),
  check (min_score <= max_score)
);

-- ------------------------------------------------------------
-- EXAMS (an exam sitting within a term, e.g. "Midterm Exam - Term 1")
-- ------------------------------------------------------------
create table if not exists exams (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  exam_type_id uuid references exam_types(id) on delete set null,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  term_id uuid references terms(id) on delete cascade,
  start_date date,
  end_date date,
  status text not null default 'scheduled' check (status in ('scheduled', 'ongoing', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- EXAM_SUBJECTS (the timetable: one subject paper for one class within an exam)
-- ------------------------------------------------------------
create table if not exists exam_subjects (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  exam_id uuid not null references exams(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  max_marks numeric(6,2) not null default 100,
  exam_date date,
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  unique (exam_id, subject_id, class_id)
);

-- ------------------------------------------------------------
-- MARKS (one row per student per exam_subject)
-- ------------------------------------------------------------
create table if not exists marks (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  exam_subject_id uuid not null references exam_subjects(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  marks_obtained numeric(6,2) not null check (marks_obtained >= 0),
  grade text, -- filled in from grading_scales at entry time
  grade_point numeric(3,2),
  remarks text,
  entered_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_subject_id, student_id)
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_exam_types_school on exam_types(school_id);
create index if not exists idx_grading_scales_school on grading_scales(school_id);
create index if not exists idx_exams_school on exams(school_id);
create index if not exists idx_exams_term on exams(term_id);
create index if not exists idx_exam_subjects_school on exam_subjects(school_id);
create index if not exists idx_exam_subjects_exam on exam_subjects(exam_id);
create index if not exists idx_exam_subjects_class on exam_subjects(class_id);
create index if not exists idx_marks_school on marks(school_id);
create index if not exists idx_marks_exam_subject on marks(exam_subject_id);
create index if not exists idx_marks_student on marks(student_id);

create trigger trg_marks_updated_at before update on marks
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table exam_types enable row level security;
alter table grading_scales enable row level security;
alter table exams enable row level security;
alter table exam_subjects enable row level security;
alter table marks enable row level security;

create policy tenant_isolation_exam_types on exam_types
  using (school_id = current_school_id());
create policy tenant_isolation_grading_scales on grading_scales
  using (school_id = current_school_id());
create policy tenant_isolation_exams on exams
  using (school_id = current_school_id());
create policy tenant_isolation_exam_subjects on exam_subjects
  using (school_id = current_school_id());
create policy tenant_isolation_marks on marks
  using (school_id = current_school_id());