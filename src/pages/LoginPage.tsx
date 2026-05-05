import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, LogIn, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const [authLoading, setAuthLoading] = useState(false);
  const [signInData, setSignInData] = useState({ email: '', password: '' });
  const [signUpData, setSignUpData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    selectedPlan: 'full',
  });
  const [signUpStep, setSignUpStep] = useState<1 | 2>(1);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      await signIn(signInData.email, signInData.password);
      toast.success('Login efetuado!');
    } catch (err: unknown) {
      const message =
        (err instanceof Error && err.message) ||
        (typeof err === 'object' && err !== null && 'message' in err && String((err as { message: unknown }).message)) ||
        (typeof err === 'object' && err !== null && 'error_description' in err && String((err as { error_description: unknown }).error_description)) ||
        (err != null ? String(err) : 'Erro ao entrar');
      if (import.meta.env.DEV) console.error('[Login] Erro ao entrar:', err);
      toast.error(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const email = resetEmail.trim();
    if (!email) {
      toast.error('Informe seu email');
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        throw new Error(error.message || 'Erro ao enviar email de recuperacao');
      }
      toast.success('Enviamos um link para redefinir sua senha');
      setIsResetOpen(false);
      setResetEmail('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar email de recuperacao';
      toast.error(message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = signUpData.name.trim();
    const email = signUpData.email.trim();
    const password = signUpData.password.trim();
    const phone = signUpData.phone.trim();
    const strongPassword = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{6,}$/;
    if (!name || !email || !password || !phone) {
      toast.error('Preencha nome, email, senha e telefone');
      return;
    }
    if (!strongPassword.test(password)) {
      toast.error('Senha fraca: use letra maiuscula, numero e caractere especial');
      return;
    }
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('start-checkout-session', {
        body: {
          email,
          password,
          name,
          phone,
          selected_plan: signUpData.selectedPlan,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao iniciar checkout');
      }

      const checkoutUrl = data?.checkout_url;
      if (!checkoutUrl) {
        throw new Error('Não foi possível gerar o checkout do Stripe.');
      }

      window.location.href = checkoutUrl;
    } catch (err: unknown) {
      const message =
        (err instanceof Error && err.message) ||
        (typeof err === 'object' && err !== null && 'message' in err && String((err as { message: unknown }).message)) ||
        (err != null ? String(err) : 'Erro ao cadastrar');
      if (import.meta.env.DEV) console.error('[Login] Erro ao cadastrar:', err);
      toast.error(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleNextStep = () => {
    const name = signUpData.name.trim();
    const email = signUpData.email.trim();
    const password = signUpData.password.trim();
    const phone = signUpData.phone.trim();
    const strongPassword = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{6,}$/;
    if (!name || !email || !password || !phone) {
      toast.error('Preencha nome, email, senha e telefone');
      return;
    }
    if (!strongPassword.test(password)) {
      toast.error('Senha fraca: use letra maiuscula, numero e caractere especial');
      return;
    }
    setSignUpStep(2);
  };

  const passwordValue = signUpData.password;
  const passwordChecks = {
    length: passwordValue.length >= 6,
    upper: /[A-Z]/.test(passwordValue),
    number: /[0-9]/.test(passwordValue),
    special: /[^A-Za-z0-9]/.test(passwordValue),
  };
  const strengthScore = Object.values(passwordChecks).filter(Boolean).length;
  const strengthLabel = strengthScore >= 4 ? 'Forte' : strengthScore >= 3 ? 'Media' : 'Fraca';
  const strengthBars = strengthScore >= 4 ? 3 : strengthScore >= 3 ? 2 : strengthScore >= 1 ? 1 : 0;
  const strengthColor = strengthScore >= 4 ? 'bg-green-500' : strengthScore >= 3 ? 'bg-yellow-500' : 'bg-red-500';
  const strengthTextColor = strengthScore >= 4 ? 'text-green-600' : strengthScore >= 3 ? 'text-yellow-600' : 'text-red-600';

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="fixed inset-0 min-h-screen w-screen flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(120deg, #2563eb 0%, #60a5fa 50%, #1e3a8a 100%)' }}>
      {/* Fundo com blur cobrindo toda a página */}
      <div
        aria-hidden
        className="absolute inset-0 w-full h-full z-0 backdrop-blur-2xl"
        style={{
          background: 'radial-gradient(circle at 60% 40%, #60a5fa55 0%, #2563eb33 40%, #1e3a8a44 100%)',
          opacity: 0.85,
          pointerEvents: 'none',
          transition: 'background 1s',
        }}
      />
      <div className="relative z-10 flex flex-col items-center justify-center w-full min-h-screen">
        {/* Logo e título */}
        <div className="flex flex-col items-center mb-4 sm:mb-6">
          <div className="mb-2">
            <img src="/piggy-bank-logo.png" alt="Logo Cofrinho" className="w-12 h-12 sm:w-16 sm:h-16" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow-lg">ContaNossa</h1>
          <p className="text-xs sm:text-sm mt-1 drop-shadow text-white/80">Controle Financeiro Familiar</p>
        </div>
        {/* Card com efeito glass */}
        <div className="w-[calc(100%-2rem)] sm:w-[calc(100%-3rem)] md:w-full mx-auto max-w-2xl rounded-2xl glass-card shadow-xl border border-white/20 bg-white/30 backdrop-blur-xl p-4 sm:p-6">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-10 sm:h-12">
              <TabsTrigger value="signin" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <LogIn className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Entrar</span>
                <span className="sm:hidden">Entrada</span>
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm" onClick={() => setSignUpStep(1)}>
                <UserPlus className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Cadastrar</span>
                <span className="sm:hidden">Cadastro</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-4 sm:mt-6">
              <form onSubmit={handleSignIn} className="space-y-3 sm:space-y-4 p-0 sm:p-1">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="signin-email" className="text-xs sm:text-sm">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={signInData.email}
                    onChange={(e) => setSignInData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                    className="h-9 sm:h-11 text-xs sm:text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="signin-password" className="text-xs sm:text-sm">Senha</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={signInData.password}
                    onChange={(e) => setSignInData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="••••••"
                    required
                    autoComplete="current-password"
                    className="h-9 sm:h-11 text-xs sm:text-sm"
                  />
                </div>
                <Button type="submit" className="w-full h-9 sm:h-11 text-xs sm:text-sm" disabled={authLoading}>
                  {authLoading ? 'Entrando...' : 'Entrar'}
                </Button>
                <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="ghost" className="w-full text-xs sm:text-sm h-8 sm:h-10">
                      Esqueci minha senha
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm w-full mx-4">
                    <DialogHeader>
                      <DialogTitle className="text-base sm:text-lg">Recuperar senha</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="reset-email" className="text-xs sm:text-sm">Email</Label>
                        <Input
                          id="reset-email"
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="seu@email.com"
                          autoComplete="email"
                          className="h-9 sm:h-11 text-xs sm:text-sm"
                        />
                      </div>
                      <Button type="button" className="w-full h-9 sm:h-11 text-xs sm:text-sm" onClick={handlePasswordReset} disabled={resetLoading}>
                        {resetLoading ? 'Enviando...' : 'Enviar link'}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Enviaremos um link para redefinir sua senha.
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
                <p className="text-xs text-muted-foreground text-center mt-2 sm:mt-3">
                  Faça login com seu email.
                </p>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="mt-4 sm:mt-6">
              <form
                onSubmit={(e) => {
                  if (signUpStep === 1) {
                    e.preventDefault();
                    handleNextStep();
                    return;
                  }
                  handleSignUp(e);
                }}
                className="space-y-3 sm:space-y-4 p-0 sm:p-1"
              >
                {signUpStep === 1 && (
                  <>
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label htmlFor="signup-name" className="text-xs sm:text-sm">Nome</Label>
                      <Input
                        id="signup-name"
                        value={signUpData.name}
                        onChange={(e) => setSignUpData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Seu nome"
                        required
                        autoComplete="name"
                        className="h-9 sm:h-11 text-xs sm:text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="signup-email" className="text-xs sm:text-sm">Email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          value={signUpData.email}
                          onChange={(e) => setSignUpData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="seu@email.com"
                          required
                          autoComplete="email"
                          className="h-9 sm:h-11 text-xs sm:text-sm"
                        />
                      </div>
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="signup-phone" className="text-xs sm:text-sm">Telefone</Label>
                        <Input
                          id="signup-phone"
                          value={signUpData.phone}
                          onChange={(e) => setSignUpData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="(11) 99999-9999"
                          required
                          type="tel"
                          autoComplete="tel"
                          className="h-9 sm:h-11 text-xs sm:text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="signup-password" className="text-xs sm:text-sm">Senha</Label>
                        <Input
                          id="signup-password"
                          type="password"
                          value={signUpData.password}
                          onChange={(e) => setSignUpData(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="Crie sua senha"
                          minLength={6}
                          required
                          pattern="(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{6,}"
                          title="Use pelo menos 1 letra maiuscula, 1 numero e 1 caractere especial"
                          autoComplete="new-password"
                          className="h-9 sm:h-11 text-xs sm:text-sm"
                        />
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Forca da senha</span>
                            <span className={`font-semibold text-xs ${strengthTextColor}`}>{strengthLabel}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            <span className={`h-1 sm:h-1.5 rounded-full ${strengthBars >= 1 ? strengthColor : 'bg-muted'}`} />
                            <span className={`h-1 sm:h-1.5 rounded-full ${strengthBars >= 2 ? strengthColor : 'bg-muted'}`} />
                            <span className={`h-1 sm:h-1.5 rounded-full ${strengthBars >= 3 ? strengthColor : 'bg-muted'}`} />
                          </div>
                          <p className="text-xs text-muted-foreground leading-tight">
                            Requisitos: 6+ caracteres, 1 maiuscula, 1 numero e 1 caractere especial.
                          </p>
                        </div>
                      </div>
                    <Button type="submit" className="w-full h-9 sm:h-11 text-xs sm:text-sm">
                      Avancar
                    </Button>
                  </>
                )}

                {signUpStep === 2 && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Escolha seu plano</Label>
                      <div className="grid grid-cols-1 gap-2 sm:gap-3" role="radiogroup" aria-label="Planos">
                        <button
                          type="button"
                          role="radio"
                          aria-checked={signUpData.selectedPlan === 'essential'}
                          onClick={() => setSignUpData(prev => ({ ...prev, selectedPlan: 'essential' }))}
                          className={`rounded-lg sm:rounded-xl border p-2.5 sm:p-4 text-left transition-all ${signUpData.selectedPlan === 'essential'
                            ? 'border-blue-500 bg-blue-50/70 shadow-sm'
                            : 'border-white/20 bg-white/40 hover:border-blue-300'}
                          `}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-semibold text-foreground">ContaNossa Essencial</p>
                              <p className="text-xs text-muted-foreground">Ideal para comecar</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-base sm:text-lg font-bold text-blue-700">R$ 29,90</p>
                              <p className="text-xs text-muted-foreground">/mes</p>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground line-clamp-2 sm:line-clamp-none">
                            <span className="font-semibold text-foreground">Dashboard:</span> Visão geral das finanças da família, entradas e saídas recentes.<br />
                            <span className="font-semibold text-foreground">Entradas e Saídas:</span> Registre receitas e despesas por membro, com categorias e tags personalizadas.<br />
                            <span className="font-semibold text-foreground">Saúde Financeira:</span> Acompanhe indicadores, maiores gastos e contribuições.<br />
                            <span className="font-semibold text-foreground">Categorias e Tags:</span> Personalize para melhor organização.<br />
                            <span className="font-semibold text-foreground">Limite de 3 membros:</span> Gerencie até 3 membros na família.<br />
                            <span className="font-semibold text-foreground">Relatórios CSV/PDF:</span> Exporte relatórios financeiros em CSV ou PDF.<br />
                            <span className="font-semibold text-foreground">ID Familiar:</span> Identificação única da família para organização e suporte.
                          </div>
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={signUpData.selectedPlan === 'full'}
                          onClick={() => setSignUpData(prev => ({ ...prev, selectedPlan: 'full' }))}
                          className={`rounded-lg sm:rounded-xl border p-2.5 sm:p-4 text-left transition-all ${signUpData.selectedPlan === 'full'
                            ? 'border-purple-500 bg-purple-50/70 shadow-sm'
                            : 'border-white/20 bg-white/40 hover:border-purple-300'}
                          `}
                        >
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch">
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <p className="text-xs sm:text-sm font-semibold text-foreground">ContaNossa Pro</p>
                              <p className="text-xs text-muted-foreground mb-0">Tudo liberado</p>
                              <div className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-none mt-1">
                                Tudo do Essencial +<br />
                                <span className="font-semibold text-foreground">Bancos:</span> Cadastre múltiplos bancos, concilie saldos, faça transferências.<br />
                                <span className="font-semibold text-foreground">Cartões:</span> Gerencie cartões de crédito, acompanhe limites, faturas e bloqueios.<br />
                                <span className="font-semibold text-foreground">Dívidas:</span> Controle dívidas e parcelas, visualize prazos e lançamentos automáticos.<br />
                                <span className="font-semibold text-foreground">Investimentos:</span> Registre e acompanhe investimentos, veja evolução de patrimônio.<br />
                                <span className="font-semibold text-foreground">Membros ilimitados:</span> Adicione quantos membros quiser à família.<br />
                                <span className="font-semibold text-foreground">Relatórios CSV/PDF:</span> Exporte dados financeiros em CSV ou PDF.<br />
                                <span className="font-semibold text-foreground">ID Familiar:</span> Identificação única da família para organização e suporte.
                              </div>
                            </div>
                            <div className="flex flex-col items-end justify-center min-w-[120px]">
                              <span className="inline-block mb-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-600 text-white whitespace-nowrap">Recomendado</span>
                              <span className="text-base sm:text-lg font-bold text-purple-700 line-through">R$ 49,90</span>
                              <span className="text-2xl sm:text-3xl font-bold text-green-600">R$ 29,90</span>
                              <span className="text-xs text-green-700 font-semibold">Primeiro ano</span>
                              <span className="text-xs text-muted-foreground">/mes</span>
                              <span className="mt-1 text-[11px] text-green-700 font-semibold">Promoção válida por tempo limitado.</span>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-9 sm:h-11 text-xs sm:text-sm"
                        onClick={() => setSignUpStep(1)}
                        disabled={authLoading}
                      >
                        Voltar
                      </Button>
                      <Button type="submit" className="w-full h-9 sm:h-11 text-xs sm:text-sm" disabled={authLoading}>
                        {authLoading ? 'Cadastrando...' : 'Criar conta'}
                      </Button>
                    </div>
                  </>
                )}
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
