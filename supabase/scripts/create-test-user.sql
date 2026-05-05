-- Script para criar usuários de teste no Auth
-- Execute isso no SQL Editor do Supabase Dashboard
-- 
-- IMPORTANTE: Substitua os valores de email e senha antes de executar!

-- Opção 1: Se você tiver acesso ao admin.users (maioria dos casos)
-- Descomente e execute:

/*
SELECT * FROM auth.users WHERE email = 'seu_email@example.com';
*/

-- Se o usuário NÃO existir, você pode criar via Supabase Dashboard:
-- 1. Vá para: https://app.supabase.com/project/seu_projeto_id/auth/users
-- 2. Clique em "Add User"
-- 3. Email: seu_email@example.com
-- 4. Password: sua_senha_segura
-- 5. Marque "Auto-confirm user"
-- 6. Clique "Create user"

-- Depois disso, o member será linkado automaticamente ao auth.users!

-- Se precisar deletar um usuário para testar:
-- DELETE FROM auth.users WHERE email = 'seu_email@example.com';
-- (Isso deletará todas as referências, incluindo o member)
