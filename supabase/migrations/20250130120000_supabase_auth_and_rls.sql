-- ============================================================
-- Migração: Supabase Auth + RLS por família
-- ============================================================
-- 1. Adiciona auth_user_id e family_id em members
-- 2. Torna password_hash opcional (novos membros usam Supabase Auth)
-- 3. Backfill family_id para membros existentes (uma família única)
-- 4. Remove políticas antigas e cria novas baseadas em auth.uid()
-- ============================================================

-- 1) Novas colunas em members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE,
  ADD COLUMN IF NOT EXISTS family_id UUID;

-- 2) password_hash opcional para novos cadastros (Supabase Auth)
ALTER TABLE public.members
  ALTER COLUMN password_hash DROP NOT NULL;

-- 3) Backfill: membros existentes compartilham o mesmo family_id
DO $$
DECLARE
  shared_family_id UUID := gen_random_uuid();
BEGIN
  UPDATE public.members
  SET family_id = shared_family_id
  WHERE family_id IS NULL;
END $$;

-- Garantir que novos members tenham family_id (constraint depois)
-- Por enquanto deixamos nullable para o backfill ter funcionado.

-- 4) Função auxiliar: obter family_id do usuário logado (com SECURITY DEFINER para não disparar RLS)
CREATE OR REPLACE FUNCTION public.get_current_user_family_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- 5) Função auxiliar: IDs dos membros da minha família (usando get_current_user_family_id)
CREATE OR REPLACE FUNCTION public.get_my_family_member_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.members
  WHERE family_id = get_current_user_family_id()
  AND family_id IS NOT NULL;
$$;

-- 6) Remover políticas antigas
DROP POLICY IF EXISTS "Allow all operations on members" ON public.members;
DROP POLICY IF EXISTS "Allow all operations on income_sources" ON public.income_sources;
DROP POLICY IF EXISTS "Allow read on expense_categories" ON public.expense_categories;
DROP POLICY IF EXISTS "Allow all operations on banks" ON public.banks;
DROP POLICY IF EXISTS "Allow all operations on cards" ON public.cards;
DROP POLICY IF EXISTS "Allow all operations on investments" ON public.investments;
DROP POLICY IF EXISTS "Allow all operations on incomes" ON public.incomes;
DROP POLICY IF EXISTS "Allow all operations on expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow all operations on recurring_expenses" ON public.recurring_expenses;

-- Remover todas as novas políticas que possam existir
DROP POLICY IF EXISTS "members_select_family" ON public.members;
DROP POLICY IF EXISTS "members_insert_own" ON public.members;
DROP POLICY IF EXISTS "members_update_family" ON public.members;
DROP POLICY IF EXISTS "members_delete_family" ON public.members;
DROP POLICY IF EXISTS "income_sources_select" ON public.income_sources;
DROP POLICY IF EXISTS "income_sources_insert" ON public.income_sources;
DROP POLICY IF EXISTS "income_sources_update" ON public.income_sources;
DROP POLICY IF EXISTS "income_sources_delete" ON public.income_sources;
DROP POLICY IF EXISTS "expense_categories_select" ON public.expense_categories;
DROP POLICY IF EXISTS "banks_select" ON public.banks;
DROP POLICY IF EXISTS "banks_insert" ON public.banks;
DROP POLICY IF EXISTS "banks_update" ON public.banks;
DROP POLICY IF EXISTS "banks_delete" ON public.banks;
DROP POLICY IF EXISTS "cards_select" ON public.cards;
DROP POLICY IF EXISTS "cards_insert" ON public.cards;
DROP POLICY IF EXISTS "cards_update" ON public.cards;
DROP POLICY IF EXISTS "cards_delete" ON public.cards;
DROP POLICY IF EXISTS "investments_select" ON public.investments;
DROP POLICY IF EXISTS "investments_insert" ON public.investments;
DROP POLICY IF EXISTS "investments_update" ON public.investments;
DROP POLICY IF EXISTS "investments_delete" ON public.investments;
DROP POLICY IF EXISTS "incomes_select" ON public.incomes;
DROP POLICY IF EXISTS "incomes_insert" ON public.incomes;
DROP POLICY IF EXISTS "incomes_update" ON public.incomes;
DROP POLICY IF EXISTS "incomes_delete" ON public.incomes;
DROP POLICY IF EXISTS "expenses_select" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete" ON public.expenses;
DROP POLICY IF EXISTS "recurring_expenses_select" ON public.recurring_expenses;
DROP POLICY IF EXISTS "recurring_expenses_insert" ON public.recurring_expenses;
DROP POLICY IF EXISTS "recurring_expenses_update" ON public.recurring_expenses;
DROP POLICY IF EXISTS "recurring_expenses_delete" ON public.recurring_expenses;

