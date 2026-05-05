-- Migração: Trigger para atualizar balance dos bancos baseado em incomes
-- Quando uma income é criada/deletada/modificada, o balance do banco é ajustado automaticamente

-- Função para atualizar o balance do banco quando incomes mudam
CREATE OR REPLACE FUNCTION public.update_bank_balance_on_income_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Inserção: se is_realized=true e bank_id existe, aumenta o balance
    IF NEW.is_realized = true AND NEW.bank_id IS NOT NULL THEN
      UPDATE public.banks
      SET balance = balance + NEW.amount
      WHERE id = NEW.bank_id;
    END IF;
    RETURN NEW;
  
  ELSIF TG_OP = 'UPDATE' THEN
    -- Atualização: ajusta se is_realized, bank_id ou amount mudaram
    
    -- Caso 1: is_realized mudou de false para true
    IF OLD.is_realized = false AND NEW.is_realized = true AND NEW.bank_id IS NOT NULL THEN
      UPDATE public.banks
      SET balance = balance + NEW.amount
      WHERE id = NEW.bank_id;
    -- Caso 2: is_realized mudou de true para false
    ELSIF OLD.is_realized = true AND NEW.is_realized = false AND OLD.bank_id IS NOT NULL THEN
      UPDATE public.banks
      SET balance = balance - OLD.amount
      WHERE id = OLD.bank_id;
    -- Caso 3: bank_id mudou (entrada já realizada)
    ELSIF OLD.is_realized = true AND NEW.is_realized = true AND OLD.bank_id IS NOT NULL AND NEW.bank_id IS NOT NULL THEN
      IF OLD.bank_id <> NEW.bank_id THEN
        -- Remove do banco antigo
        UPDATE public.banks
        SET balance = balance - OLD.amount
        WHERE id = OLD.bank_id;
        -- Adiciona no banco novo
        UPDATE public.banks
        SET balance = balance + NEW.amount
        WHERE id = NEW.bank_id;
      -- Caso 3.1: Mesmo banco, mas amount mudou
      ELSIF OLD.amount <> NEW.amount THEN
        UPDATE public.banks
        SET balance = balance + (NEW.amount - OLD.amount)
        WHERE id = NEW.bank_id;
      END IF;
    -- Caso 4: amount mudou quando is_realized=true e bank_id é o mesmo
    ELSIF OLD.is_realized = true AND NEW.is_realized = true AND OLD.bank_id = NEW.bank_id AND OLD.amount <> NEW.amount THEN
      UPDATE public.banks
      SET balance = balance + (NEW.amount - OLD.amount)
      WHERE id = NEW.bank_id;
    END IF;
    RETURN NEW;
  
  ELSIF TG_OP = 'DELETE' THEN
    -- Deleção: se era realizada e tem bank_id, diminui o balance
    IF OLD.is_realized = true AND OLD.bank_id IS NOT NULL THEN
      UPDATE public.banks
      SET balance = balance - OLD.amount
      WHERE id = OLD.bank_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para INSERT
DROP TRIGGER IF EXISTS income_insert_update_bank_balance ON public.incomes;
CREATE TRIGGER income_insert_update_bank_balance
AFTER INSERT ON public.incomes
FOR EACH ROW
EXECUTE FUNCTION public.update_bank_balance_on_income_change();

-- Criar trigger para UPDATE
DROP TRIGGER IF EXISTS income_update_update_bank_balance ON public.incomes;
CREATE TRIGGER income_update_update_bank_balance
AFTER UPDATE ON public.incomes
FOR EACH ROW
EXECUTE FUNCTION public.update_bank_balance_on_income_change();

-- Criar trigger para DELETE
DROP TRIGGER IF EXISTS income_delete_update_bank_balance ON public.incomes;
CREATE TRIGGER income_delete_update_bank_balance
AFTER DELETE ON public.incomes
FOR EACH ROW
EXECUTE FUNCTION public.update_bank_balance_on_income_change();

