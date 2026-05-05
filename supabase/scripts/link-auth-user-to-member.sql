-- ============================================================
-- Vincular um usuário do Authentication a um registro em members
-- ============================================================
-- Use quando o usuário foi criado manualmente no Supabase Auth
-- (Authentication > Users) e ainda não tem linha em public.members.
--
-- Como usar:
-- 1. No Supabase: Authentication > Users > copie o UUID do usuário.
-- 2. Substitua abaixo:
--    - AUTH_USER_ID: o UUID do usuário em auth.users
--    - 'Nome do Usuário': nome completo
--    - 'email@exemplo.com': email (deve ser o mesmo do Auth)
--    - 'username': nome de usuário (único)
-- 3. Rode este script no SQL Editor do projeto.
-- ============================================================

INSERT INTO public.members (
  auth_user_id,
  family_id,
  name,
  email,
  username,
  phone,
  password_hash
) VALUES (
  'AUTH_USER_ID'::uuid,           -- Substitua pelo UUID do usuário em auth.users
  gen_random_uuid(),              -- Nova família para este usuário
  'Nome do Usuário',              -- Nome completo
  'email@exemplo.com',            -- Email (mesmo do Auth)
  'username',                     -- Usuário único (ex: joaosilva)
  NULL,                           -- Telefone (opcional)
  NULL
);

-- Exemplo preenchido (descomente e ajuste para testar):
/*
INSERT INTO public.members (
  auth_user_id,
  family_id,
  name,
  email,
  username,
  phone,
  password_hash
) VALUES (
  '12345678-1234-1234-1234-123456789012'::uuid,
  gen_random_uuid(),
  'João Silva',
  'joao@email.com',
  'joaosilva',
  NULL,
  NULL
);
*/
