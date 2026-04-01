-- Per-model mapping version: v1, v2, … in upload order (one row set per config_id).
-- Ensure at most one active config per model (clears duplicate Active flags from legacy data).

WITH cfg AS (
  SELECT model_id, config_id, MIN(uploaded_at) AS first_seen
  FROM public.mapping
  GROUP BY model_id, config_id
),
ord AS (
  SELECT model_id, config_id,
    ROW_NUMBER() OVER (
      PARTITION BY model_id
      ORDER BY first_seen ASC, config_id ASC
    ) AS new_version
  FROM cfg
)
UPDATE public.mapping m
SET version = o.new_version
FROM ord o
WHERE m.config_id = o.config_id
  AND m.model_id IS NOT DISTINCT FROM o.model_id;

-- Deactivate duplicate "active" configs: keep newest by upload time per model.
WITH active_configs AS (
  SELECT model_id, config_id, MAX(uploaded_at) AS mx
  FROM public.mapping
  WHERE is_active IS true
  GROUP BY model_id, config_id
),
ranked AS (
  SELECT model_id, config_id,
    ROW_NUMBER() OVER (
      PARTITION BY model_id
      ORDER BY mx DESC, config_id DESC
    ) AS rn
  FROM active_configs
),
losers AS (
  SELECT config_id FROM ranked WHERE rn > 1
)
UPDATE public.mapping
SET is_active = false
WHERE config_id IN (SELECT config_id FROM losers);
