import { supabase as _supabase } from '@/integrations/supabase/client';
export const supabase = _supabase;

export interface ConnectionTestResult {
  ok: boolean;
  error?: string;
  details?: string;
}

/**
 * Testa a conexão com o Supabase fazendo uma query simples (leitura em tabela pública).
 * Use para verificar se URL e chave estão corretos e se o banco está acessível.
 */
export async function testSupabaseConnection(): Promise<ConnectionTestResult> {
  try {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('id')
      .limit(1);

    if (error) {
      return {
        ok: false,
        error: error.message,
        details: error.code ? `Código: ${error.code}` : undefined,
      };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: message,
    };
  }
}
