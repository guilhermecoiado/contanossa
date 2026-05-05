# Instruções de Deploy

## Alterações Realizadas

### 1. RPC Functions para Gerenciamento de Auth Users
Arquivo: `supabase/migrations/20260130_delete_auth_user_function.sql`

**Ação necessária**: Executar no Supabase SQL Editor

1. Acesse: https://app.supabase.com → seu projeto → SQL Editor
2. Cole o conteúdo do arquivo `supabase/migrations/20260130_delete_auth_user_function.sql`
3. Execute os comandos

Isso criará:
- `public.delete_auth_user(user_id uuid)` - Deleta um usuário do Auth
- `public.get_user_id_by_email(email_input text)` - Busca o ID de um usuário pelo email

### 2. Edge Function para Criar/Deletar Usuários
Arquivo: `supabase/functions/delete-auth-user/index.ts`

**Ação necessária**: Deploy via CLI do Supabase

```bash
# Instale a CLI se não tiver:
npm install -g @supabase/cli

# Faça login:
supabase login

# Navegue até a pasta do projeto:
cd "c:\Users\guilh\.cursor\projects\my-family-finances - 2"

# Faça o deploy:
supabase functions deploy delete-auth-user
```

Essa edge function agora suporta:
- `action: 'create'` - Cria um novo usuário no Auth
  - Parâmetros: `email`, `password`, `name` (opcional)
- `action: 'delete'` - Deleta um usuário do Auth
  - Parâmetros: `auth_user_id`

### 3. Mudanças no Código

#### useCreateMember
- Removeu a chamada a `signUp()` que causava logout
- Agora apenas busca se o usuário já existe via RPC
- Se não existir, cria via edge function (que não faz login automático)

#### useDeleteMember
- Simplificado para usar apenas a edge function
- Agora deleta o usuário do Auth antes de deletar da tabela members
- Se falhar ao deletar do Auth, o erro é propagado ao usuário

## Fluxo de Cadastro de Membro com Acesso ao Painel

1. Admin preenche o formulário com "Ativar acesso ao painel" ✓
2. Sistema busca se o usuário já existe no Auth via RPC
3. Se não existe, o sistema cria o member na tabela
4. Edge function é chamada para criar o usuário no Auth
5. O member agora tem acesso ao painel (sem fazer logout do admin)

## Fluxo de Deleção de Membro com Acesso ao Painel

1. Admin clica em deletar um member ✓
2. Confirmação aparece como dialog (não mais alert nativo)
3. Sistema:
   - Chama edge function para deletar do Auth
   - Deleta as fontes de renda
   - Deleta o member da tabela
4. Se falhar ao deletar do Auth, exibe erro ao usuário

## Testes Recomendados

1. **Criar membro com acesso ao painel**
   - Verificar que admin NÃO faz logout
   - Verificar que o usuário foi criado no Auth (Dashboard → Authentication)

2. **Tentar criar novamente com mesmo email**
   - Sistema deve detectar que já existe e reutilizar o ID

3. **Deletar membro com acesso ao painel**
   - Verificar que o usuário é removido de Authentication → Users
   - Verificar que o member é removido de members table
   - Tentar criar novamente com mesmo email deve funcionar

4. **Tentar fazer login com as credenciais do membro criado**
   - Deve funcionar normalmente

## Troubleshooting

### Erro: "Could not find the function public.delete_auth_user"
- A migration SQL não foi executada
- Execute o arquivo `supabase/migrations/20260130_delete_auth_user_function.sql` no SQL Editor

### Erro: CORS na edge function
- A edge function não foi deployada
- Execute `supabase functions deploy delete-auth-user`

### Admin continua fazendo logout ao criar membro
- Verifique se as mudanças em `useCreateMember` foram aplicadas corretamente
- Confirme que não há chamada a `supabase.auth.signUp()` que cria sessão

### Usuário não é deletado do Auth ao remover member
- Verifique se a edge function foi deployada
- Verifique os logs no Supabase → Functions → delete-auth-user

