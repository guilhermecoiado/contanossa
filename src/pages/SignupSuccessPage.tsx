import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Wallet, Loader2, CheckCircle2, CircleAlert } from 'lucide-react';

type SignupStatus = 'pending_payment' | 'paid' | 'authorized' | 'failed' | 'expired' | 'unknown';

export default function SignupSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<SignupStatus>('unknown');
  const [email, setEmail] = useState<string>('');
  const [message, setMessage] = useState<string>('Validando pagamento...');
  const [isChecking, setIsChecking] = useState<boolean>(true);

  const sessionId = useMemo(() => searchParams.get('session_id') ?? '', [searchParams]);

  useEffect(() => {
    let attempts = 0;
    let timer: number | null = null;

    const checkStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-signup-status', {
          body: {
            session_id: sessionId,
          },
        });

        if (error) {
          throw new Error(error.message || 'Erro ao validar cadastro');
        }

        const currentStatus = (data?.status as SignupStatus | undefined) ?? 'unknown';
        setStatus(currentStatus);
        setEmail(data?.email ?? '');

        if (currentStatus === 'authorized') {
          setMessage('Pagamento confirmado! Seu acesso está liberado.');
          setIsChecking(false);
          return;
        }

        if (currentStatus === 'failed' || currentStatus === 'expired') {
          setMessage(data?.failure_reason || 'Não foi possível liberar seu acesso.');
          setIsChecking(false);
          return;
        }

        setMessage('Pagamento confirmado. Finalizando autorização da sua conta...');
        attempts += 1;
        if (attempts >= 20) {
          setIsChecking(false);
          setMessage('A autorização está levando mais tempo. Você pode tentar fazer login em alguns instantes.');
          return;
        }

        timer = window.setTimeout(checkStatus, 3000);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Falha ao verificar status';
        setMessage(errorMessage);
        setIsChecking(false);
      }
    };

    if (!sessionId) {
      setMessage('Sessão de checkout não encontrada.');
      setIsChecking(false);
      return;
    }

    void checkStatus();

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [sessionId]);

  return (
    <div className="fixed inset-0 min-h-screen w-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-200 via-blue-100 to-blue-300">
      <div className="relative z-10 w-full max-w-md rounded-2xl shadow-xl border border-blue-200 bg-white/95 p-6 text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center">
            <Wallet className="w-7 h-7 text-blue-700" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-blue-900">Finalizando seu cadastro</h1>
        <p className="text-sm text-blue-800">{message}</p>

        {email ? <p className="text-xs text-blue-700">Conta: {email}</p> : null}

        <div className="flex items-center justify-center gap-2 text-blue-900">
          {isChecking && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
          {!isChecking && status === 'authorized' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          {!isChecking && status !== 'authorized' && <CircleAlert className="w-4 h-4 text-amber-500" />}
          <span className="text-xs uppercase tracking-wide">Status: {status}</span>
        </div>

        <Button
          className="w-full h-11"
          onClick={() => navigate('/login', { replace: true })}
          disabled={isChecking}
        >
          {status === 'authorized' ? 'Ir para login' : 'Voltar para login'}
        </Button>
      </div>
    </div>
  );
}
