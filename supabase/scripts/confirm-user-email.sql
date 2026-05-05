-- ============================================================
-- Confirmar email do usuário manualmente (permite login sem link)
-- ============================================================
-- Use quando o usuário foi criado no Auth (manual ou signUp) e
-- não consegue logar com "Invalid login credentials" mesmo com
-- email e senha corretos. Isso acontece quando o email ainda
-- não foi "confirmado" (email_confirmed_at está null).
--
-- Como usar:
-- 1. Substitua 'seu@email.com' pelo email do usuário.
-- 2. Rode no SQL Editor do Supabase (Dashboard → SQL Editor).
-- ============================================================

UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'seu@email.com';

-- Verificar se atualizou (deve retornar 1 linha):
-- SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'seu@email.com';
