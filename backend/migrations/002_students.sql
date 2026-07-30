-- ============================================================
-- 002_students.sql
-- Student Management module
-- ============================================================

create table if not exists students (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  admission_number text not null,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other')),
  class_id uuid references classes(id) on delete set null,
  academic_year_id uuid references academic_years(id) on delete set null,
  admission_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'transferred', 'graduated', 'withdrawn')),
  photo_url text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, admission_number)
);

create table if not exists guardians (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  full_name text not null,
  relationship text not null, -- 'mother', 'father', 'guardian', etc.
  phone text not null,
  email text,
  occupation text,
  created_at timestamptz not null default now()
);

create table if not exists student_guardians (
  student_id uuid not null references students(id) on delete cascade,
  guardian_id uuid not null references guardians(id) on delete cascade,
  is_primary_contact boolean not null default false,
  primary key (student_id, guardian_id)
);

create table if not exists student_emergency_contacts (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  full_name text not null,
  relationship text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create table if not exists student_medical_records (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  blood_group text,
  allergies text,
  conditions text,
  medications text,
  doctor_name text,
  doctor_phone text,
  updated_at timestamptz not null default now()
);

create table if not exists student_documents (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  document_type text not null, -- 'birth_certificate', 'transfer_letter', 'report_card', etc.
  file_url text not null,
  uploaded_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_students_school on students(school_id);
create index if not exists idx_students_class on students(class_id);
create index if not exists idx_students_status on students(school_id, status);
create index if not exists idx_students_name on students(school_id, last_name, first_name);
create index if not exists idx_guardians_school on guardians(school_id);
create index if not exists idx_student_documents_student on student_documents(student_id);

create trigger trg_students_updated_at before update on students
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table students enable row level security;
alter table guardians enable row level security;
alter table student_guardians enable row level security;
alter table student_emergency_contacts enable row level security;
alter table student_medical_records enable row level security;
alter table student_documents enable row level security;

create policy tenant_isolation_students on students
  using (school_id = current_school_id());

create policy tenant_isolation_guardians on guardians
  using (school_id = current_school_id());

create policy tenant_isolation_student_guardians on student_guardians
  using (exists (
    select 1 from students s where s.id = student_id and s.school_id = current_school_id()
  ));

create policy tenant_isolation_emergency_contacts on student_emergency_contacts
  using (exists (
    select 1 from students s where s.id = student_id and s.school_id = current_school_id()
  ));

create policy tenant_isolation_medical_records on student_medical_records
  using (exists (
    select 1 from students s where s.id = student_id and s.school_id = current_school_id()
  ));

create policy tenant_isolation_student_documents on student_documents
  using (exists (
    select 1 from students s where s.id = student_id and s.school_id = current_school_id()
  ));