-- 7) Novas políticas: members (família = quem tem auth_user_id logado)
-- IMPORTANTE: Evitar SELECTs na tabela members dentro das políticas para evitar recursão infinita!
CREATE POLICY "members_select_family"
  ON public.members FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      auth_user_id = auth.uid()
      OR family_id = get_current_user_family_id()
    )
  );

CREATE POLICY "members_insert_own"
  ON public.members FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- Primeiro membro: cria com auth_user_id e novo family_id
      (auth_user_id = auth.uid() AND family_id IS NOT NULL)
      OR
      -- Membro da família: sem auth_user_id, mesmo family_id do usuário logado
      (
        auth_user_id IS NULL
        AND family_id = get_current_user_family_id()
      )
    )
  );

CREATE POLICY "members_update_family"
  ON public.members FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      auth_user_id = auth.uid()
      OR family_id = get_current_user_family_id()
    )
  )
  WITH CHECK (true);

CREATE POLICY "members_delete_family"
  ON public.members FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND family_id = get_current_user_family_id()
  );

-- 8) income_sources: por família
CREATE POLICY "income_sources_select"
  ON public.income_sources FOR SELECT
  USING (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "income_sources_insert"
  ON public.income_sources FOR INSERT
  WITH CHECK (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "income_sources_update"
  ON public.income_sources FOR UPDATE
  USING (member_id IN (SELECT get_my_family_member_ids()))
  WITH CHECK (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "income_sources_delete"
  ON public.income_sources FOR DELETE
  USING (member_id IN (SELECT get_my_family_member_ids()));

-- 9) expense_categories: leitura pública (categorias padrão)
CREATE POLICY "expense_categories_select"
  ON public.expense_categories FOR SELECT
  USING (true);

-- 10) banks: por família
CREATE POLICY "banks_select"
  ON public.banks FOR SELECT
  USING (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "banks_insert"
  ON public.banks FOR INSERT
  WITH CHECK (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "banks_update"
  ON public.banks FOR UPDATE
  USING (member_id IN (SELECT get_my_family_member_ids()))
  WITH CHECK (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "banks_delete"
  ON public.banks FOR DELETE
  USING (member_id IN (SELECT get_my_family_member_ids()));

-- 11) cards: por família
CREATE POLICY "cards_select"
  ON public.cards FOR SELECT
  USING (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "cards_insert"
  ON public.cards FOR INSERT
  WITH CHECK (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "cards_update"
  ON public.cards FOR UPDATE
  USING (member_id IN (SELECT get_my_family_member_ids()))
  WITH CHECK (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "cards_delete"
  ON public.cards FOR DELETE
  USING (member_id IN (SELECT get_my_family_member_ids()));

-- 12) investments: por família
CREATE POLICY "investments_select"
  ON public.investments FOR SELECT
  USING (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "investments_insert"
  ON public.investments FOR INSERT
  WITH CHECK (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "investments_update"
  ON public.investments FOR UPDATE
  USING (member_id IN (SELECT get_my_family_member_ids()))
  WITH CHECK (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "investments_delete"
  ON public.investments FOR DELETE
  USING (member_id IN (SELECT get_my_family_member_ids()));

-- 13) incomes: por família
CREATE POLICY "incomes_select"
  ON public.incomes FOR SELECT
  USING (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "incomes_insert"
  ON public.incomes FOR INSERT
  WITH CHECK (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "incomes_update"
  ON public.incomes FOR UPDATE
  USING (member_id IN (SELECT get_my_family_member_ids()))
  WITH CHECK (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "incomes_delete"
  ON public.incomes FOR DELETE
  USING (member_id IN (SELECT get_my_family_member_ids()));

-- 14) expenses: por família
CREATE POLICY "expenses_select"
  ON public.expenses FOR SELECT
  USING (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "expenses_insert"
  ON public.expenses FOR INSERT
  WITH CHECK (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "expenses_update"
  ON public.expenses FOR UPDATE
  USING (member_id IN (SELECT get_my_family_member_ids()))
  WITH CHECK (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "expenses_delete"
  ON public.expenses FOR DELETE
  USING (member_id IN (SELECT get_my_family_member_ids()));

-- 15) recurring_expenses: por família
CREATE POLICY "recurring_expenses_select"
  ON public.recurring_expenses FOR SELECT
  USING (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "recurring_expenses_insert"
  ON public.recurring_expenses FOR INSERT
  WITH CHECK (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "recurring_expenses_update"
  ON public.recurring_expenses FOR UPDATE
  USING (member_id IN (SELECT get_my_family_member_ids()))
  WITH CHECK (member_id IN (SELECT get_my_family_member_ids()));

CREATE POLICY "recurring_expenses_delete"
  ON public.recurring_expenses FOR DELETE
  USING (member_id IN (SELECT get_my_family_member_ids()));
