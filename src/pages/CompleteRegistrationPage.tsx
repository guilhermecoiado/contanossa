import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Wallet, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

/**
 * Página exibida quando o usuário é criado via "Ativar acesso ao painel"
 * Mostra um resumo dos dados e pede confirmação para finalizar o cadastro.
 */
export default function CompleteRegistrationPage() {
  const navigate = useNavigate();
  const { currentMember, user, isLoading } = useAuth();
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      // O membro já foi criado durante o signUp em MemberForm
      // Apenas redirecionamos para o dashboard
      toast.success('Bem-vindo! Redirecionando para o painel...');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao confirmar';
      toast.error(message);
    } finally {
      setConfirming(false);
    }
  };

  // Redirect to /login if not loading and no user (avoid redirect loop)
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!currentMember) {
    // Render nothing while redirecting
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-lg">
            <Wallet className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Confirme seu cadastro</h1>
          <p className="text-muted-foreground text-sm mt-1 text-center max-w-sm">
            Você será adicionado à família com acesso ao painel
          </p>
        </div>

        <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 space-y-4 mb-6">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Nome</p>
            <p className="text-sm font-semibold text-foreground">{currentMember.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Email</p>
            <p className="text-sm text-foreground">{currentMember.email}</p>
          </div>
          {currentMember.phone && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Telefone</p>
              <p className="text-sm text-foreground">{currentMember.phone}</p>
            </div>
          )}
        </div>

        <div className="w-full max-w-md bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Cadastro confirmado</p>
            <p className="text-xs">Os dados foram preenchidos com sucesso na etapa anterior.</p>
          </div>
        </div>

        <div className="w-full max-w-md space-y-3">
          <Button 
            onClick={handleConfirm} 
            className="w-full h-11" 
            disabled={confirming}
          >
            {confirming ? 'Confirmando...' : 'Confirmar e acessar o painel'}
          </Button>
          <Button 
            variant="outline" 
            className="w-full h-11" 
            onClick={() => navigate('/', { replace: true })}
            disabled={confirming}
          >
            Ir para o dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
