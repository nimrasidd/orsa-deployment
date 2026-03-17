-- Users table for application login (username/email + password from DB)
-- Run after companies exist (001, 003). Idempotent.

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text not null,
  company_id uuid not null references public.companies(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_email on public.users(lower(email));

-- Seed admin user: admin@sir.com / password123 (bcrypt hash)
insert into public.users (id, email, password_hash, name, company_id)
select
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'admin@sir.com',
  '$2b$12$qwBrFToCIo7RYw/zwhvXoOPhw9YFra.WU5AAqGtk3MiEwuTIidGaa',
  'Admin User',
  (select id from public.companies where name = 'SIR Consultants' limit 1)
where not exists (select 1 from public.users where email = 'admin@sir.com')
  and exists (select 1 from public.companies where name = 'SIR Consultants');
