-- ============================================================
-- 001_init_core.sql
-- Core multi-tenant foundation: schools, users, roles, academic years, classes
-- ============================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- SCHOOLS (tenants)
-- ------------------------------------------------------------
create table if not exists schools (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  subdomain text unique not null,
  logo_url text,
  primary_color text default '#2563eb',
  plan text not null default 'trial' check (plan in ('trial', 'basic', 'pro', 'enterprise')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table schools is 'Tenant table. One row per school/client on the SaaS.';

-- ------------------------------------------------------------
-- ROLES (per-school role definitions, seeded with system defaults)
-- ------------------------------------------------------------
create table if not exists roles (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null, -- e.g. 'super_admin', 'principal', 'teacher', 'parent', 'student'
  is_system_role boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

-- ------------------------------------------------------------
-- USERS (auth identity lives in Supabase Auth; this is the profile/tenant link)
-- ------------------------------------------------------------
create table if not exists users (
  id uuid primary key default uuid_generate_v4(), -- matches auth.users.id once auth is wired up
  school_id uuid not null references schools(id) on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, email)
);

create table if not exists user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  primary key (user_id, role_id)
);

-- ------------------------------------------------------------
-- ACADEMIC YEARS & CLASSES (minimal, students reference these)
-- ------------------------------------------------------------
create table if not exists academic_years (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null, -- e.g. '2026/2027'
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists classes (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  academic_year_id uuid references academic_years(id) on delete set null,
  name text not null, -- e.g. 'Grade 7 Blue'
  stream text,
  class_teacher_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_users_school on users(school_id);
create index if not exists idx_roles_school on roles(school_id);
create index if not exists idx_classes_school on classes(school_id);
create index if not exists idx_academic_years_school on academic_years(school_id);

-- ------------------------------------------------------------
-- updated_at trigger helper (reused by every table going forward)
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_schools_updated_at before update on schools
  for each row execute function set_updated_at();

create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
-- Tenant scoping reads school_id from the JWT custom claim once Supabase Auth
-- is wired up (Phase: login). Until then, the Express API uses the Supabase
-- service-role key and enforces school_id scoping at the application layer
-- (see src/middleware/tenantContext.js). These policies are created now so
-- switching to the anon/authenticated key later requires no schema changes.

create or replace function current_school_id()
returns uuid as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'school_id', '')::uuid;
$$ language sql stable;

alter table schools enable row level security;
alter table users enable row level security;
alter table roles enable row level security;
alter table user_roles enable row level security;
alter table academic_years enable row level security;
alter table classes enable row level security;

create policy tenant_isolation_users on users
  using (school_id = current_school_id());

create policy tenant_isolation_roles on roles
  using (school_id = current_school_id());

create policy tenant_isolation_academic_years on academic_years
  using (school_id = current_school_id());

create policy tenant_isolation_classes on classes
  using (school_id = current_school_id());

-- schools table: a user can only see their own school row
create policy tenant_isolation_schools on schools
  using (id = current_school_id());
