-- Nested multi-model: parent bundle models + upload batch grouping
-- Parent = application_models.parent_model_id IS NULL
-- Children point at parent; mappings stay on children only.

alter table public.application_models
  add column if not exists parent_model_id uuid
    references public.application_models(id) on delete cascade;

create index if not exists idx_application_models_parent
  on public.application_models(parent_model_id);

alter table public.uploads
  add column if not exists upload_batch_id uuid;

create index if not exists idx_uploads_upload_batch_id
  on public.uploads(upload_batch_id);
