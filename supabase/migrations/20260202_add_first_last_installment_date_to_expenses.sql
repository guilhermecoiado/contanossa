-- Adiciona colunas para data da primeira e última parcela na tabela expenses
ALTER TABLE expenses
ADD COLUMN first_installment_date DATE NULL,
ADD COLUMN last_installment_date DATE NULL;