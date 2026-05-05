-- ============================================================
-- Migração: Corrigir loop infinito na RLS de members
-- ============================================================
-- O problema: get_current_user_family_id() chamava SELECT em members, 
-- que disparava RLS novamente, criando um loop infinito.
-- 
-- Solução: Usar SET LOCAL row_security = off para desabilitar RLS 
-- dentro das funções auxiliares.
-- ============================================================

-- 1) Recriar função com SET LOCAL row_security = off
CREATE OR REPLACE FUNCTION public.get_current_user_family_id()
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
BEGIN
  SET LOCAL row_security = off;
  SELECT family_id INTO v_family_id 
  FROM public.members 
  WHERE auth_user_id = auth.uid() 
  LIMIT 1;
  RETURN v_family_id;
END $$;

-- 2) Recriar função com SET LOCAL row_security = off
CREATE OR REPLACE FUNCTION public.get_my_family_member_ids()
RETURNS SETOF UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL row_security = off;
  RETURN QUERY
  SELECT id FROM public.members
  WHERE family_id = get_current_user_family_id()
  AND family_id IS NOT NULL;
END $$;

-- 3) Remover políticas antigas que podem estar com problema
DROP POLICY IF EXISTS "members_select_family" ON public.members;
DROP POLICY IF EXISTS "members_insert_own" ON public.members;
DROP POLICY IF EXISTS "members_update_family" ON public.members;
DROP POLICY IF EXISTS "members_delete_family" ON public.members;

-- 4) Recriar políticas com melhor tratamento
CREATE POLICY "members_select_family"
  ON public.members FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      auth_user_id = auth.uid()
      OR (
        family_id IS NOT NULL 
        AND family_id = get_current_user_family_id()
      )
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
        AND family_id IS NOT NULL
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
      OR (
        family_id IS NOT NULL 
        AND family_id = get_current_user_family_id()
      )
    )
  )
  WITH CHECK (true);

CREATE POLICY "members_delete_family"
  ON public.members FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND family_id IS NOT NULL
    AND family_id = get_current_user_family_id()
  );
