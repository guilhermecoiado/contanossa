param(
  [Parameter(Mandatory = $true)]
  [string]$StripeSecretKey,

  [Parameter(Mandatory = $true)]
  [string]$StripeWebhookSecret,

  [Parameter(Mandatory = $true)]
  [string]$StripePriceIdEssential,

  [Parameter(Mandatory = $true)]
  [string]$StripePriceIdFull,

  [Parameter(Mandatory = $true)]
  [string]$AppUrl,

  [Parameter(Mandatory = $true)]
  [string]$SignupEncryptionSecret,

  [string]$ProjectRef = "zgqdezpgunrcgsudbeuh"
)

$ErrorActionPreference = 'Stop'

function Invoke-Supabase {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  & npx supabase @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao executar: npx supabase $($Args -join ' ')"
  }
}

Write-Host "[1/5] Linkando projeto Supabase ($ProjectRef)..." -ForegroundColor Cyan
Invoke-Supabase -Args @('link', '--project-ref', $ProjectRef)

Write-Host "[2/5] Aplicando migrações..." -ForegroundColor Cyan
Invoke-Supabase -Args @('db', 'push')

Write-Host "[3/5] Publicando Edge Functions..." -ForegroundColor Cyan
Invoke-Supabase -Args @('functions', 'deploy', 'start-checkout-session')
Invoke-Supabase -Args @('functions', 'deploy', 'stripe-webhook')
Invoke-Supabase -Args @('functions', 'deploy', 'verify-signup-status')
Invoke-Supabase -Args @('functions', 'deploy', 'start-upgrade-checkout-session')

Write-Host "[4/5] Configurando secrets..." -ForegroundColor Cyan
$tempSecretsFile = Join-Path $env:TEMP ("supabase-secrets-" + [Guid]::NewGuid().ToString() + ".env")

@(
  "STRIPE_SECRET_KEY=$StripeSecretKey"
  "STRIPE_WEBHOOK_SECRET=$StripeWebhookSecret"
  "STRIPE_PRICE_ID_ESSENTIAL=$StripePriceIdEssential"
  "STRIPE_PRICE_ID_FULL=$StripePriceIdFull"
  "APP_URL=$AppUrl"
  "SIGNUP_ENCRYPTION_SECRET=$SignupEncryptionSecret"
) | Set-Content -Path $tempSecretsFile -Encoding UTF8

try {
  Invoke-Supabase -Args @('secrets', 'set', '--env-file', $tempSecretsFile)
}
finally {
  Remove-Item -Path $tempSecretsFile -Force -ErrorAction SilentlyContinue
}

Write-Host "[5/5] Deploy finalizado com sucesso." -ForegroundColor Green
Write-Host "Teste agora: cadastro Essencial, cadastro Completo e upgrade em /plan." -ForegroundColor Green
