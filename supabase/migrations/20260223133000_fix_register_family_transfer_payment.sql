-- Fix bank balance update to use member_id instead of owner_member_id
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
  -- Calcular mes e ano
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
    'Pagamento emprestimo: ' || p_description, p_payment_date,
    v_month, v_year, false, true, p_payment_date
  )
  RETURNING id INTO v_debtor_expense_id;

  -- Inserir income no creditor
  INSERT INTO public.incomes (
    member_id, amount, description, date, month, year,
    is_realized, realized_date, bank_id, income_source_id
  ) VALUES (
    p_creditor_member_id, p_amount,
    'Recebimento emprestimo: ' || p_description, p_payment_date,
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
