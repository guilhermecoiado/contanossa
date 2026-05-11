import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowDownCircle, ArrowUpCircle, CreditCard, HandCoins, Landmark, PiggyBank, Repeat, Sparkles, Users } from 'lucide-react';
import { toast } from 'sonner';
import { AccountSetupAssistant, type AccountSetupAssistantStep } from '@/components/dashboard/AccountSetupAssistant';
import { useAuth } from '@/contexts/AuthContext';
import { isEssentialPlan } from '@/lib/plans';
import { useDebts } from '@/hooks/useDebts';
import { useDismissAccountSetupAssistant, useMembers } from '@/hooks/useMembers';
import { useBanks, useCards, useExpenses, useIncomes, useInvestments, useRecurringExpenses } from '@/hooks/useFinances';

interface AccountSetupAssistantContextValue {
  steps: AccountSetupAssistantStep[];
  pendingSteps: AccountSetupAssistantStep[];
  completedSteps: AccountSetupAssistantStep[];
  nextStep?: AccountSetupAssistantStep;
  hasPendingSteps: boolean;
  hasManualAssistantAccess: boolean;
  pendingCount: number;
  isReady: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  dismissAssistant: () => Promise<void>;
  openAssistant: () => void;
}

const AccountSetupAssistantContext = createContext<AccountSetupAssistantContextValue | undefined>(undefined);

