-- Expand report_nodes.value to support larger numbers (e.g. totals in billions)
-- numeric(18,4) max ~10^14; numeric(28,6) max ~10^22
alter table public.report_nodes
  alter column value type numeric(28, 6) using value::numeric(28, 6);
