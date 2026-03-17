-- Initial schema for hierarchical financial report uploads
-- This file is intended for Supabase (PostgreSQL) migrations.

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  report_key text not null,
  version_no integer not null,
  original_filename text not null,
  uploaded_at timestamptz not null default now(),
  notes text,

  constraint uploads_report_key_version_unique unique (report_key, version_no)
);

create table if not exists public.report_nodes (
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

create index if not exists idx_report_nodes_upload_id on public.report_nodes(upload_id);
create index if not exists idx_report_nodes_upload_code on public.report_nodes(upload_id, code);
create index if not exists idx_report_nodes_upload_parent_code on public.report_nodes(upload_id, parent_code);

