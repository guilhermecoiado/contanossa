import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { isEssentialPlan } from '@/lib/plans';
import { toast } from 'sonner';
import { useDeleteAccount } from '@/hooks/useDeleteAccount';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Trash2, Check, ChevronDown, Mail, MessageCircle, Crown } from 'lucide-react';

const planDetails = {
  essential: {
    name: 'ContaNossa Essencial',
    price: 'R$ 29,90',
    period: '/mês',
    description: 'Perfeito para começar',
    features: [
      'Dashboard com visão geral',
      'Gestão de membros da família',
      'Registro de entradas',
      'Registro de saídas',
      'Categorias e tags personalizadas',
      'Acompanhamento da saúde financeira',
      'Limite de 3 membros',
    ],
    details: [
      'Dashboard com resumo de entradas e saídas por membro, resumo da saúde financeira familiar, transações recentes',
      'Até 3 membros cadastrados com fontes de rendas ilimitadas e resumo de rendas fixas',
      'Registro de entradas por membro e fonte de renda; total de entradas por mês; entrada realizada ou não realizada',
      'Registro de saídas por membro com categorias pré-definidas ou personalizadas; total de saídas por mês',
      'Categorias e tags personalizadas para entradas, saídas e dívidas',
      'Registro de saídas recorrentes',
      'Filtros para pesquisas de entradas e saídas',
      'Saúde da Família com resumo de gastos, saldo, maiores gastos por categoria, contribuição na renda por membro, indicativo de saúde financeira',
      'Dicas financeiras personalizadas',
    ],
  },
  full: {
    name: 'ContaNossa Pro',
    price: 'R$ 29,90',
    period: '/mês',
    description: 'Tudo que você precisa',
    features: [
      'Todos os recursos do ContaNossa Essencial',
      'Gestão de múltiplos bancos',
      'Gestão de cartões de crédito',
      'Categorias e tags personalizadas',
      'Rastreamento de dívidas',
      'Carteira de investimentos',
      'Membros ilimitados',
      'Relatórios avançados',
    ],
    details: [
      'Dashboard completo com resumo de entradas e saídas por membro, saúde financeira familiar, investimentos, parcelas e dívidas; sincronização de saldo bancário',
      'Cadastro de membros sem limites com fontes de rendas ilimitadas e resumo de rendas fixas',
      'Conciliação bancária com cadastro de bancos, saldo atualizado automaticamente, ajuste manual, transferência entre bancos, log de movimentações',
      'Cadastro de cartões de crédito com resumo de limites, fatura, bloqueio de cartões, log de movimentações, indicativo de cartões emprestados',
      'Categorias e tags personalizadas para entradas, saídas e dívidas',
      'Cadastro de dívidas ou parcelas fixas com total de dívidas, saldo bancário, prazo restante e lançamento direto para saídas',
      'Registro de entradas por membro com saldo aplicado de acordo com banco selecionado',
      'Registro de saídas com dedução automática de saldo bancário, lançamento de parcelas, categorias personalizáveis',
      'Registro de saídas recorrentes com automação e relatórios',
      'Registro de investimentos com atualização automática de mercado e resumo de patrimônio',
      'Filtros avançados para pesquisas de entradas e saídas',
      'Saúde da Família com resumo de gastos, saldo, patrimônio, maiores gastos, contribuição por membro, indicativo de saúde',
      'Dicas financeiras personalizadas',
    ],
  },
};

