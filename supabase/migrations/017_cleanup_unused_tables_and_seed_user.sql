-- Cleanup legacy/unused tables and ensure login users exist.
-- Safe to run repeatedly (uses IF EXISTS / IF NOT EXISTS patterns).

-- ---------------------------------------------------------------------------
-- 1) Drop legacy mapping tables that are not used by the API
-- The backend uses `public.mapping` (single-table mapping rows), not:
-- - public.mappings
-- - public.mapping_items
-- and it uses uploads.mapping_config_id (text/uuid) rather than uploads.mapping_id.
-- ---------------------------------------------------------------------------

-- Drop the FK column added by 20260218_add_mappings.sql if present.
alter table public.uploads drop column if exists mapping_id;

-- Drop legacy tables (if present).
drop table if exists public.mapping_items;
drop table if exists public.mappings;

-- ---------------------------------------------------------------------------
-- 2) Ensure seed login users exist
-- (The main seeds live in 006/012/013, but this keeps fresh DBs usable.)
-- ---------------------------------------------------------------------------

-- Ensure admin@sir.com exists and is admin.
insert into public.users (email, password_hash, name, company_id, is_admin)
select
  'admin@sir.com',
  '$2b$12$qwBrFToCIo7RYw/zwhvXoOPhw9YFra.WU5AAqGtk3MiEwuTIidGaa', -- password123
  'Admin User',
  null,
  true
where not exists (select 1 from public.users where lower(email) = 'admin@sir.com');

-- Ensure a demo company-scoped user exists (company@demo.com / password123).
insert into public.users (email, password_hash, name, company_id, is_admin)
select
  'company@demo.com',
  '$2b$12$qwBrFToCIo7RYw/zwhvXoOPhw9YFra.WU5AAqGtk3MiEwuTIidGaa', -- password123
  'Company User',
  (select id from public.companies where name = 'Demo Company' limit 1),
  false
where not exists (select 1 from public.users where lower(email) = 'company@demo.com')
  and exists (select 1 from public.companies where name = 'Demo Company');

