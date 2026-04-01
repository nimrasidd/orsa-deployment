-- Mapping models are global; companies link via company_model (M2M).

create table if not exists public.company_model (
  company_id uuid not null references public.companies(id) on delete cascade,
  model_id uuid not null references public.models(id) on delete cascade,
  primary key (company_id, model_id)
);

create index if not exists idx_company_model_company on public.company_model(company_id);
create index if not exists idx_company_model_model on public.company_model(model_id);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'models' and column_name = 'company_id'
  ) then
    insert into public.company_model (company_id, model_id)
    select company_id, id from public.models
    where company_id is not null
    on conflict do nothing;
  end if;
end $$;

insert into public.company_model (company_id, model_id)
select c.id, m.id from public.companies c cross join public.models m
on conflict do nothing;

alter table public.models drop constraint if exists models_company_id_fkey;
alter table public.models drop constraint if exists models_company_id_name_key;

alter table public.models drop column if exists company_id;
