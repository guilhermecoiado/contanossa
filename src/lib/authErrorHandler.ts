import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseConnection';

/**
 * Verifica se a sessão está ativa antes de fazer uma operação
 * Retorna true se a sessão é válida, false se expirou
 */
export async function checkSession(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

/**
 * Lida com erros de autenticação e exibir feedback ao usuário
 * @param error Erro capturado
 * @param onSessionExpired Callback quando sessão expira
 * @returns mensagem de erro formatada
 */
export function handleAuthError(
  error: any,
  onSessionExpired?: () => void
): string {
  const errorMsg = error.message || 'Erro ao processar requisição';

  // Verifica se é erro de autenticação/sessão
  const isAuthError =
    error.status === 401 ||
    error.code === 'UNAUTHORIZED' ||
    errorMsg.includes('401') ||
    errorMsg.includes('unauthorized') ||
    errorMsg.includes('session') ||
    errorMsg.includes('token expired');

  if (isAuthError) {
    toast.error('Sua sessão expirou. Por favor, faça login novamente.');
    onSessionExpired?.();
    return 'Sessão expirada';
  }

  return errorMsg;
}

/**
 * Wrapper para operações que requerem autenticação
 * Verifica sessão antes de executar e trata erros automaticamente
 */
export async function withAuthCheck<T>(
  operation: () => Promise<T>,
  onSessionExpired?: () => void
): Promise<T | null> {
  try {
    const isValid = await checkSession();
    if (!isValid) {
      toast.error('Sua sessão expirou. Por favor, faça login novamente.');
      onSessionExpired?.();
      return null;
    }

    return await operation();
  } catch (error: any) {
    handleAuthError(error, onSessionExpired);
    return null;
  }
}
