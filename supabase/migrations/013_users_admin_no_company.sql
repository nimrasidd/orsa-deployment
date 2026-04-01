-- Admins may have no company (see all tenants). Add a demo company-scoped user.

alter table public.users alter column company_id drop not null;

update public.users
set company_id = null
where lower(email) = 'admin@sir.com';

-- company@demo.com / password123 (same bcrypt as other seeds)
insert into public.users (id, email, password_hash, name, company_id, is_admin)
select
  'a0000000-0000-0000-0000-000000000002'::uuid,
  'company@demo.com',
  '$2b$12$qwBrFToCIo7RYw/zwhvXoOPhw9YFra.WU5AAqGtk3MiEwuTIidGaa',
  'Company User',
  (select id from public.companies where name = 'Demo Company' limit 1),
  false
where not exists (select 1 from public.users where lower(email) = 'company@demo.com')
  and exists (select 1 from public.companies where name = 'Demo Company');
