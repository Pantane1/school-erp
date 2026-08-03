-- ============================================================
-- 010_transport.sql
-- Transport: routes, vehicles, pickup points, student assignments
-- ============================================================

create table if not exists transport_vehicles (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  registration_number text not null,
  capacity integer not null default 30 check (capacity > 0),
  driver_name text,
  driver_phone text,
  created_at timestamptz not null default now(),
  unique (school_id, registration_number)
);

create table if not exists transport_routes (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null, -- e.g. 'Route A - Westlands'
  vehicle_id uuid references transport_vehicles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table if not exists transport_pickup_points (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  route_id uuid not null references transport_routes(id) on delete cascade,
  name text not null,
  sequence_order integer not null default 1,
  pickup_time time,
  created_at timestamptz not null default now()
);

create table if not exists student_transport (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  route_id uuid not null references transport_routes(id) on delete cascade,
  pickup_point_id uuid references transport_pickup_points(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id) -- one active route assignment per student at a time
);

create index if not exists idx_transport_vehicles_school on transport_vehicles(school_id);
create index if not exists idx_transport_routes_school on transport_routes(school_id);
create index if not exists idx_transport_pickup_points_route on transport_pickup_points(route_id);
create index if not exists idx_student_transport_school on student_transport(school_id);
create index if not exists idx_student_transport_route on student_transport(route_id);

alter table transport_vehicles enable row level security;
alter table transport_routes enable row level security;
alter table transport_pickup_points enable row level security;
alter table student_transport enable row level security;

create policy tenant_isolation_transport_vehicles on transport_vehicles
  using (school_id = current_school_id());
create policy tenant_isolation_transport_routes on transport_routes
  using (school_id = current_school_id());
create policy tenant_isolation_transport_pickup_points on transport_pickup_points
  using (school_id = current_school_id());
create policy tenant_isolation_student_transport on student_transport
  using (school_id = current_school_id());