export function AccountSetupAssistantProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentMember, currentPlan } = useAuth();
  const isEssential = isEssentialPlan(currentPlan);
  const [isOpen, setIsOpen] = useState(false);

  const { data: members = [], isLoading: isLoadingMembers } = useMembers();
  const { data: banks = [], isLoading: isLoadingBanks } = useBanks();
  const { data: cards = [], isLoading: isLoadingCards } = useCards();
  const { data: debts = [], isLoading: isLoadingDebts } = useDebts();
  const { data: investments = [], isLoading: isLoadingInvestments } = useInvestments();
  const { data: recurringExpenses = [], isLoading: isLoadingRecurringExpenses } = useRecurringExpenses();
  const { data: allIncomes = [], isLoading: isLoadingIncomes } = useIncomes();
  const { data: allExpenses = [], isLoading: isLoadingExpenses } = useExpenses();
  const dismissMutation = useDismissAccountSetupAssistant();

  const hasSimpleIncome = useMemo(
    () => allIncomes.some((income) => !income.bank_id && !income.income_source_id),
    [allIncomes]
  );

  const hasAnyExpenseSetup = useMemo(
    () => allExpenses.length > 0 || recurringExpenses.length > 0,
    [allExpenses, recurringExpenses]
  );

  const hasInstallmentExpense = useMemo(
    () => allExpenses.some((expense) => Number(expense.total_installments || 0) > 1),
    [allExpenses]
  );

  const hasSimpleExpense = useMemo(
    () => allExpenses.some(
      (expense) =>
        !expense.card_id &&
        !expense.bank_id &&
        !expense.output_mode &&
        !expense.category_id &&
        !expense.custom_category_id &&
        Number(expense.total_installments || 0) <= 1
    ),
    [allExpenses]
  );

  const steps = useMemo<AccountSetupAssistantStep[]>(() => {
    const setupSteps: AccountSetupAssistantStep[] = [
      {
        id: 'members',
        title: 'Membros',
        description: 'Revise quem participa da família e complete a base do grupo.',
        section: 'Configuração inicial',
        completed: members.length > 0,
        icon: <Users className="h-5 w-5" />,
      },
    ];

    if (!isEssential) {
      setupSteps.push(
        {
          id: 'banks',
          title: 'Bancos',
          description: 'Cadastre as contas para concentrar saldos e entradas.',
          section: 'Configuração inicial',
          completed: banks.length > 0,
          icon: <Landmark className="h-5 w-5" />,
        },
        {
          id: 'cards',
          title: 'Cartões',
          description: 'Adicione os cartões para acompanhar limites e compras.',
          section: 'Configuração inicial',
          completed: cards.length > 0,
          icon: <CreditCard className="h-5 w-5" />,
        },
        {
          id: 'debts',
          title: 'Dívidas',
          description: 'Registre dívidas abertas para acompanhar compromissos.',
          section: 'Configuração inicial',
          completed: debts.length > 0,
          icon: <HandCoins className="h-5 w-5" />,
        },
        {
          id: 'investments',
          title: 'Investimentos',
          description: 'Inclua reservas e aplicações para fechar o retrato financeiro.',
          section: 'Configuração inicial',
          completed: investments.length > 0,
          icon: <PiggyBank className="h-5 w-5" />,
        }
      );
    }

    setupSteps.push(
      {
        id: 'income-full',
        title: 'Primeira entrada',
        description: 'Faça o primeiro lançamento de entrada no fluxo completo.',
        section: 'Primeiros lançamentos',
        completed: allIncomes.length > 0,
        icon: <ArrowUpCircle className="h-5 w-5" />,
      },
      {
        id: 'income-simple',
        title: 'Primeira entrada simples',
        description: 'Use o atalho simplificado para registrar uma entrada rápida.',
        section: 'Primeiros lançamentos',
        completed: hasSimpleIncome,
        icon: <ArrowUpCircle className="h-5 w-5" />,
      },
      {
        id: 'expense-full',
        title: 'Primeira saída',
        description: 'Registre a primeira saída para começar a acompanhar gastos.',
        section: 'Primeiros lançamentos',
        completed: hasAnyExpenseSetup,
        icon: <ArrowDownCircle className="h-5 w-5" />,
      }
    );

    if (!isEssential) {
      setupSteps.push(
        {
          id: 'expense-recurring',
          title: 'Primeira saída recorrente',
          description: 'Cadastre um gasto recorrente para automatizar compromissos fixos.',
          section: 'Primeiros lançamentos',
          completed: recurringExpenses.length > 0,
          icon: <Repeat className="h-5 w-5" />,
        },
        {
          id: 'expense-installment',
          title: 'Primeira saída parcelada',
          description: 'Lance uma compra parcelada para acompanhar parcelas futuras.',
          section: 'Primeiros lançamentos',
          completed: hasInstallmentExpense,
          icon: <CreditCard className="h-5 w-5" />,
        }
      );
    }

    setupSteps.push({
      id: 'expense-simple',
      title: 'Primeira saída simples',
      description: 'Use o modo simples para registrar uma saída rápida.',
      section: 'Primeiros lançamentos',
      completed: hasSimpleExpense,
      icon: <Sparkles className="h-5 w-5" />,
    });

    return setupSteps;
  }, [allIncomes, allExpenses, banks.length, cards.length, debts.length, hasAnyExpenseSetup, hasInstallmentExpense, hasSimpleExpense, hasSimpleIncome, investments.length, isEssential, members.length, recurringExpenses.length]);

  const isReady = !isLoadingMembers && !isLoadingBanks && !isLoadingCards && !isLoadingDebts && !isLoadingInvestments && !isLoadingRecurringExpenses && !isLoadingIncomes && !isLoadingExpenses;
  const hasDismissedAssistant = Boolean(currentMember?.account_setup_assistant_dismissed_at);
  const pendingSteps = useMemo(() => steps.filter((step) => !step.completed), [steps]);
  const completedSteps = useMemo(() => steps.filter((step) => step.completed), [steps]);
  const nextStep = pendingSteps[0];
  const hasPendingStepsRaw = pendingSteps.length > 0;
  const hasPendingSteps = hasPendingStepsRaw && !hasDismissedAssistant;
  const hasManualAssistantAccess = steps.length > 0;

  useEffect(() => {
    if (!currentMember?.id || !isReady) return;
    if (location.pathname !== '/') return;

    setIsOpen(!hasDismissedAssistant && hasPendingStepsRaw);
  }, [currentMember?.id, hasDismissedAssistant, hasPendingStepsRaw, isReady, location.pathname]);

  const goToStep = (stepId: string) => {
    setIsOpen(false);

    const destinations: Record<string, string> = {
      members: '/members',
      banks: '/banks',
      cards: '/cards',
      debts: '/debts',
      investments: '/investments',
      'income-full': '/incomes?assistant=open&mode=full',
      'income-simple': '/incomes?assistant=open&mode=simple',
      'expense-full': '/expenses?assistant=open&mode=full&expenseType=simples',
      'expense-recurring': '/expenses?assistant=open&mode=full&expenseType=recorrente',
      'expense-installment': '/expenses?assistant=open&mode=full&expenseType=parcelado',
      'expense-simple': '/expenses?assistant=open&mode=simple&expenseType=simples',
    };

    navigate(destinations[stepId] || '/');
  };

  const dismissAssistant = async () => {
    if (!currentMember?.id) return;

    try {
      await dismissMutation.mutateAsync(currentMember.id);
      setIsOpen(false);
      toast.success('Tutorial inicial ocultado para esta conta.');
    } catch {
      toast.error('Não foi possível salvar sua preferência agora.');
    }
  };

  const openAssistant = () => {
    if (!hasManualAssistantAccess) return;
    setIsOpen(true);
  };

  return (
    <AccountSetupAssistantContext.Provider
      value={{
        steps,
        pendingSteps,
        completedSteps,
        nextStep,
        hasPendingSteps,
        hasManualAssistantAccess,
        pendingCount: hasPendingSteps ? pendingSteps.length : 0,
        isReady,
        isOpen,
        setIsOpen,
        dismissAssistant,
        openAssistant,
      }}
    >
      {children}
      {isReady && isOpen && hasManualAssistantAccess && (
        <AccountSetupAssistant
          open={isOpen}
          onOpenChange={setIsOpen}
          onDismiss={() => void dismissAssistant()}
          onGoToStep={goToStep}
          steps={steps}
          nextStepId={nextStep?.id}
          isDismissing={dismissMutation.isPending}
        />
      )}
    </AccountSetupAssistantContext.Provider>
  );
}

export function useAccountSetupAssistant() {
  const context = useContext(AccountSetupAssistantContext);

  if (!context) {
    throw new Error('useAccountSetupAssistant must be used within AccountSetupAssistantProvider');
  }

  return context;
}