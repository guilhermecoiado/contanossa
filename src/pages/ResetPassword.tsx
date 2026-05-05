import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (error) {
        setHasSession(false);
      } else {
        setHasSession(Boolean(data.session));
      }
      setIsChecking(false);
    };
    checkSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextPassword = password.trim();
    const nextConfirm = confirmPassword.trim();
    const strongPassword = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{6,}$/;

    if (!nextPassword || !nextConfirm) {
      toast.error('Preencha a nova senha e a confirmacao');
      return;
    }
    if (nextPassword !== nextConfirm) {
      toast.error('As senhas nao conferem');
      return;
    }
    if (!strongPassword.test(nextPassword)) {
      toast.error('Senha fraca: use letra maiuscula, numero e caractere especial');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nextPassword });
      if (error) {
        throw new Error(error.message || 'Erro ao atualizar senha');
      }
      toast.success('Senha atualizada com sucesso');
      navigate('/login');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar senha';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white/90 shadow-lg p-6">
        <h1 className="text-xl font-semibold">Redefinir senha</h1>
        {!hasSession ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Para redefinir sua senha, abra o link enviado para seu email.
            </p>
            <Button asChild className="w-full h-11">
              <Link to="/login">Voltar para o login</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoComplete="new-password"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••"
                autoComplete="new-password"
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Atualizar senha'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Sua senha deve ter letra maiuscula, numero e caractere especial.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
