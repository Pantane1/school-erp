-- ============================================================
-- 005_finance.sql
-- Finance: fee categories, fee structures, invoices, payments, discounts
-- ============================================================

-- ------------------------------------------------------------
-- FEE CATEGORIES (tuition, transport, hostel, library fine, etc.)
-- ------------------------------------------------------------
create table if not exists fee_categories (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

-- ------------------------------------------------------------
-- FEE STRUCTURES (how much a class owes per category, per term)
-- ------------------------------------------------------------
create table if not exists fee_structures (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  fee_category_id uuid not null references fee_categories(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade, -- null = applies to all classes
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  term_id uuid references terms(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- DISCOUNTS / SCHOLARSHIPS (per student)
-- ------------------------------------------------------------
create table if not exists student_discounts (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  fee_category_id uuid references fee_categories(id) on delete cascade, -- null = applies to whole invoice
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  value numeric(12,2) not null check (value >= 0),
  reason text,
  academic_year_id uuid references academic_years(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- INVOICES (one per student per term, generated from fee_structures)
-- ------------------------------------------------------------
create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  term_id uuid references terms(id) on delete set null,
  total_amount numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid', 'overdue', 'cancelled')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoice_items (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  fee_category_id uuid references fee_categories(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0)
);

-- ------------------------------------------------------------
-- PAYMENTS
-- ------------------------------------------------------------
create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('mpesa', 'cash', 'bank', 'cheque', 'other')),
  reference text, -- bank slip no. / cheque no. / internal reference
  mpesa_receipt_number text, -- populated once Daraja STK push confirms
  mpesa_checkout_request_id text, -- used to reconcile the STK push callback
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'reversed')),
  recorded_by uuid references users(id) on delete set null,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_fee_categories_school on fee_categories(school_id);
create index if not exists idx_fee_structures_school on fee_structures(school_id);
create index if not exists idx_fee_structures_class_term on fee_structures(class_id, term_id);
create index if not exists idx_student_discounts_school on student_discounts(school_id);
create index if not exists idx_student_discounts_student on student_discounts(student_id);
create index if not exists idx_invoices_school on invoices(school_id);
create index if not exists idx_invoices_student on invoices(student_id);
create index if not exists idx_invoices_status on invoices(school_id, status);
create index if not exists idx_invoice_items_invoice on invoice_items(invoice_id);
create index if not exists idx_payments_school on payments(school_id);
create index if not exists idx_payments_student on payments(student_id);
create index if not exists idx_payments_invoice on payments(invoice_id);
create unique index if not exists uq_payments_mpesa_checkout on payments(mpesa_checkout_request_id)
  where (mpesa_checkout_request_id is not null);

create trigger trg_invoices_updated_at before update on invoices
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table fee_categories enable row level security;
alter table fee_structures enable row level security;
alter table student_discounts enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table payments enable row level security;

create policy tenant_isolation_fee_categories on fee_categories
  using (school_id = current_school_id());
create policy tenant_isolation_fee_structures on fee_structures
  using (school_id = current_school_id());
create policy tenant_isolation_student_discounts on student_discounts
  using (school_id = current_school_id());
create policy tenant_isolation_invoices on invoices
  using (school_id = current_school_id());
create policy tenant_isolation_payments on payments
  using (school_id = current_school_id());
create policy tenant_isolation_invoice_items on invoice_items
  using (exists (
    select 1 from invoices i where i.id = invoice_id and i.school_id = current_school_id()
  ));