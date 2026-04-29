-- ORSA_new: single-run schema + seeds (PostgreSQL)
-- This script is designed to be pasted/run as ONE script in a SQL tool.
-- It does NOT use psql meta-commands (\i, \echo).
--
-- Creates only the tables the current FastAPI backend queries:
-- regions, countries, application_models, companies, users,
-- uploads, report_nodes, report_region_applicability, mapping
--
-- Seeds:
-- - master data (regions/countries/application_models/companies)
-- - admin user: admin@sir.com / password123
-- - demo user:  company@demo.com / password123

begin;

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- DROP (clean slate)
-- ---------------------------------------------------------------------------
drop table if exists public.report_region_applicability;
drop table if exists public.report_nodes;
drop table if exists public.uploads;
drop table if exists public.mapping;
drop table if exists public.users;
drop table if exists public.companies;
drop table if exists public.application_models;
drop table if exists public.countries;
drop table if exists public.regions;

-- Legacy/unused (safe to drop if they exist)
drop table if exists public.mapping_items;
drop table if exists public.mappings;
drop table if exists public.company_models;
drop table if exists public.company_model;
drop table if exists public.models;

-- ---------------------------------------------------------------------------
-- MASTER DATA
-- ---------------------------------------------------------------------------
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.countries (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on delete cascade,
  name text not null,
  unique (region_id, name)
);

create table public.application_models (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  name text not null,
  unique (country_id, name)
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region_id uuid not null references public.regions(id) on delete restrict,
  country_id uuid references public.countries(id),
  unique (name, region_id)
);

-- ---------------------------------------------------------------------------
-- USERS (login)
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  name text not null,
  company_id uuid references public.companies(id) on delete restrict,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index idx_users_email_unique on public.users (lower(email));

-- ---------------------------------------------------------------------------
-- UPLOADS + REPORT NODES
-- ---------------------------------------------------------------------------
create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  report_key text not null,
  version_no integer not null,
  original_filename text not null,
  uploaded_at timestamptz not null default now(),
  notes text,
  mapping_config_id text,

  region_id uuid references public.regions(id),
  country_id uuid references public.countries(id),
  model_id uuid references public.application_models(id),
  company_id uuid references public.companies(id),
  report_year integer,
  report_month integer,

  constraint uploads_report_key_version_unique unique (report_key, version_no)
);

create index idx_uploads_region on public.uploads(region_id);
create index idx_uploads_country on public.uploads(country_id);
create index idx_uploads_model on public.uploads(model_id);
create index idx_uploads_company on public.uploads(company_id);
create index idx_uploads_report_period on public.uploads(report_year, report_month);

create table public.report_region_applicability (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.uploads(id) on delete cascade,
  region_id uuid not null references public.regions(id) on delete cascade,
  unique (upload_id, region_id)
);

create index idx_report_region_applicability_upload on public.report_region_applicability(upload_id);
create index idx_report_region_applicability_region on public.report_region_applicability(region_id);

create table public.report_nodes (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.uploads(id) on delete cascade,
  code text not null,
  level integer not null,
  parent_code text,
  description text,
  value numeric(28, 6),
  sheet_name text not null,
  cell_ref text not null,
  created_at timestamptz not null default now()
);

create index idx_report_nodes_upload_id on public.report_nodes(upload_id);
create index idx_report_nodes_upload_code on public.report_nodes(upload_id, code);
create index idx_report_nodes_upload_parent_code on public.report_nodes(upload_id, parent_code);

-- ---------------------------------------------------------------------------
-- MAPPING (single-table: one row per code, grouped by config_id)
-- ---------------------------------------------------------------------------
create table public.mapping (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null,
  model_id uuid references public.application_models(id),
  name text not null,
  version integer not null default 1,
  is_active boolean not null default false,
  uploaded_at timestamptz not null default now(),
  notes text,
  code text not null,
  description text,
  sheet_name text not null,
  cell_ref text not null,
  level integer not null,
  parent_code text
);

create index idx_mapping_config_id on public.mapping(config_id);
create index idx_mapping_model_id on public.mapping(model_id);
create index idx_mapping_active on public.mapping(is_active) where is_active = true;

-- ---------------------------------------------------------------------------
-- SEEDS (master data)
-- ---------------------------------------------------------------------------
insert into public.regions (name) values
  ('APAC'), ('EMEA'), ('Americas'), ('GCC')
on conflict (name) do nothing;

-- Countries per region
insert into public.countries (region_id, name)
select r.id, t.name from (values ('Pakistan'), ('India')) as t(name)
cross join (select id from public.regions where name = 'APAC' limit 1) r
on conflict (region_id, name) do nothing;

