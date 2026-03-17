-- Simple migration: DROP first, then CREATE

-- 1. DROP (reverse order for foreign keys)
drop table if exists public.mapping_items;
drop table if exists public.mappings;
drop table if exists public.report_nodes;
drop table if exists public.uploads;

-- 2. CREATE
create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  report_key text not null,
  version_no integer not null,
  original_filename text not null,
  uploaded_at timestamptz not null default now(),
  notes text,
  mapping_config_id text,
  constraint uploads_report_key_version_unique unique (report_key, version_no)
);

create table public.report_nodes (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.uploads(id) on delete cascade,
  code text not null,
  level integer not null,
  parent_code text,
  description text,
  value numeric(18, 4),
  sheet_name text not null,
  cell_ref text not null,
  created_at timestamptz not null default now()
);

create index idx_report_nodes_upload_id on public.report_nodes(upload_id);

-- Single mapping table: each row = one Code → Sheet, Cell. Rows with same config_id = one mapping.
create table public.mapping (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null,
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
create index idx_mapping_active on public.mapping(is_active) where is_active = true;
