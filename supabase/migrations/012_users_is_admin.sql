-- Admin flag: full access. Other users stay scoped to their company_id.

alter table public.users add column if not exists is_admin boolean not null default false;

update public.users
set is_admin = true
where email = 'admin@sir.com';