insert into public.countries (region_id, name)
select r.id, t.name from (values ('UK'), ('Germany'), ('France')) as t(name)
cross join (select id from public.regions where name = 'EMEA' limit 1) r
on conflict (region_id, name) do nothing;

insert into public.countries (region_id, name)
select r.id, t.name from (values ('USA'), ('Canada')) as t(name)
cross join (select id from public.regions where name = 'Americas' limit 1) r
on conflict (region_id, name) do nothing;

insert into public.countries (region_id, name)
select r.id, t.name from (values
  ('Saudi Arabia'), ('United Arab Emirates'), ('Qatar'),
  ('Kuwait'), ('Bahrain'), ('Oman')
) as t(name)
cross join (select id from public.regions where name = 'GCC' limit 1) r
on conflict (region_id, name) do nothing;

-- Application models per country
insert into public.application_models (country_id, name)
select c.id, t.name from (values ('SCR'), ('OSRA')) as t(name)
cross join (select c.id from public.countries c join public.regions r on c.region_id = r.id where r.name = 'APAC' and c.name = 'Pakistan' limit 1) c
on conflict (country_id, name) do nothing;

insert into public.application_models (country_id, name)
select c.id, t.name from (values ('SCR'), ('OSRA')) as t(name)
cross join (select c.id from public.countries c join public.regions r on c.region_id = r.id where r.name = 'APAC' and c.name = 'India' limit 1) c
on conflict (country_id, name) do nothing;

insert into public.application_models (country_id, name)
select c.id, t.name from (values ('SCR'), ('Solvency II')) as t(name)
cross join (select c.id from public.countries c join public.regions r on c.region_id = r.id where r.name = 'EMEA' and c.name = 'UK' limit 1) c
on conflict (country_id, name) do nothing;

insert into public.application_models (country_id, name)
select c.id, 'SCR'
from public.countries c
join public.regions r on c.region_id = r.id
where r.name = 'EMEA' and c.name in ('Germany', 'France')
on conflict (country_id, name) do nothing;

insert into public.application_models (country_id, name)
select c.id, t.name from (values ('SCR'), ('OSRA')) as t(name)
cross join (select c.id from public.countries c join public.regions r on c.region_id = r.id where r.name = 'Americas' and c.name = 'USA' limit 1) c
on conflict (country_id, name) do nothing;

insert into public.application_models (country_id, name)
select c.id, t.name from (values ('SCR'), ('OSRA')) as t(name)
cross join (select c.id from public.countries c join public.regions r on c.region_id = r.id where r.name = 'Americas' and c.name = 'Canada' limit 1) c
on conflict (country_id, name) do nothing;

insert into public.application_models (country_id, name)
select c.id, 'SCR'
from public.countries c
join public.regions r on c.region_id = r.id
where r.name = 'GCC'
on conflict (country_id, name) do nothing;

-- Companies per region (country_id backfilled as "first country in region")
insert into public.companies (name, region_id)
select t.n, r.id from (values ('SIR Consultants'), ('Demo Company')) as t(n)
cross join (select id from public.regions where name = 'APAC' limit 1) r
on conflict (name, region_id) do nothing;

insert into public.companies (name, region_id)
select t.n, r.id from (values ('UK Insurance Co'), ('EMEA Corp')) as t(n)
cross join (select id from public.regions where name = 'EMEA' limit 1) r
on conflict (name, region_id) do nothing;

insert into public.companies (name, region_id)
select t.n, r.id from (values ('GCC Insurance'), ('Gulf Corp')) as t(n)
cross join (select id from public.regions where name = 'GCC' limit 1) r
on conflict (name, region_id) do nothing;

update public.companies c
set country_id = (
  select co.id from public.countries co
  where co.region_id = c.region_id
  order by co.name limit 1
)
where c.country_id is null;

-- ---------------------------------------------------------------------------
-- SEEDS (users)
-- bcrypt hash corresponds to "password123"
-- ---------------------------------------------------------------------------
insert into public.users (email, password_hash, name, company_id, is_admin)
select
  'admin@sir.com',
  '$2b$12$qwBrFToCIo7RYw/zwhvXoOPhw9YFra.WU5AAqGtk3MiEwuTIidGaa',
  'Admin User',
  null,
  true
where not exists (select 1 from public.users where lower(email) = 'admin@sir.com');

insert into public.users (email, password_hash, name, company_id, is_admin)
select
  'company@demo.com',
  '$2b$12$qwBrFToCIo7RYw/zwhvXoOPhw9YFra.WU5AAqGtk3MiEwuTIidGaa',
  'Company User',
  (select id from public.companies where name = 'Demo Company' limit 1),
  false
where not exists (select 1 from public.users where lower(email) = 'company@demo.com')
  and exists (select 1 from public.companies where name = 'Demo Company');

commit;

