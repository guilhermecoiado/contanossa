-- Migração: Adicionar coluna is_blocked na tabela cards
-- Permite bloquear cartões para que não apareçam na lista de cartões ao lançar saídas

ALTER TABLE public.cards
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;

-- Create index para buscar cartões desbloqueados mais rapidamente
CREATE INDEX IF NOT EXISTS idx_cards_is_blocked ON public.cards(is_blocked);
