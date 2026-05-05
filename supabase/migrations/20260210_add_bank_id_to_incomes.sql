-- Adiciona a coluna bank_id na tabela incomes
ALTER TABLE public.incomes
ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL;
