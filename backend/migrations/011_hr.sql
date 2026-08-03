-- ============================================================
-- 011_hr.sql
-- HR: employment details (extends users), leave requests, payroll
-- ============================================================

-- Extends the existing `users` table with employment-specific fields,
-- rather than a separate `employees` table — every employee is already
-- a `users` row (teachers, accountants, etc. from Phase 0/Auth).
alter table users add column if not exists job_title text;
alter table users add column if not exists department_id uuid references departments(id) on delete set null;
alter table users add column if not exists employment_date date;
alter table users add column if not exists employment_status text default 'active'
  check (employment_status in ('active', 'on_leave', 'suspended', 'terminated'));

create table if not exists leave_requests (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  leave_type text not null, -- 'annual', 'sick', 'maternity', 'unpaid', ...
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists payroll_records (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  pay_period text not null, -- e.g. '2026-08'
  basic_salary numeric(12,2) not null default 0,
  allowances numeric(12,2) not null default 0,
  deductions numeric(12,2) not null default 0,
  net_salary numeric(12,2) generated always as (basic_salary + allowances - deductions) stored,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_date date,
  created_at timestamptz not null default now(),
  unique (user_id, pay_period)
);

create index if not exists idx_leave_requests_school on leave_requests(school_id);
create index if not exists idx_leave_requests_user on leave_requests(user_id);
create index if not exists idx_leave_requests_status on leave_requests(school_id, status);
create index if not exists idx_payroll_records_school on payroll_records(school_id);
create index if not exists idx_payroll_records_user on payroll_records(user_id);
create index if not exists idx_users_department on users(department_id);

create trigger trg_leave_requests_updated_at before update on leave_requests
  for each row execute function set_updated_at();

alter table leave_requests enable row level security;
alter table payroll_records enable row level security;

create policy tenant_isolation_leave_requests on leave_requests
  using (school_id = current_school_id());
create policy tenant_isolation_payroll_records on payroll_records
  using (school_id = current_school_id());