-- Adiciona novamente a coluna is_recurring na tabela expenses
ALTER TABLE expenses
ADD COLUMN is_recurring BOOLEAN NOT NULL DEFAULT FALSE;