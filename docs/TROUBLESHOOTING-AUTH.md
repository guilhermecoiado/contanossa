# Autenticação: "Invalid login credentials"

Se email e senha estão corretos e o email já foi confirmado, confira o seguinte.

## 1. App e usuário no mesmo projeto

O app usa as variáveis do `.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

**Faça isso:**
1. Abra o app em modo dev e abra o **Console do navegador (F12)**.
2. Na primeira linha deve aparecer: `[Supabase] Projeto conectado: https://XXXX.supabase.co`
3. No **Supabase Dashboard** vá em **Project Settings** (ícone de engrenagem) → **API**.
4. Confira se **Project URL** é exatamente o mesmo `https://XXXX.supabase.co` que apareceu no console.
5. Confira se **anon public** é a mesma chave que está no `.env` em `VITE_SUPABASE_PUBLISHABLE_KEY`.

Se URL ou chave forem de outro projeto, o usuário está em um projeto e o app falando com outro → "Invalid login credentials". Corrija o `.env` com a URL e a chave **anon** do projeto onde você criou o usuário.

## 2. Redefinir a senha do usuário

Às vezes a senha salva no Auth não é a que você acha (encoding, caractere invisível, etc.).

1. No Supabase: **Authentication** → **Users**.
2. Clique no usuário.
3. Use **Send password recovery** (enviar link de redefinição) ou **Update user** e defina uma senha nova simples (ex.: `123456`).
4. Tente logar no app com essa senha nova.

## 3. Teste com um usuário novo

Para isolar o problema:

1. No Dashboard: **Authentication** → **Users** → **Add user** → crie um usuário com email novo (ex.: `teste@teste.com`) e senha simples.
2. No **SQL Editor**, rode:
   ```sql
   UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'teste@teste.com';
   ```
3. Rode o script `supabase/scripts/link-auth-user-to-member.sql` para esse usuário (substitua o UUID, nome, email, username).
4. Tente logar no app com `teste@teste.com` e a senha que você definiu.

- Se **funcionar**: o problema era o usuário/senha antiga (redefina a senha do usuário original).
- Se **não funcionar**: o problema é projeto/`.env` (volte ao passo 1).

## 4. Erro exato do Supabase

Ao tentar logar, com o **Console (F12)** aberto, deve aparecer algo como:

```
[Supabase Auth] Erro no login: { code: "...", message: "...", emailTentado: "..." }
```

Anote o `code` e o `message`; isso ajuda a identificar o tipo de erro (projeto errado, usuário inexistente, etc.).
