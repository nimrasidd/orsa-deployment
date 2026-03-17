-- Parent models table: model + company + user who created it
-- Mapping references this table for model-based mapping (replaces company_models + application_models FK)

-- 1. Create models table (company, creator, name)
create table if not exists public.models (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by_user_id uuid references public.users(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now(),
  unique(company_id, name)
);

create index if not exists idx_models_company on public.models(company_id);
create index if not exists idx_models_created_by on public.models(created_by_user_id);

-- 2. Migrate company_models into models (preserve id so mapping FK works)
-- Runs only if company_models exists (from 009)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'company_models') then
    insert into public.models (id, company_id, created_by_user_id, name, created_at)
    select id, company_id, null, name, now() from public.company_models;
  end if;
end $$;

-- 3. Update mapping: drop old FKs, add model_id -> models
alter table public.mapping drop constraint if exists mapping_model_id_fkey;
alter table public.mapping drop constraint if exists mapping_company_model_id_fkey;

-- Add new model_id column referencing models
alter table public.mapping add column if not exists model_id_new uuid references public.models(id);

-- Migrate: set model_id_new from company_model_id (ids match) if column exists
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'mapping' and column_name = 'company_model_id') then
    update public.mapping set model_id_new = company_model_id where company_model_id is not null;
    alter table public.mapping drop column company_model_id;
  end if;
end $$;

alter table public.mapping drop column if exists model_id;
alter table public.mapping rename column model_id_new to model_id;

create index if not exists idx_mapping_model_id on public.mapping(model_id);

-- 4. Drop company_models (replaced by models)
drop table if exists public.company_models;
