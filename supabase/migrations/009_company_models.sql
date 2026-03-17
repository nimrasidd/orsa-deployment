-- Company models: models owned by a company (for mappings and uploads)
-- Replaces Region/Country/ApplicationModel flow for logged-in company users

create table if not exists public.company_models (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  unique(company_id, name)
);

alter table public.mapping add column if not exists company_model_id uuid references public.company_models(id);

create index if not exists idx_mapping_company_model_id on public.mapping(company_model_id);