export default function PlanPage() {
  const { currentPlan, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandDetails, setExpandDetails] = useState(false);
  const { deleteAccount } = useDeleteAccount();

  const handleUpgrade = async () => {
    if (!user) {
      toast.error('Usuário não autenticado.');
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error('Sessão inválida para iniciar upgrade.');
      }

      const { data, error } = await supabase.functions.invoke('start-upgrade-checkout-session', {
        body: {
          access_token: token,
          target_plan: 'full',
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao iniciar upgrade de plano');
      }

      const checkoutUrl = data?.checkout_url;
      if (!checkoutUrl) {
        throw new Error('Não foi possível gerar checkout para upgrade.');
      }

      window.location.href = checkoutUrl;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao iniciar upgrade';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const essential = isEssentialPlan(currentPlan);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      toast.success('Conta deletada com sucesso');
      setDeleteDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao deletar conta';
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Desktop Header */}
        <div className="hidden sm:flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center flex-shrink-0">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Seu Plano</h1>
            <p className="text-muted-foreground">Gerencie sua assinatura e recursos disponíveis</p>
          </div>
        </div>
        {/* Mobile Header Box */}
        <div className="sm:hidden flex flex-col items-center gap-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-xl p-4 border border-purple-200 dark:border-purple-800 shadow-sm w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center flex-shrink-0">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Seu Plano</h1>
          </div>
          <p className="text-muted-foreground text-center text-sm">Gerencie sua assinatura e recursos disponíveis</p>
        </div>

        {/* Plan Price Card - Beautiful Design */}
        <div className={`rounded-xl overflow-hidden transition-all duration-300 p-5 ${
          essential 
            ? 'bg-gradient-to-r from-blue-500/15 to-cyan-500/15 border border-blue-500/25 shadow-md shadow-blue-500/10' 
            : 'bg-gradient-to-r from-purple-500/15 to-pink-500/15 border border-purple-500/25 shadow-md shadow-purple-500/10'
        }`}>
          <div className="space-y-4">
            {/* Top Row: Badge and Name */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 rounded-lg p-2 sm:p-0">
              <div>
                <div className={`inline-block px-2.5 py-1 rounded-full text-[9px] whitespace-nowrap sm:px-3 sm:text-xs font-semibold mb-2 ${
                  essential
                    ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                    : 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
                }`}>
                  {planDetails[essential ? 'essential' : 'full'].description}
                </div>
                <h2 className={`text-base sm:text-2xl font-bold whitespace-nowrap tracking-tight ${
                  essential ? 'text-blue-900 dark:text-blue-100' : 'text-purple-900 dark:text-purple-100'
                }`}>
                  {planDetails[essential ? 'essential' : 'full'].name}
                </h2>
              </div>
              
              {/* Price - Right Side */}
              <div className="text-left sm:text-right shrink-0">
                <div className="flex items-baseline gap-1">
                  {essential ? (
                    <>
                      <span className="text-2xl sm:text-3xl font-bold tracking-tight text-blue-700 dark:text-blue-300">
                        {planDetails.essential.price}
                      </span>
                      <span className="text-[11px] sm:text-xs italic text-blue-600 dark:text-blue-400">
                        {planDetails.essential.period}
                      </span>
                    </>
                  ) : (
                    <div className="flex flex-col items-end">
                      <span className="text-lg sm:text-xl font-bold text-purple-700 line-through">R$ 49,90</span>
                      <span className="text-2xl sm:text-3xl font-bold text-green-600">R$ 29,90</span>
                      <span className="text-xs text-green-700 font-semibold">Primeiro ano</span>
                      <span className="text-[11px] sm:text-xs italic text-purple-600 dark:text-purple-400">/mês</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Features - 2 columns on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {planDetails[essential ? 'essential' : 'full'].features.slice(0, 4).map((feature, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Check className={`w-4 h-4 shrink-0 mt-0.5 ${
                    essential ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'
                  }`} />
                  <span className="text-foreground text-xs">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Plan Details Section */}
        <div className="glass-card rounded-xl p-5">
          <button
            onClick={() => setExpandDetails(!expandDetails)}
            className="w-full flex items-center justify-between gap-3 text-left"
          >
            <h3 className="font-semibold text-foreground">O que está incluso neste plano</h3>
            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${expandDetails ? 'rotate-180' : ''}`} />
          </button>

          {expandDetails && (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              {planDetails[essential ? 'essential' : 'full'].details.map((detail, idx) => (
                <div key={idx} className="flex gap-3 text-sm">
                  <Check className={`w-4 h-4 shrink-0 mt-0.5 ${
                    essential ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'
                  }`} />
                  <p className="text-muted-foreground leading-relaxed">{detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Show Full Plan Details for Essential Users */}
        {essential && (
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/25 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-lg text-purple-900 dark:text-purple-100 mb-1">ContaNossa Pro</h3>
              <p className="text-sm text-muted-foreground">O que está incluso no ContaNossa Pro</p>
            </div>

            <div className="grid gap-3">
              {planDetails.full.details.map((detail, idx) => (
                <div key={idx} className="flex gap-3 text-sm">
                  <Check className="w-4 h-4 shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
                  <p className="text-muted-foreground leading-relaxed">{detail}</p>
                </div>
              ))}
            </div>

            <Button 
              onClick={handleUpgrade} 
              disabled={loading}
              className="w-full mt-2 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {loading ? 'Redirecionando...' : 'Fazer upgrade para ContaNossa Pro'}
            </Button>
          </div>
        )}

        {/* Support Section */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MessageCircle className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-2">Precisa de Ajuda?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Se tiver qualquer dúvida sobre seu plano ou encontrar algum problema, nossa equipe de suporte está aqui para ajudar.
              </p>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <a 
                  href="mailto:contanossaapp@gmail.com"
                  className="text-primary hover:text-primary/80 font-medium underline transition-colors"
                >
                  contanossaapp@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Account Section */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Excluir Conta</h2>
              <p className="text-sm text-muted-foreground">Remover permanentemente sua conta e todos os seus dados</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Excluir Conta
            </Button>
          </div>
        </div>

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Excluir Conta"
          description="Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita. Todos seus dados serão permanentemente deletados."
          actionLabel="Excluir"
          cancelLabel="Cancelar"
          isDangerous
          isLoading={isDeleting}
          onConfirm={handleDeleteAccount}
        />
      </div>
    </MainLayout>
  );
}