-- ============================================================================
-- TRIGGERS PARA EXPENSES (SAÍDAS)
-- ============================================================================

-- Função para atualizar o balance do banco quando expenses mudam
CREATE OR REPLACE FUNCTION public.update_bank_balance_on_expense_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Inserção: se is_realized=true e bank_id existe, DIMINUI o balance
    IF NEW.is_realized = true AND NEW.bank_id IS NOT NULL THEN
      UPDATE public.banks
      SET balance = balance - NEW.amount
      WHERE id = NEW.bank_id;
    END IF;
    RETURN NEW;
  
  ELSIF TG_OP = 'UPDATE' THEN
    -- Atualização: ajusta se is_realized, bank_id ou amount mudam
    
    -- Caso 1: is_realized mudou de false para true (expense agora é deduzida)
    IF OLD.is_realized = false AND NEW.is_realized = true AND NEW.bank_id IS NOT NULL THEN
      UPDATE public.banks
      SET balance = balance - NEW.amount
      WHERE id = NEW.bank_id;
    -- Caso 2: is_realized mudou de true para false (expense deixa de ser deduzida)
    ELSIF OLD.is_realized = true AND NEW.is_realized = false AND OLD.bank_id IS NOT NULL THEN
      UPDATE public.banks
      SET balance = balance + OLD.amount
      WHERE id = OLD.bank_id;
    -- Caso 3: bank_id mudou (expense já realizada)
    ELSIF OLD.is_realized = true AND NEW.is_realized = true AND OLD.bank_id IS NOT NULL AND NEW.bank_id IS NOT NULL THEN
      IF OLD.bank_id <> NEW.bank_id THEN
        -- Soma de volta no banco antigo
        UPDATE public.banks
        SET balance = balance + OLD.amount
        WHERE id = OLD.bank_id;
        -- Deduz do banco novo
        UPDATE public.banks
        SET balance = balance - NEW.amount
        WHERE id = NEW.bank_id;
      -- Caso 3.1: Mesmo banco, mas amount mudou
      ELSIF OLD.amount <> NEW.amount THEN
        -- Se amount aumentou, deduz ainda mais; se diminuiu, soma de volta
        UPDATE public.banks
        SET balance = balance - (NEW.amount - OLD.amount)
        WHERE id = NEW.bank_id;
      END IF;
    -- Caso 4: amount mudou quando is_realized=true e bank_id é o mesmo
    ELSIF OLD.is_realized = true AND NEW.is_realized = true AND OLD.bank_id = NEW.bank_id AND OLD.amount <> NEW.amount THEN
      UPDATE public.banks
      SET balance = balance - (NEW.amount - OLD.amount)
      WHERE id = NEW.bank_id;
    END IF;
    RETURN NEW;
  
  ELSIF TG_OP = 'DELETE' THEN
    -- Deleção: se era realizada e tem bank_id, soma de volta
    IF OLD.is_realized = true AND OLD.bank_id IS NOT NULL THEN
      UPDATE public.banks
      SET balance = balance + OLD.amount
      WHERE id = OLD.bank_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para INSERT em expenses
DROP TRIGGER IF EXISTS expense_insert_update_bank_balance ON public.expenses;
CREATE TRIGGER expense_insert_update_bank_balance
AFTER INSERT ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_bank_balance_on_expense_change();

-- Criar trigger para UPDATE em expenses
DROP TRIGGER IF EXISTS expense_update_update_bank_balance ON public.expenses;
CREATE TRIGGER expense_update_update_bank_balance
AFTER UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_bank_balance_on_expense_change();

-- Criar trigger para DELETE em expenses
DROP TRIGGER IF EXISTS expense_delete_update_bank_balance ON public.expenses;
CREATE TRIGGER expense_delete_update_bank_balance
AFTER DELETE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_bank_balance_on_expense_change();
