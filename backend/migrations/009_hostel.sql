-- ============================================================
-- 009_hostel.sql
-- Hostel: rooms, room allocations, visitor log
-- ============================================================

create table if not exists hostel_rooms (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  block_name text not null, -- e.g. 'Block A'
  room_number text not null,
  capacity integer not null default 4 check (capacity > 0),
  occupied_count integer not null default 0 check (occupied_count >= 0),
  created_at timestamptz not null default now(),
  unique (school_id, block_name, room_number),
  check (occupied_count <= capacity)
);

create table if not exists hostel_allocations (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  room_id uuid not null references hostel_rooms(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  allocated_date date not null default current_date,
  vacated_date date,
  status text not null default 'active' check (status in ('active', 'vacated')),
  created_at timestamptz not null default now()
);

create table if not exists hostel_visitors (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  visitor_name text not null,
  relationship text,
  purpose text,
  check_in_time timestamptz not null default now(),
  check_out_time timestamptz,
  created_at timestamptz not null default now()
);

-- Only one active allocation per student at a time
create unique index if not exists uq_one_active_allocation_per_student
  on hostel_allocations(student_id) where (status = 'active');

create index if not exists idx_hostel_rooms_school on hostel_rooms(school_id);
create index if not exists idx_hostel_allocations_school on hostel_allocations(school_id);
create index if not exists idx_hostel_allocations_room on hostel_allocations(room_id);
create index if not exists idx_hostel_allocations_student on hostel_allocations(student_id);
create index if not exists idx_hostel_visitors_school on hostel_visitors(school_id);
create index if not exists idx_hostel_visitors_student on hostel_visitors(student_id);

alter table hostel_rooms enable row level security;
alter table hostel_allocations enable row level security;
alter table hostel_visitors enable row level security;

create policy tenant_isolation_hostel_rooms on hostel_rooms
  using (school_id = current_school_id());
create policy tenant_isolation_hostel_allocations on hostel_allocations
  using (school_id = current_school_id());
create policy tenant_isolation_hostel_visitors on hostel_visitors
  using (school_id = current_school_id());