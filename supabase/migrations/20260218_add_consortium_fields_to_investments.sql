ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS consortium_monthly_value DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS consortium_term_months INTEGER,
ADD COLUMN IF NOT EXISTS consortium_is_contemplated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consortium_contemplated_value DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS consortium_will_sell BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consortium_sale_value DECIMAL(12,2);

