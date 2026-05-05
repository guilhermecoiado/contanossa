
-- RLS para debts
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para debts (acesso por member_id da família)
CREATE POLICY "debts_select_family"
    ON public.debts FOR SELECT
    USING (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "debts_insert_family"
    ON public.debts FOR INSERT
    WITH CHECK (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "debts_update_family"
    ON public.debts FOR UPDATE
    USING (member_id IN (SELECT get_my_family_member_ids()))
    WITH CHECK (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "debts_delete_family"
    ON public.debts FOR DELETE
    USING (member_id IN (SELECT get_my_family_member_ids()));
