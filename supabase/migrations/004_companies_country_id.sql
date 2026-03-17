-- Add country_id to companies so region and country can be derived from company selection
alter table public.companies add column if not exists country_id uuid references public.countries(id);

-- Backfill: set country_id from first country in company's region (for existing rows)
update public.companies c
set country_id = (
  select co.id from public.countries co
  where co.region_id = c.region_id
  order by co.name limit 1
)
where c.country_id is null;
