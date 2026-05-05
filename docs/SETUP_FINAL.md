# Guia Completo: Setup Final do Projeto

## 📋 Resumo do que foi feito

1. ✅ Sistema de membros com CRUD completo
2. ✅ "Ativar acesso ao painel" para criar admin users
3. ✅ Dialog de confirmação ao deletar membros
4. ✅ Deleção automática de usuários do Auth
5. ✅ Admin NÃO faz logout ao criar members
6. ✅ Tratamento de erros com fallback (Edge Function → RPC)

---

## 🚀 Passos para Funcionar Completamente

### Passo 1: Executar Migration SQL (⚠️ OBRIGATÓRIO)

1. Acesse: https://app.supabase.com → seu projeto → **SQL Editor**
2. Clique em "+ New Query"
3. Abra o arquivo do seu computador: `supabase/migrations/20260130_delete_auth_user_function.sql`
4. Copie TODO o conteúdo
5. Cole no SQL Editor
6. Clique em **Execute** ou Ctrl+Enter
7. Deve aparecer "Success" com os comandos executados ✅

Isso cria 2 funções RPC essenciais:
- `public.delete_auth_user(uuid)` - Deleta usuário do Auth
- `public.get_user_id_by_email(text)` - Busca ID por email

### Passo 2: Deploy da Edge Function (RECOMENDADO)

Esta função pode **criar usuários no Auth automaticamente**.

#### Via Dashboard (Mais Fácil):

1. Vá para: https://app.supabase.com → seu projeto → **Functions**
2. Clique em **+ Create a new function** (ou edite se já existir `delete-auth-user`)
3. Nome: `delete-auth-user`
4. Abra: `supabase/functions/delete-auth-user/index.ts` do seu computador
5. Copie TODO o conteúdo
6. Cole no editor do Supabase
7. Clique em **Deploy**
8. Deve aparecer "Function deployed successfully" ✅

#### Testando a Edge Function:

1. Na página da função no Dashboard
2. Clique em **"Test"**
3. Cole este JSON:
```json
{
  "action": "create",
  "email": "teste@example.com",
  "password": "Senha123!",
  "name": "User Teste"
}
```
4. Clique **"Send"**
5. Resposta esperada:
```json
{
  "success": true,
  "message": "Usuário criado com sucesso",
  "user_id": "uuid-aqui"
}
```

Se funcionou, Edge Function está pronta! ✅

---

## 🧪 Testando na Aplicação

### Teste 1: Criar Member com Acesso ao Painel

1. Abra a aplicação
2. Vá para **Members** (Membros)
3. Clique **Add Member** (Adicionar Membro)
4. Preencha:
   - Nome: `João Silva`
   - Email: `joao@example.com`
   - Telefone: (opcional)
   - ☑️ **Ativar acesso ao painel**
   - Senha: `Senha123!`
5. Próximo → Adicione uma fonte de renda → Cadastrar
6. Confirme no dialog que aparece → **Confirmar**

**O que deve acontecer:**
- ✅ Admin permanece logado (NÃO faz logout)
- ✅ Member aparece na lista
- ✅ No Dashboard Supabase → Authentication → Users, o usuário foi criado

Se tudo funcionar, a edge function foi deployada com sucesso! 🎉

### Teste 2: Testar Login do Novo Member

1. **Logout** (opcional, se quiser testar)
2. Na página de login:
   - Email: `joao@example.com`
   - Senha: `Senha123!`
3. Clique **Sign In**
4. Deve entrar normalmente ✅

### Teste 3: Deletar Member e Verificar Deleção do Auth

1. Login como admin (primeiro usuário)
2. Vá para **Members**
3. Clique no ícone de lixeira (🗑️) do member
4. Confirme: "Tem certeza que deseja deletar este membro?"
5. Clique **Deletar**

**O que deve acontecer:**
- ✅ Member desaparece da lista
- ✅ No Dashboard → Authentication → Users, o usuário foi deletado

### Teste 4: Criar Novamente com Mesmo Email

1. Crie novamente um member com o mesmo email `joao@example.com`
2. Deve funcionar sem erros ✅

---

## ⚠️ Troubleshooting

### Problema: "CORS Preflight Did Not Succeed" ao deletar

**Causa**: Edge function não foi deployada

**Solução**: 
1. Vá para: https://app.supabase.com → Functions
2. Verifique se `delete-auth-user` aparece na lista
3. Se não aparecer, siga o **Passo 2** acima

### Problema: Usuário não aparece em Authentication

**Causa**: Edge function não foi deployada

**Solução Alternativa (Manual)**:
1. No Dashboard → Authentication → Add user
2. Email: (mesmo do member)
3. Password: (mesma senha)
4. Marque "Auto-confirm user"
5. Clique "Create user"

### Problema: "Could not find the function public.delete_auth_user"

**Causa**: Migration SQL não foi executada

**Solução**: Siga o **Passo 1** para executar a migration

### Problema: Admin faz logout ao criar member

Este foi o bug original e foi corrigido. Se continuar:
1. Limpe cache do navegador (Ctrl+Shift+Delete)
2. Recarregue a página (Ctrl+F5)
3. Se persistir, abra o console (F12) e verifique os logs

---

## 📁 Arquivos Importantes

- `supabase/migrations/20260130_delete_auth_user_function.sql` - RPC functions
- `supabase/functions/delete-auth-user/index.ts` - Edge function (criação/deleção)
- `src/hooks/useMembers.ts` - Lógica de create/delete de members
- `src/components/forms/MemberForm.tsx` - Formulário com dialog de confirmação

---

## ✅ Fluxo Final Completo

1. Admin cria member com "Ativar acesso ao painel"
   - Membro criado na tabela ✓
   - Usuário criado no Auth (automático via edge function) ✓
   - Admin permanece logado ✓

2. Novo member faz login
   - Usa email + senha criados ✓

3. Admin deleta member
   - Dialog de confirmação aparece ✓
   - RPC deleta usuário do Auth ✓
   - Member é deletado da tabela ✓
   - Próxima criação com mesmo email funciona ✓

---

## 🎉 Pronto!

Após completar os 2 passos acima, o sistema está totalmente funcional. Qualquer dúvida, verifique o Troubleshooting acima!

