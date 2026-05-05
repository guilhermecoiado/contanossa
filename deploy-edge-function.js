#!/usr/bin/env node

/**
 * Script para fazer deploy manual da edge function no Supabase
 * 
 * Como usar:
 * 1. Insira seu SUPABASE_PROJECT_ID e SUPABASE_ACCESS_TOKEN nas variáveis abaixo
 * 2. Execute: node deploy-edge-function.js
 */

const fs = require('fs');
const path = require('path');

// ⚠️ CONFIGURAÇÃO NECESSÁRIA
const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'YOUR_PROJECT_ID_HERE';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN_HERE';

// Validar credenciais
if (!SUPABASE_PROJECT_ID || SUPABASE_PROJECT_ID === 'YOUR_PROJECT_ID_HERE') {
  console.error('❌ Erro: SUPABASE_PROJECT_ID não definido');
  console.error('   Defina via variável de ambiente: set SUPABASE_PROJECT_ID=seu_projeto_id');
  process.exit(1);
}

if (!SUPABASE_ACCESS_TOKEN || SUPABASE_ACCESS_TOKEN === 'YOUR_ACCESS_TOKEN_HERE') {
  console.error('❌ Erro: SUPABASE_ACCESS_TOKEN não definido');
  console.error('   Defina via variável de ambiente: set SUPABASE_ACCESS_TOKEN=seu_token');
  process.exit(1);
}

const functionPath = path.join(__dirname, 'supabase/functions/delete-auth-user/index.ts');

if (!fs.existsSync(functionPath)) {
  console.error('❌ Erro: arquivo de edge function não encontrado em:', functionPath);
  process.exit(1);
}

const functionCode = fs.readFileSync(functionPath, 'utf-8');

console.log('\n================================');
console.log('Deploy da Edge Function');
console.log('================================\n');

console.log('📦 Informações:');
console.log(`   Projeto: ${SUPABASE_PROJECT_ID}`);
console.log(`   Função: delete-auth-user`);
console.log(`   Código: ${functionCode.length} bytes\n`);

console.log('⚠️  Nota: Este é um script alternativo para deploy manual.');
console.log('   Para deploy padrão, use: supabase functions deploy delete-auth-user\n');

console.log('Para fazer o deploy via API REST do Supabase:');
console.log('');
console.log('1. Acesse: https://app.supabase.com/project/' + SUPABASE_PROJECT_ID + '/functions');
console.log('2. Ou use a API com este código:');
console.log('');
console.log('curl -X POST \\');
console.log(`  https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/delete-auth-user \\`);
console.log(`  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN.substring(0, 20)}..." \\`);
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{"action":"create","email":"test@example.com","password":"123456","name":"Test"}\'');
console.log('');
console.log('3. Ou use a CLI quando tiver acesso:');
console.log('');
console.log('   supabase functions deploy delete-auth-user');
console.log('');
