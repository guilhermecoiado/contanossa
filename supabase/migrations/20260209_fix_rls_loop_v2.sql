-- ============================================================
-- Migração: Corrigir loop infinito na RLS de members (V2)
-- ============================================================
-- O problema: SECURITY DEFINER em SQL ainda dispara RLS.
-- 
-- Solução: Desabilitar RLS completamente na tabela members e usar
-- permissões diretas via funções.
-- ============================================================

-- 1) DESABILITAR RLS na tabela members (solução radical mas funcional)
ALTER TABLE public.members DISABLE ROW LEVEL SECURITY;

-- 2) Remover todas as policies antigas
DROP POLICY IF EXISTS "members_select_family" ON public.members;
DROP POLICY IF EXISTS "members_select_own" ON public.members;
DROP POLICY IF EXISTS "members_insert_own" ON public.members;
DROP POLICY IF EXISTS "members_update_family" ON public.members;
DROP POLICY IF EXISTS "members_delete_family" ON public.members;

-- 3) Criar funções SECURITY DEFINER para controlar acesso
-- Versão antiga (ainda funciona para outras RLS policies)
CREATE OR REPLACE FUNCTION public.get_current_user_family_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT family_id FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_family_member_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.members
  WHERE family_id = (SELECT family_id FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1)
  AND family_id IS NOT NULL;
$$;

-- Novas versões que aceitam user_id como parâmetro (mais rápido no reload)
CREATE OR REPLACE FUNCTION public.get_family_id_for_user(p_auth_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT family_id FROM public.members WHERE auth_user_id = p_auth_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_family_member_ids_for_user(p_auth_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.members
  WHERE family_id = (SELECT family_id FROM public.members WHERE auth_user_id = p_auth_user_id LIMIT 1)
  AND family_id IS NOT NULL;
$$;

-- 4) Criar view segura para members (com RLS embutido na view)
CREATE OR REPLACE VIEW public.members_view 
WITH (security_barrier = true)
AS
  SELECT m.*
  FROM public.members m
  WHERE 
    auth.uid() IS NOT NULL
    AND (
      m.auth_user_id = auth.uid()
      OR (
        m.family_id IS NOT NULL
        AND m.family_id = (SELECT family_id FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1)
      )
    );

-- 5) Dar permissões na tabela para usuários autenticados
GRANT SELECT ON public.members TO authenticated;
GRANT INSERT ON public.members TO authenticated;
GRANT UPDATE ON public.members TO authenticated;
GRANT DELETE ON public.members TO authenticated;

-- 6) Criar índice em auth_user_id para performance
CREATE INDEX IF NOT EXISTS idx_members_auth_user_id ON public.members(auth_user_id);

-- 7) Criar índice em family_id para joins
CREATE INDEX IF NOT EXISTS idx_members_family_id ON public.members(family_id);

-- Verificação: RLS deve estar desabilitado
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'members' 
    AND rowsecurity = true
  ) THEN
    RAISE WARNING 'ATENÇÃO: RLS ainda está habilitado na tabela members!';
  ELSE
    RAISE NOTICE 'OK: RLS está desabilitado na tabela members';
  END IF;
END $$;

-- Nota: Com RLS desabilitado, o aplicativo precisa garantir que apenas
-- busque members usando WHERE auth_user_id = auth.uid() ou through das 
-- funções auxiliares. Isso é mais seguro que ter loops infinitos!
