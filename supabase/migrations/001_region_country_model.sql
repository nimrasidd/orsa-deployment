-- Region-Country-Model schema extension
-- Run after 000_full_schema.sql

-- 1. Master data tables
create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on delete cascade,
  name text not null,
  unique(region_id, name)
);

create table if not exists public.application_models (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  name text not null,
  unique(country_id, name)
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region_id uuid not null references public.regions(id) on delete restrict,
  unique(name, region_id)
);

-- 2. Extend uploads
alter table public.uploads add column if not exists region_id uuid references public.regions(id);
alter table public.uploads add column if not exists country_id uuid references public.countries(id);
alter table public.uploads add column if not exists model_id uuid references public.application_models(id);
alter table public.uploads add column if not exists company_id uuid references public.companies(id);
alter table public.uploads add column if not exists report_year integer;
alter table public.uploads add column if not exists report_month integer;

-- 3. Reporting period applicability (which regions a file applies to)
create table if not exists public.report_region_applicability (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.uploads(id) on delete cascade,
  region_id uuid not null references public.regions(id) on delete cascade,
  unique(upload_id, region_id)
);

create index if not exists idx_report_region_applicability_upload on public.report_region_applicability(upload_id);
create index if not exists idx_report_region_applicability_region on public.report_region_applicability(region_id);

-- 4. Indexes for filtered queries
create index if not exists idx_uploads_region on public.uploads(region_id);
create index if not exists idx_uploads_country on public.uploads(country_id);
create index if not exists idx_uploads_model on public.uploads(model_id);
create index if not exists idx_uploads_company on public.uploads(company_id);
create index if not exists idx_uploads_report_period on public.uploads(report_year, report_month);

-- 5. Seed minimal master data (idempotent)
insert into public.regions (name) values ('APAC'), ('EMEA'), ('Americas')
on conflict (name) do nothing;

insert into public.countries (region_id, name)
select r.id, t.name from (values ('Pakistan'), ('India')) as t(name)
cross join (select id from public.regions where name = 'APAC' limit 1) r
on conflict (region_id, name) do nothing;

insert into public.countries (region_id, name)
select r.id, 'UK' from public.regions r where r.name = 'EMEA' limit 1
on conflict (region_id, name) do nothing;

insert into public.application_models (country_id, name)
select c.id, t.name from (values ('SCR'), ('OSRA')) as t(name)
cross join (select c.id from public.countries c join public.regions r on c.region_id = r.id where r.name = 'APAC' and c.name = 'Pakistan' limit 1) c
on conflict (country_id, name) do nothing;

insert into public.application_models (country_id, name)
select c.id, 'SCR' from public.countries c join public.regions r on c.region_id = r.id where r.name = 'APAC' and c.name = 'India' limit 1
on conflict (country_id, name) do nothing;

insert into public.companies (name, region_id)
select t.n, r.id from (values ('SIR Consultants'), ('Demo Company')) as t(n)
cross join (select id from public.regions where name = 'APAC' limit 1) r
on conflict (name, region_id) do nothing;
