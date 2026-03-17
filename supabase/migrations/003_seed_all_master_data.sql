-- Seed all master data for Upload page dropdowns (PostgreSQL)
-- Run after 001_region_country_model.sql and 002_add_gcc_region_countries.sql
-- Idempotent: safe to run multiple times

-- 1. Regions (APAC, EMEA, Americas, GCC)
insert into public.regions (name) values
  ('APAC'), ('EMEA'), ('Americas'), ('GCC')
on conflict (name) do nothing;

-- 2. Countries per region
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

-- 3. Application models (SCR, OSRA) per country
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
select c.id, 'SCR' from public.countries c join public.regions r on c.region_id = r.id where r.name = 'EMEA' and c.name in ('Germany', 'France')
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
select c.id, 'SCR' from public.countries c join public.regions r on c.region_id = r.id where r.name = 'GCC'
on conflict (country_id, name) do nothing;

-- 4. Companies per region (country_id backfilled by 004_companies_country_id.sql)
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
