-- Store creditor/debtor names for cross-family display
ALTER TABLE public.family_transfer_requests
  ADD COLUMN IF NOT EXISTS creditor_name TEXT,
  ADD COLUMN IF NOT EXISTS debtor_name TEXT;

-- Backfill names for existing rows
UPDATE public.family_transfer_requests ftr
SET
  creditor_name = COALESCE(ftr.creditor_name, c.name),
  debtor_name = COALESCE(ftr.debtor_name, d.name)
FROM public.members c
JOIN public.members d ON d.id = ftr.debtor_member_id
WHERE c.id = ftr.creditor_member_id;
