ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS cdb_bank_name TEXT,
ADD COLUMN IF NOT EXISTS cdb_indexer TEXT,
ADD COLUMN IF NOT EXISTS cdb_rate_percent DECIMAL(12,4);

