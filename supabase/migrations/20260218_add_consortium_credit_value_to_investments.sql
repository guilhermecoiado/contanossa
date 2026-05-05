ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS consortium_credit_value DECIMAL(12,2);

