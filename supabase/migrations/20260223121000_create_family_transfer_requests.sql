-- Cobranças entre famílias por ID público

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'family_transfer_status'
  ) THEN
    CREATE TYPE public.family_transfer_status AS ENUM (
      'pending_confirmation',
      'confirmed_waiting_payment',
      'payment_received',
      'rejected'
    );
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.family_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creditor_member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  debtor_member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  creditor_expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  debtor_expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  creditor_income_id UUID REFERENCES public.incomes(id) ON DELETE SET NULL,
  creditor_bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  requested_date DATE NOT NULL,
  payment_date DATE,
  payment_bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL,
  status public.family_transfer_status NOT NULL DEFAULT 'pending_confirmation',
  confirmed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT family_transfer_requests_creditor_debtor_diff CHECK (creditor_member_id <> debtor_member_id)
);

CREATE INDEX IF NOT EXISTS idx_family_transfer_requests_creditor_member
  ON public.family_transfer_requests (creditor_member_id);

CREATE INDEX IF NOT EXISTS idx_family_transfer_requests_debtor_member
  ON public.family_transfer_requests (debtor_member_id);

CREATE INDEX IF NOT EXISTS idx_family_transfer_requests_status
  ON public.family_transfer_requests (status);

DROP TRIGGER IF EXISTS update_family_transfer_requests_updated_at ON public.family_transfer_requests;
CREATE TRIGGER update_family_transfer_requests_updated_at
  BEFORE UPDATE ON public.family_transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.family_transfer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family transfer select own" ON public.family_transfer_requests;
CREATE POLICY "family transfer select own"
  ON public.family_transfer_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.auth_user_id = auth.uid()
        AND (m.id = creditor_member_id OR m.id = debtor_member_id)
    )
  );

DROP POLICY IF EXISTS "family transfer insert creditor" ON public.family_transfer_requests;
CREATE POLICY "family transfer insert creditor"
  ON public.family_transfer_requests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id = creditor_member_id
        AND m.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "family transfer update participants" ON public.family_transfer_requests;
CREATE POLICY "family transfer update participants"
  ON public.family_transfer_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.auth_user_id = auth.uid()
        AND (m.id = creditor_member_id OR m.id = debtor_member_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.auth_user_id = auth.uid()
        AND (m.id = creditor_member_id OR m.id = debtor_member_id)
    )
  );

DROP POLICY IF EXISTS "family transfer delete creditor" ON public.family_transfer_requests;
CREATE POLICY "family transfer delete creditor"
  ON public.family_transfer_requests
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id = creditor_member_id
        AND m.auth_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.resolve_member_by_family_public_id(p_family_public_id TEXT)
RETURNS TABLE(member_id UUID, member_name TEXT, family_public_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.name, m.family_public_id
  FROM public.members m
  WHERE m.family_public_id = UPPER(TRIM(p_family_public_id))
    AND m.auth_user_id IS NOT NULL
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_member_by_family_public_id(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_member_by_family_public_id(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_family_transfer_payment(
  p_transfer_id UUID,
  p_debtor_member_id UUID,
  p_creditor_member_id UUID,
  p_amount NUMERIC,
  p_description TEXT,
  p_payment_date DATE,
  p_payment_bank_id UUID
)
RETURNS TABLE(
  transfer_id UUID,
  debtor_expense_id UUID,
  creditor_income_id UUID,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_debtor_expense_id UUID;
  v_creditor_income_id UUID;
  v_creditor_bank_id UUID;
  v_month INT;
  v_year INT;
BEGIN
  -- Calcular mês e ano
  v_month := EXTRACT(MONTH FROM p_payment_date);
  v_year := EXTRACT(YEAR FROM p_payment_date);

  -- Buscar creditor_bank_id da transfer
  SELECT creditor_bank_id INTO v_creditor_bank_id
  FROM public.family_transfer_requests
  WHERE id = p_transfer_id;

  -- Inserir despesa no debtor
  INSERT INTO public.expenses (
    member_id, bank_id, amount, description, date, month, year,
    is_recurring, is_realized, realized_date
  ) VALUES (
    p_debtor_member_id, p_payment_bank_id, p_amount,
    'Pagamento empréstimo: ' || p_description, p_payment_date,
    v_month, v_year, false, true, p_payment_date
  )
  RETURNING id INTO v_debtor_expense_id;

  -- Inserir income no creditor
  INSERT INTO public.incomes (
    member_id, amount, description, date, month, year,
    is_realized, realized_date, bank_id, income_source_id
  ) VALUES (
    p_creditor_member_id, p_amount,
    'Recebimento empréstimo: ' || p_description, p_payment_date,
    v_month, v_year, true, p_payment_date, v_creditor_bank_id, NULL
  )
  RETURNING id INTO v_creditor_income_id;

  -- Atualizar transfer request com status payment_received
  UPDATE public.family_transfer_requests
  SET
    status = 'payment_received',
    paid_at = now(),
    payment_date = p_payment_date,
    payment_bank_id = p_payment_bank_id,
    debtor_expense_id = v_debtor_expense_id,
    creditor_income_id = v_creditor_income_id,
    updated_at = now()
  WHERE id = p_transfer_id;

  -- Incrementar saldo do banco do creditor se existir
  IF v_creditor_bank_id IS NOT NULL THEN
    UPDATE public.banks
    SET balance = balance + p_amount
    WHERE id = v_creditor_bank_id
      AND owner_member_id = p_creditor_member_id;
  END IF;

  -- Retornar resultado
  RETURN QUERY
  SELECT
    p_transfer_id,
    v_debtor_expense_id,
    v_creditor_income_id,
    'payment_received'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.register_family_transfer_payment(UUID, UUID, UUID, NUMERIC, TEXT, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_family_transfer_payment(UUID, UUID, UUID, NUMERIC, TEXT, DATE, UUID) TO authenticated;
