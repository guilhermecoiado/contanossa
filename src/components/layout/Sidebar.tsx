import { useState, useContext, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ValuesVisibilityContext } from '@/contexts/ValuesVisibilityContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  TrendingDown,
  FileText,
  Wallet,
  CreditCard,
  PiggyBank,
  Heart,
  LogOut,
  Menu,
  X,
  RotateCcw,
  Eye,
  Crown,
  Tags,
  Download,
  Copy,
  Landmark,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { IncomeForm } from '@/components/forms/IncomeForm';
import { ExpenseForm } from '@/components/forms/ExpenseForm';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { normalizePlan } from '@/lib/plans';
import { useToast } from '@/hooks/use-toast';
import { useAccountSetupAssistant } from '@/contexts/AccountSetupAssistantContext';

const navigationEssential: Array<{ name: string; href: string; icon: any }> = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Membros', href: '/members', icon: Users },
  { name: 'Entradas', href: '/incomes', icon: TrendingUp },
  { name: 'Saídas', href: '/expenses', icon: TrendingDown },
  { name: 'Saúde da Família', href: '/family-health', icon: Heart },
  { name: 'Categorias', href: '/categories', icon: Tags },
  { name: 'Plano', href: '/plan', icon: Crown },
];

const navigationFull: Array<{ name: string; href: string; icon: any }> = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Membros', href: '/members', icon: Users },
  { name: 'Bancos', href: '/banks', icon: Wallet },
  { name: 'Cartões', href: '/cards', icon: CreditCard },
  { name: 'Dívidas / Fixos', href: '/debts', icon: FileText },
  { name: 'Entradas', href: '/incomes', icon: TrendingUp },
  { name: 'Saídas', href: '/expenses', icon: TrendingDown },
  { name: 'Investimentos', href: '/investments', icon: PiggyBank },
  { name: 'Saúde da Família', href: '/family-health', icon: Heart },
  { name: 'Categorias', href: '/categories', icon: Tags },
  { name: 'Plano', href: '/plan', icon: Crown },
];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function Sidebar() {
  const { toast } = useToast();
  const { valuesVisible, toggleValuesVisible } = useContext(ValuesVisibilityContext);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentMember, currentPlan, logout } = useAuth();
  const {
    hasPendingSteps,
    hasManualAssistantAccess,
    pendingCount,
    openAssistant,
    isReady: isAssistantReady,
  } = useAccountSetupAssistant();
  const normalizedPlan = normalizePlan(currentPlan);
  const visibleNavigation = normalizedPlan === 'essential' ? navigationEssential : navigationFull;
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isQuickIncomeOpen, setIsQuickIncomeOpen] = useState(false);
  const [isQuickExpenseOpen, setIsQuickExpenseOpen] = useState(false);
  const [quickExpenseMode, setQuickExpenseMode] = useState<'simple' | 'full'>('full');

  const mobileTabs = [
    { key: 'dashboard', label: 'Dash', href: '/', icon: LayoutDashboard, type: 'route' as const },
    { key: 'banks', label: 'Bancos', href: '/banks', icon: Landmark, type: 'route' as const },
    { key: 'income', label: 'Entrada', icon: TrendingUp, type: 'income' as const, accent: 'green' as const },
    { key: 'expense', label: 'Saída', icon: TrendingDown, type: 'expense' as const, accent: 'red' as const },
    { key: 'cards', label: 'Cartões', href: '/cards', icon: CreditCard, type: 'route' as const },
    { key: 'family-health', label: 'Família', href: '/family-health', icon: Heart, type: 'route' as const },
  ];

  const isRouteActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  const handleTabAction = (item: (typeof mobileTabs)[number]) => {
    if (item.type === 'income') {
      setIsQuickIncomeOpen(true);
      return;
    }

    if (item.type === 'expense') {
      setIsQuickExpenseOpen(true);
      return;
    }

    if (item.href) {
      navigate(item.href);
      setIsMobileOpen(false);
    }
  };

  const handleCopyFamilyId = async () => {
    const familyPublicId = currentMember?.family_public_id;
    if (!familyPublicId) {
      toast({
        title: 'ID da família indisponível',
        description: 'Tente novamente em alguns segundos.',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(familyPublicId);
      toast({
        title: 'ID copiado com sucesso!',
      });
    } catch {
      toast({
        title: 'Não foi possível copiar',
        description: 'Copie manualmente o ID exibido no menu.',
      });
    }
  };

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
    if (isStandalone) return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };

    const handleAppInstalled = () => {
      setShowInstallButton(false);
      setDeferredInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('contanossa:pwa-sidebar-cta', {
        detail: { visible: showInstallButton },
      }),
    );
  }, [showInstallButton]);

  const handleInstallApp = async () => {
    if (!deferredInstallPrompt) return;

    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    setDeferredInstallPrompt(null);
    setShowInstallButton(false);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile toggle */}
      {!isMobileOpen && (
        <div className="fixed top-4 right-3 z-50 flex items-center gap-2 lg:hidden">
          {isAssistantReady && hasPendingSteps && (
            <button
              type="button"
              onClick={() => openAssistant()}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/50 bg-sky-500/15 text-sky-700 shadow-sm backdrop-blur-md transition-all duration-300 hover:bg-sky-500/25 dark:text-sky-200"
              title="Abrir assistente de configuração"
            >
              <Sparkles className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-sky-500 ring-2 ring-background" />
            </button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="bg-blue-500/25 border border-blue-400/40 backdrop-blur-md text-blue-700 dark:text-blue-200 hover:bg-blue-500/35 rounded-xl shadow-sm transition-all duration-300"
            onClick={() => setIsMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed z-40 bg-card transition-transform duration-300 lg:top-0 lg:left-0 lg:h-screen lg:w-[272px] lg:border-r lg:border-border lg:translate-x-0",
          "top-0 left-0 right-0 h-[88vh] rounded-b-2xl border-b border-border shadow-xl lg:rounded-none lg:border-b-0 lg:shadow-none",
          isMobileOpen ? 'translate-y-0' : '-translate-y-full',
          'lg:translate-y-0 lg:translate-x-0'
        )}
      >
        {isMobileOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-3 z-50 lg:hidden bg-blue-500/25 border border-blue-400/40 backdrop-blur-md text-blue-700 dark:text-blue-200 hover:bg-blue-500/35 rounded-xl shadow-sm transition-all duration-300"
            onClick={() => setIsMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        )}
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white">
              <img src="/piggy-bank-logo.png" alt="Logo Cofrinho" className="w-12 h-12" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-lg text-foreground">ContaNossa</h1>
              <p className="text-xs text-muted-foreground">Finança Familiar</p>
              <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">ID da Família</p>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {currentMember?.family_public_id ?? 'Gerando...'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => void handleCopyFamilyId()}
                  title="Copiar ID da família"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {isAssistantReady && hasPendingSteps && (
              <button
                type="button"
                onClick={() => {
                  openAssistant();
                  setIsMobileOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
              >
                <span className="relative flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-white">
                    {pendingCount}
                  </span>
                </span>
                <span className="flex-1 text-left whitespace-nowrap">Assistente de Config.</span>
              </button>
            )}

            {visibleNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex items-center gap-1">
                    {item.name}
                  </span>
                </Link>
              );
            })}

            {showInstallButton && (
              <Button
                variant="outline"
                className="w-full mt-2 justify-start gap-3 lg:hidden"
                onClick={() => void handleInstallApp()}
              >
                <Download className="w-5 h-5" />
                Instalar app
              </Button>
            )}
          </nav>

          {/* User + Theme Switch */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2 min-w-0">
              {currentMember && (
                <div className="flex-1 min-w-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex w-full min-w-0 items-center gap-3 overflow-hidden hover:opacity-80 transition-opacity">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {currentMember.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-medium text-foreground truncate">
                            {currentMember.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {currentMember.email}
                          </p>
                          <p className="text-[11px] text-primary truncate">
                            {normalizedPlan === 'essential' ? 'ContaNossa Essencial' : 'ContaNossa Pro'}
                          </p>
                        </div>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {isAssistantReady && hasManualAssistantAccess && (
                        <DropdownMenuItem
                          onClick={() => {
                            openAssistant();
                            setIsMobileOpen(false);
                          }}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          <span>Assistente/Dicas</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => void logout()}>
                        <LogOut className="w-4 h-4 mr-2" />
                        <span>Sair</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="text-muted-foreground group shrink-0"
                title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              >
                {theme === 'dark' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.07l-.71.71M21 12h-1M4 12H3m16.66 5.66l-.71-.71M4.05 4.93l-.71-.71M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" /></svg>
                )}
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Bottom Mobile Tab Bar */}
      <div
        className={cn(
          "lg:hidden fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-0.75rem)] max-w-3xl transition-all duration-200",
          isMobileOpen ? "opacity-0 pointer-events-none translate-y-3" : "opacity-100"
        )}
        style={{ bottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div
          className={cn(
            "rounded-[1.7rem] border backdrop-blur-md shadow-[0_10px_26px_-16px_rgba(2,6,23,0.75)] px-1.5 py-1.5",
            theme === 'dark'
              ? 'border-slate-700/80 bg-slate-900/85'
              : 'border-white/80 bg-white/85'
          )}
        >
          <div className="grid grid-cols-6 gap-0.5">
            {mobileTabs.map((item) => {
              const Icon = item.icon;
              const isPrimary = item.type === 'income' || item.type === 'expense';
              const isActive = item.type === 'income'
                ? isRouteActive('/incomes') || isQuickIncomeOpen
                : item.type === 'expense'
                  ? isRouteActive('/expenses') || isQuickExpenseOpen
                  : !!item.href && isRouteActive(item.href);

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleTabAction(item)}
                  className={cn(
                    'relative flex min-w-0 flex-col items-center justify-center rounded-2xl py-1.5 transition-all duration-300',
                    'active:scale-[0.98] hover:scale-[1.01]',
                    isActive && (
                      theme === 'dark'
                        ? 'bg-gradient-to-b from-slate-700/70 to-slate-800/70 shadow-inner'
                        : 'bg-gradient-to-b from-white to-white/92 shadow-inner'
                    ),
                  )}
                >
                  <span
                    className={cn(
                      'relative z-10 flex h-8 w-9 items-center justify-center rounded-xl transition-colors',
                      isPrimary && item.accent === 'green' && 'text-emerald-500',
                      isPrimary && item.accent === 'red' && 'text-red-500',
                      !isPrimary && 'text-slate-600 dark:text-slate-300',
                      isActive && !isPrimary && 'text-slate-900 dark:text-white',
                      isActive && isPrimary && 'bg-background',
                    )}
                  >
                    <Icon className={cn(isPrimary ? 'h-4.5 w-4.5' : 'h-4 w-4')} />
                  </span>

                  <span
                    className={cn(
                      'relative z-10 mt-0.5 text-center font-medium tracking-tight text-[10.5px] leading-tight whitespace-nowrap',
                      isActive ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300',
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Add Income Modal */}
      <Dialog open={isQuickIncomeOpen} onOpenChange={setIsQuickIncomeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Entrada</DialogTitle>
            <DialogDescription className="sr-only">
              Formulário para registrar uma nova entrada.
            </DialogDescription>
          </DialogHeader>
          <IncomeForm onSuccess={() => setIsQuickIncomeOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Quick Add Expense Modal */}
      <Dialog open={isQuickExpenseOpen} onOpenChange={setIsQuickExpenseOpen}>
        <DialogContent aria-describedby="quick-add-expense-desc">
          <span id="quick-add-expense-desc" className="sr-only">Formulário para adicionar nova saída</span>
          <DialogHeader>
            <DialogTitle className="whitespace-nowrap text-base sm:text-lg leading-none pr-2 shrink-0">
              {quickExpenseMode === 'simple' ? 'Registrar Despesa Simples' : 'Registrar Despesa'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mb-3">
            <Label>Modo de lançamento</Label>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/70 bg-muted/20 p-1">
              <button
                type="button"
                onClick={() => setQuickExpenseMode('full')}
                className={`h-9 rounded-md text-sm font-medium transition-colors ${
                  quickExpenseMode === 'full'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                Completo
              </button>
              <button
                type="button"
                onClick={() => setQuickExpenseMode('simple')}
                className={`h-9 rounded-md text-sm font-medium transition-colors ${
                  quickExpenseMode === 'simple'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                Simples
              </button>
            </div>
          </div>
          <ExpenseForm
            simpleMode={quickExpenseMode === 'simple'}
            onSuccess={() => {
              setIsQuickExpenseOpen(false);
              setQuickExpenseMode('full');
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
