-- Add GCC (Gulf Cooperation Council) region and its member countries
-- Run after 001_region_country_model.sql

-- 1. Add GCC region
insert into public.regions (name) values ('GCC')
on conflict (name) do nothing;

-- 2. Add GCC countries: Saudi Arabia, UAE, Qatar, Kuwait, Bahrain, Oman
insert into public.countries (region_id, name)
select r.id, t.name
from (values
  ('Saudi Arabia'),
  ('United Arab Emirates'),
  ('Qatar'),
  ('Kuwait'),
  ('Bahrain'),
  ('Oman')
) as t(name)
cross join (select id from public.regions where name = 'GCC' limit 1) r
on conflict (region_id, name) do nothing;
