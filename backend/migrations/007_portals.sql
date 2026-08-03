-- ============================================================
-- 007_portals.sql
-- Communication (announcements) backing the parent/student/teacher portals
-- ============================================================

create table if not exists announcements (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  title text not null,
  body text not null,
  audience text not null default 'all' check (audience in ('all', 'students', 'parents', 'teachers')),
  class_id uuid references classes(id) on delete cascade, -- null = whole school, not just one class
  created_by uuid references users(id) on delete set null,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_announcements_school on announcements(school_id);
create index if not exists idx_announcements_audience on announcements(school_id, audience);
create index if not exists idx_announcements_class on announcements(class_id);

alter table announcements enable row level security;

create policy tenant_isolation_announcements on announcements
  using (school_id = current_school_id());