-- Adiciona campos para controle de realização de entradas
ALTER TABLE public.incomes
ADD COLUMN IF NOT EXISTS is_realized BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.incomes
ADD COLUMN IF NOT EXISTS realized_date DATE;
