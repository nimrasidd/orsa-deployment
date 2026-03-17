-- Ensure uploads has mapping_config_id (for create_upload_with_nodes)
alter table public.uploads add column if not exists mapping_config_id text;
