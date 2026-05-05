-- Migração Alternativa: Usar colunas separadas para offset manual
-- Mais simples e mais mantível do que encode/decode no trigger

-- 1. Adicionar colunas para armazenar ajustes manuais
ALTER TABLE public.cards 
ADD COLUMN IF NOT EXISTS used_limit_manual_offset NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS available_limit_manual_offset NUMERIC DEFAULT 0;

-- 2. Migrar dados antigos (values encoded) para as novas colunas
UPDATE public.cards
SET 
  used_limit_manual_offset = CASE 
    WHEN ABS(used_limit) >= 100000000000 THEN 
      CASE WHEN used_limit >= 0 THEN (used_limit - 1000000000000) ELSE (used_limit + 1000000000000) END
    ELSE 0
  END,
  available_limit_manual_offset = CASE 
    WHEN ABS(available_limit) >= 100000000000 THEN 
      CASE WHEN available_limit >= 0 THEN (available_limit - 1000000000000) ELSE (available_limit + 1000000000000) END
    ELSE 0
  END
WHERE ABS(used_limit) >= 100000000000 OR ABS(available_limit) >= 100000000000;

-- 3. Limpar os valores encoded para deixar apenas o calculado
UPDATE public.cards
SET 
  used_limit = CASE 
    WHEN ABS(used_limit) >= 100000000000 THEN 0
    ELSE used_limit
  END,
  available_limit = CASE 
    WHEN ABS(available_limit) >= 100000000000 THEN credit_limit
    ELSE available_limit
  END
WHERE ABS(used_limit) >= 100000000000 OR ABS(available_limit) >= 100000000000;

-- 4. Recriar o trigger de forma simples (sem encode/decode)
CREATE OR REPLACE FUNCTION public.update_card_limits_on_expense_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Inserção: reserva limite apenas se ainda NÃO foi realizada
    IF COALESCE(NEW.is_realized, false) = false AND NEW.card_id IS NOT NULL THEN
      UPDATE public.cards
      SET 
        available_limit = available_limit - NEW.amount,
        used_limit = used_limit + NEW.amount
      WHERE id = NEW.card_id;
    END IF;
    RETURN NEW;
  
  ELSIF TG_OP = 'UPDATE' THEN
    -- Atualização: ajusta se is_realized, card_id ou amount mudaram
    
    -- Caso 1: is_realized mudou de false para true (expense agora é REALIZADA - desfaz reserva)
    IF COALESCE(OLD.is_realized, false) = false AND COALESCE(NEW.is_realized, false) = true AND OLD.card_id IS NOT NULL THEN
      UPDATE public.cards
      SET 
        available_limit = available_limit + OLD.amount,
        used_limit = used_limit - OLD.amount
      WHERE id = OLD.card_id;
    -- Caso 2: is_realized mudou de true para false (expense volta a reservar limite)
    ELSIF COALESCE(OLD.is_realized, false) = true AND COALESCE(NEW.is_realized, false) = false AND NEW.card_id IS NOT NULL THEN
      UPDATE public.cards
      SET 
        available_limit = available_limit - NEW.amount,
        used_limit = used_limit + NEW.amount
      WHERE id = NEW.card_id;
    -- Caso 3: card_id mudou enquanto não realizada (ajusta reserva)
    ELSIF COALESCE(OLD.is_realized, false) = false AND COALESCE(NEW.is_realized, false) = false AND OLD.card_id IS NOT NULL AND NEW.card_id IS NOT NULL THEN
      IF OLD.card_id <> NEW.card_id THEN
        -- Remove reserva do cartão antigo
        UPDATE public.cards
        SET 
          available_limit = available_limit + OLD.amount,
          used_limit = used_limit - OLD.amount
        WHERE id = OLD.card_id;
        -- Aplica reserva no cartão novo
        UPDATE public.cards
        SET 
          available_limit = available_limit - NEW.amount,
          used_limit = used_limit + NEW.amount
        WHERE id = NEW.card_id;
      -- Caso 3.1: Mesmo cartão, mas amount mudou
      ELSIF OLD.amount <> NEW.amount THEN
        -- Ajusta reserva pela diferença
        UPDATE public.cards
        SET 
          available_limit = available_limit - (NEW.amount - OLD.amount),
          used_limit = used_limit + (NEW.amount - OLD.amount)
        WHERE id = NEW.card_id;
      END IF;
    END IF;
    RETURN NEW;
  
  ELSIF TG_OP = 'DELETE' THEN
    -- Deleção: se estava reservada (não realizada), desfaz reserva
    IF COALESCE(OLD.is_realized, false) = false AND OLD.card_id IS NOT NULL THEN
      UPDATE public.cards
      SET 
        available_limit = available_limit + OLD.amount,
        used_limit = used_limit - OLD.amount
      WHERE id = OLD.card_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Certificar que os triggers estão usando a função corrigida
DROP TRIGGER IF EXISTS expense_insert_update_card_limits ON public.expenses;
CREATE TRIGGER expense_insert_update_card_limits
AFTER INSERT ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_card_limits_on_expense_change();

DROP TRIGGER IF EXISTS expense_update_update_card_limits ON public.expenses;
CREATE TRIGGER expense_update_update_card_limits
AFTER UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_card_limits_on_expense_change();

DROP TRIGGER IF EXISTS expense_delete_update_card_limits ON public.expenses;
CREATE TRIGGER expense_delete_update_card_limits
AFTER DELETE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_card_limits_on_expense_change();
