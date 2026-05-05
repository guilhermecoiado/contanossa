import { useState, useContext, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ValuesVisibilityContext } from '@/contexts/ValuesVisibilityContext';
import { Link, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { normalizePlan } from '@/lib/plans';
import { useToast } from '@/hooks/use-toast';

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
  const { currentMember, currentPlan, logout } = useAuth();
  const normalizedPlan = normalizePlan(currentPlan);
  const visibleNavigation = normalizedPlan === 'essential' ? navigationEssential : navigationFull;
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

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
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "fixed top-4 z-50 lg:hidden bg-blue-500/25 border border-blue-400/40 backdrop-blur-md text-blue-700 dark:text-blue-200 hover:bg-blue-500/35 rounded-xl shadow-sm transition-all duration-300",
          isMobileOpen ? "left-[17rem]" : "left-3"
        )}
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

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
          "fixed top-0 left-0 z-40 h-screen w-64 bg-card border-r border-border transition-transform duration-300 lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
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
    </>
  );
}
