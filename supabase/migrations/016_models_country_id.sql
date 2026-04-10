-- Map each mapping model (public.models) to a country for reporting/metadata.
alter table public.models add column if not exists country_id uuid references public.countries(id) on delete set null;

create index if not exists idx_models_country on public.models(country_id);
