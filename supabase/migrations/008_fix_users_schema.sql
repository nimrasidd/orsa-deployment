-- Ensure users table has full login/register schema (for tables that only had 'name')
alter table public.users add column if not exists email text;
alter table public.users add column if not exists password_hash text;
alter table public.users add column if not exists company_id uuid references public.companies(id);
alter table public.users add column if not exists created_at timestamptz default now();

-- Add unique constraint on email if not exists
create unique index if not exists idx_users_email_unique on public.users(email) where email is not null;
