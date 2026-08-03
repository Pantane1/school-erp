-- ============================================================
-- 008_library.sql
-- Library: book catalog, borrowing, returns, fines
-- ============================================================

create table if not exists books (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  title text not null,
  author text,
  isbn text,
  category text,
  total_copies integer not null default 1 check (total_copies >= 0),
  available_copies integer not null default 1 check (available_copies >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists book_borrowings (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  borrower_user_id uuid references users(id) on delete cascade, -- for staff borrowers
  borrowed_date date not null default current_date,
  due_date date not null,
  returned_date date,
  fine_amount numeric(10,2) not null default 0,
  fine_paid boolean not null default false,
  status text not null default 'borrowed' check (status in ('borrowed', 'returned', 'overdue', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (student_id is not null or borrower_user_id is not null)
);

create index if not exists idx_books_school on books(school_id);
create index if not exists idx_book_borrowings_school on book_borrowings(school_id);
create index if not exists idx_book_borrowings_book on book_borrowings(book_id);
create index if not exists idx_book_borrowings_student on book_borrowings(student_id);
create index if not exists idx_book_borrowings_status on book_borrowings(school_id, status);

create trigger trg_books_updated_at before update on books
  for each row execute function set_updated_at();
create trigger trg_book_borrowings_updated_at before update on book_borrowings
  for each row execute function set_updated_at();

alter table books enable row level security;
alter table book_borrowings enable row level security;

create policy tenant_isolation_books on books
  using (school_id = current_school_id());
create policy tenant_isolation_book_borrowings on book_borrowings
  using (school_id = current_school_id());