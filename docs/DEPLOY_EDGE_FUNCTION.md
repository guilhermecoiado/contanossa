# Como Deployar a Edge Function

## Passo Único: Via Supabase Dashboard

1. Acesse: https://app.supabase.com → seu projeto → **Functions**

2. Clique em **"+ Create a new function"** ou edite `delete-auth-user` se já existir

3. **Nome**: `delete-auth-user` (sem extensão)

4. **Código**: Abra o arquivo `supabase/functions/delete-auth-user/index.ts` e copie TODO o conteúdo

5. Cole no editor do Supabase

6. Clique em **Deploy**

7. Pronto! ✅

## Teste Rápido

Na aplicação:
1. Crie um membro com "Ativar acesso ao painel"
2. Deve criar automaticamente no Auth ✅
3. Faça login com o novo membro ✅
4. Volte como admin e delete o member ✅
5. O usuário deve ser deletado do Auth automaticamente ✅

## Se der erro 401

Significa que a edge function não foi deployada corretamente.

Verifique:
1. A função aparece em Functions no Dashboard?
2. Seu projeto ID está correto?
3. Tente fazer o deploy novamente

Se continuar falhando, rode este SQL no SQL Editor:

```sql
-- Verificar que as RPC functions existem
SELECT routine_name FROM information_schema.routines 
WHERE routine_type = 'FUNCTION' AND routine_schema = 'public';
```

Deve aparecer `delete_auth_user` e `get_user_id_by_email`.

