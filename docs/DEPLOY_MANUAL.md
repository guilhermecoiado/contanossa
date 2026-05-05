# Guia: Deploy Manual da Edge Function

Como não conseguimos usar a CLI, vou mostrar 2 formas alternativas de fazer o deploy:

## ✅ Opção 1: Deploy via Supabase Dashboard (RECOMENDADO - Mais Fácil)

### Passo 1: Copiar o código da edge function

1. Abra o arquivo: `supabase/functions/delete-auth-user/index.ts`
2. Copie TODO o conteúdo do arquivo

### Passo 2: Acessar o Dashboard do Supabase

1. Vá para: https://app.supabase.com
2. Selecione seu projeto
3. No menu esquerdo, clique em **Functions** (Funções)

### Passo 3: Criar ou atualizar a edge function

**Se a função NÃO existir:**
1. Clique em "+ New Function" / "+ Nova Função"
2. Nome: `delete-auth-user`
3. Copie e cole o código que você copiou no Passo 1
4. Clique em "Deploy"

**Se a função JÁ existir:**
1. Clique na função `delete-auth-user` da lista
2. Clique em "Edit" / "Editar"
3. Delete todo o conteúdo antigo
4. Copie e cole o novo código
5. Clique em "Deploy"

### Passo 4: Testar a edge function

1. No Dashboard, ainda na página da função `delete-auth-user`
2. Clique em "Test" / "Testar"
3. Cole este JSON no corpo da requisição:

```json
{
  "action": "create",
  "email": "teste@example.com",
  "password": "TestPassword123!",
  "name": "Teste User"
}
```

4. Clique em "Send" / "Enviar"
5. Deve retornar algo como:
```json
{
  "success": true,
  "message": "Usuário criado com sucesso",
  "user_id": "uuid-aqui"
}
```

Se retornar sucesso, o deploy funcionou! ✅

---

## ⚠️ Opção 2: Deploy via API (Avançado)

Se preferir usar a API REST do Supabase:

### Pré-requisitos:
- Seu SUPABASE_PROJECT_ID
- Um SUPABASE_ACCESS_TOKEN com permissão de Functions

### Usando PowerShell:

```powershell
$projectId = "seu_projeto_id"
$token = "seu_access_token"
$functionCode = Get-Content "supabase/functions/delete-auth-user/index.ts" -Raw

$body = @{
    slug = "delete-auth-user"
    name = "delete-auth-user"
    code = $functionCode
} | ConvertTo-Json

Invoke-WebRequest `
  -Uri "https://$projectId.supabase.co/functions/v1" `
  -Method POST `
  -Headers @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
  } `
  -Body $body
```

---

## 🔑 Onde obter suas credenciais Supabase?

### Project ID:
1. Dashboard Supabase → seu projeto
2. Settings → General
3. Procure por "Project ID"

### Access Token:
1. Dashboard Supabase → seu projeto
2. Settings → API
3. Role: `service_role` (role mais permissiva)
4. Copie o token

⚠️ **NUNCA compartilhe seu Access Token publicamente!**

---

## ❓ Troubleshooting

### Erro: "Function already exists"
- A função já existe no seu projeto
- Use a Opção 1, passo 3 (Se a função JÁ existir)
- Edite a função existente ao invés de criar uma nova

### Erro: "Unauthorized" ao usar API
- Verifique se seu token está correto
- Verifique se tem permissão de Functions

### Erro: CORS na aplicação
- Verifique que a edge function foi deployada (deve aparecer em Functions no Dashboard)
- Recarregue a página da aplicação (Ctrl+F5)

---

## ✅ Confirmar que funcionou

Após fazer o deploy:

1. Vá para a aplicação
2. Tente **criar um membro com acesso ao painel**
3. Confirme que:
   - ✓ Admin NÃO faz logout
   - ✓ Member foi criado na tabela `members`
   - ✓ Usuário foi criado em Authentication → Users

4. Tente **deletar o member**
5. Confirme que:
   - ✓ Aparece um dialog de confirmação
   - ✓ Member é deletado da tabela
   - ✓ Usuário é deletado de Authentication → Users

Se tudo estiver funcionando, o deploy foi bem-sucedido! 🎉

---

## Próximo Passo: Migration SQL

Também é necessário executar a migration SQL. Se ainda não fez:

1. Acesse: https://app.supabase.com → seu projeto → SQL Editor
2. Abra o arquivo: `supabase/migrations/20260130_delete_auth_user_function.sql`
3. Cole o conteúdo no SQL Editor
4. Execute (Ctrl+Enter ou botão "Execute")

Pronto! Ambas as partes estarão deployadas.

