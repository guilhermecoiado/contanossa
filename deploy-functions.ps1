# Script para fazer deploy da edge function do Supabase
# Execute este script no PowerShell

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Deploy da Edge Function Supabase" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se está na pasta correta
if (!(Test-Path "supabase/functions/delete-auth-user/index.ts")) {
    Write-Host "❌ Erro: arquivo de edge function não encontrado" -ForegroundColor Red
    Write-Host "Certifique-se de estar na raiz do projeto" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Edge function encontrada" -ForegroundColor Green
Write-Host ""

# Tentar login (se não estiver logado)
Write-Host "Fazendo login no Supabase..." -ForegroundColor Yellow
npx supabase login

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao fazer login" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✓ Login realizado com sucesso" -ForegroundColor Green
Write-Host ""

# Fazer deploy da edge function
Write-Host "Fazendo deploy da edge function 'delete-auth-user'..." -ForegroundColor Yellow
Write-Host ""

npx supabase functions deploy delete-auth-user

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deploy realizado com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "A edge function está pronta para uso:" -ForegroundColor Cyan
    Write-Host "  - Criar usuário: action='create', email, password, name" -ForegroundColor Gray
    Write-Host "  - Deletar usuário: action='delete', auth_user_id" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "❌ Erro ao fazer deploy da edge function" -ForegroundColor Red
    exit 1
}
