-- ============================================================
-- 003_academic.sql
-- Academic Management: departments, subjects, terms, course allocation
-- ============================================================

-- ------------------------------------------------------------
-- DEPARTMENTS
-- ------------------------------------------------------------
create table if not exists departments (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null, -- e.g. 'Sciences', 'Languages'
  head_of_department_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

-- ------------------------------------------------------------
-- TERMS / SEMESTERS (children of an academic year)
-- ------------------------------------------------------------
create table if not exists terms (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  name text not null, -- e.g. 'Term 1', 'Semester 1'
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- SUBJECTS (catalog, belongs to a department)
-- ------------------------------------------------------------
create table if not exists subjects (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  name text not null, -- e.g. 'Mathematics'
  code text, -- e.g. 'MATH101'
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, code)
);

-- ------------------------------------------------------------
-- CLASS_SUBJECTS (course allocation: subject taught in a class by a teacher)
-- ------------------------------------------------------------
create table if not exists class_subjects (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  teacher_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (class_id, subject_id)
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_departments_school on departments(school_id);
create index if not exists idx_terms_school on terms(school_id);
create index if not exists idx_terms_academic_year on terms(academic_year_id);
create index if not exists idx_subjects_school on subjects(school_id);
create index if not exists idx_subjects_department on subjects(department_id);
create index if not exists idx_class_subjects_school on class_subjects(school_id);
create index if not exists idx_class_subjects_class on class_subjects(class_id);
create index if not exists idx_class_subjects_teacher on class_subjects(teacher_id);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table departments enable row level security;
alter table terms enable row level security;
alter table subjects enable row level security;
alter table class_subjects enable row level security;

create policy tenant_isolation_departments on departments
  using (school_id = current_school_id());

create policy tenant_isolation_terms on terms
  using (school_id = current_school_id());

create policy tenant_isolation_subjects on subjects
  using (school_id = current_school_id());

create policy tenant_isolation_class_subjects on class_subjects
  using (school_id = current_school_id());

-- ------------------------------------------------------------
-- Guard: only one current academic_year / term per school
-- ------------------------------------------------------------
create unique index if not exists uq_one_current_academic_year
  on academic_years(school_id) where (is_current);

create unique index if not exists uq_one_current_term_per_year
  on terms(academic_year_id) where (is_current);