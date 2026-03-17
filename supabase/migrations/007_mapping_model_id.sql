-- Link mappings to application models (model-based mapping)
alter table public.mapping add column if not exists model_id uuid references public.application_models(id);
create index if not exists idx_mapping_model_id on public.mapping(model_id);
