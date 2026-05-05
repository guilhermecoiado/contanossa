-- Adiciona as colunas bank_id e output_mode na tabela expenses
ALTER TABLE public.expenses
ADD COLUMN bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
ADD COLUMN output_mode TEXT;
