-- Adiciona campos para empréstimo de cartão na tabela de despesas
ALTER TABLE public.expenses
ADD COLUMN end_card BOOLEAN DEFAULT FALSE;

ALTER TABLE public.expenses
ADD COLUMN lend_to TEXT;