-- Add mappings and mapping_items tables for Excel-based mapping configuration

create table if not exists public.mappings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null default 1,
  is_active boolean not null default false,
  uploaded_at timestamptz not null default now(),
  uploaded_by text,
  notes text
);

create table if not exists public.mapping_items (
  id uuid primary key default gen_random_uuid(),
  mapping_id uuid not null references public.mappings(id) on delete cascade,
  code text not null,
  description text,
  sheet_name text not null,
  cell_ref text not null,
  level integer not null,
  parent_code text,
  created_at timestamptz not null default now(),
  constraint mapping_items_mapping_code_unique unique (mapping_id, code)
);

create index if not exists idx_mapping_items_mapping_id on public.mapping_items(mapping_id);
create index if not exists idx_mapping_items_code on public.mapping_items(mapping_id, code);
create index if not exists idx_mapping_items_parent_code on public.mapping_items(mapping_id, parent_code);

-- Add mapping_id to uploads to track which mapping was used
alter table public.uploads add column if not exists mapping_id uuid references public.mappings(id);

create index if not exists idx_uploads_mapping_id on public.uploads(mapping_id);
