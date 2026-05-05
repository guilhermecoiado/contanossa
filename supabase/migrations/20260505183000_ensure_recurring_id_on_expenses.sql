-- Ensure installment series identifier exists and is populated.
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS recurring_id UUID;

CREATE INDEX IF NOT EXISTS idx_expenses_recurring_id
  ON public.expenses(recurring_id);

-- Backfill recurring_id for legacy installment rows that don't have it yet.
WITH base_rows AS (
  SELECT
    e.id,
    e.member_id,
    COALESCE(e.card_id::text, '') AS card_id_key,
    COALESCE(e.bank_id::text, '') AS bank_id_key,
    COALESCE(e.category_id::text, '') AS category_id_key,
    COALESCE(e.custom_category_id::text, '') AS custom_category_id_key,
    e.total_installments,
    e.amount,
    regexp_replace(e.description, '\\s*\\(\\d+\\/\\d+\\)\\s*$', '') AS base_description,
    (e.date - ((COALESCE(e.installment_number, 1) - 1) * INTERVAL '1 month'))::date AS series_start_date
  FROM public.expenses e
  WHERE COALESCE(e.total_installments, 0) > 1
    AND COALESCE(e.installment_number, 0) > 0
    AND e.recurring_id IS NULL
),
series_groups AS (
  SELECT DISTINCT
    member_id,
    card_id_key,
    bank_id_key,
    category_id_key,
    custom_category_id_key,
    total_installments,
    amount,
    base_description,
    series_start_date,
    gen_random_uuid() AS generated_recurring_id
  FROM base_rows
),
rows_to_update AS (
  SELECT
    b.id,
    g.generated_recurring_id
  FROM base_rows b
  JOIN series_groups g
    ON g.member_id = b.member_id
   AND g.card_id_key = b.card_id_key
   AND g.bank_id_key = b.bank_id_key
   AND g.category_id_key = b.category_id_key
   AND g.custom_category_id_key = b.custom_category_id_key
   AND g.total_installments = b.total_installments
   AND g.amount = b.amount
   AND g.base_description = b.base_description
   AND g.series_start_date = b.series_start_date
)
UPDATE public.expenses e
SET recurring_id = u.generated_recurring_id
FROM rows_to_update u
WHERE e.id = u.id
  AND e.recurring_id IS NULL;