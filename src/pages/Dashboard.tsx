import { useState, useContext, useMemo } from 'react';
import { ValuesVisibilityContext } from '@/contexts/ValuesVisibilityContext';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { HealthCard } from '@/components/dashboard/HealthCard';
import { MemberHealthCard } from '@/components/dashboard/MemberHealthCard';
import { QuickStats } from '@/components/dashboard/QuickStats';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { useAuth } from '@/contexts/AuthContext';
import { useMembers, useIncomeSources } from '@/hooks/useMembers';
import { useIncomes, useExpenses, useExpenseCategories, useInvestments, useRecurringExpenses } from '@/hooks/useFinances';
import { useBrapiQuotes } from '@/hooks/useBrapi';
import { useBcbRates } from '@/hooks/useBcbRates';
import { useSyncBalance } from '@/hooks/useSyncBalance';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Eye, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { isEssentialPlan } from '@/lib/plans';

function getCryptoQuoteCandidates(symbol: string) {
  const normalized = symbol.toUpperCase().trim();
  if (!normalized) return [];
  const noDash = normalized.replace('-', '');
  return Array.from(new Set([`${normalized}-BRL`, `${noDash}BRL`, normalized]));
}

function getQuoteRequestSymbols(symbol: string, typeOrMode?: string) {
  if (!symbol) return [] as string[];
  if (typeOrMode === 'crypto') return getCryptoQuoteCandidates(symbol);
  return [symbol];
}

function getQuoteValue(
  quoteMap: Record<string, number>,
  symbol?: string | null,
  typeOrMode?: string
) {
  if (!symbol) return undefined;
  if (typeOrMode === 'crypto') {
    const candidates = getCryptoQuoteCandidates(symbol);
    for (const candidate of candidates) {
      const value = quoteMap[candidate];
      if (typeof value === 'number') return value;
    }
    return undefined;
  }
  const value = quoteMap[symbol];
  return typeof value === 'number' ? value : undefined;
}

function countBusinessDays(start: Date, end: Date) {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0;

  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  let total = 0;
  while (cursor < endDate) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

function calcCdbCurrentValue(
  startDate: string,
  investedValue: number,
  indexer: 'cdi' | 'selic',
  cdbRatePercent: number,
  rates?: { cdi?: number; selic?: number }
) {
  const start = new Date(startDate);
  const now = new Date();
  const businessDays = countBusinessDays(start, now);

  const benchmarkAnnual = indexer === 'cdi' ? rates?.cdi : rates?.selic;
  if (!benchmarkAnnual || benchmarkAnnual <= 0) return Number(investedValue.toFixed(2));

  const effectiveAnnual = (benchmarkAnnual * cdbRatePercent) / 100;
  const factor = Math.pow(1 + effectiveAnnual / 100, businessDays / 252);
  return Number((Number(investedValue || 0) * factor).toFixed(2));
}

function monthsSince(startDate: string) {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(1, months + 1);
}

function calcConsortiumCurrentValue(
  startDate: string,
  monthlyValue: number,
  termMonths: number,
  isContemplated?: boolean | null,
  contemplatedValue?: number | null,
  willSell?: boolean | null,
  saleValue?: number | null
) {
  const paidInstallments = Math.min(termMonths, monthsSince(startDate));
  const invested = Number((monthlyValue * paidInstallments).toFixed(2));

  if (willSell && saleValue && saleValue > 0) return Number(saleValue.toFixed(2));
  if (isContemplated && contemplatedValue && contemplatedValue > 0) return Number(contemplatedValue.toFixed(2));

  return invested;
}

export default function Dashboard() {
    const { valuesVisible, toggleValuesVisible } = useContext(ValuesVisibilityContext);
  const navigate = useNavigate();
  const { currentMember, currentPlan } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const { data: members = [] } = useMembers();
  const { data: categories = [] } = useExpenseCategories();
  const { data: allIncomes = [] } = useIncomes(undefined, currentMonth, currentYear);
  const { data: allExpenses = [] } = useExpenses(undefined, currentMonth, currentYear);
  const { data: investments = [] } = useInvestments();
  const { data: bcbRates } = useBcbRates();
  const { data: recurringExpenses = [] } = useRecurringExpenses();
  const { data: allIncomeSources = [] } = useIncomeSources(undefined);
  
  const syncBalance = useSyncBalance();
  
  const handleSyncBalance = async () => {
    if (!currentMember?.id) return;
    try {
      await syncBalance.mutateAsync(currentMember.id);
      toast.success('Saldo sincronizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao sincronizar saldo');
    }
  };

  const symbolsForQuote = useMemo(() => {
    const symbols = investments.flatMap((inv) => getQuoteRequestSymbols(inv.symbol || '', inv.type));
    return Array.from(new Set(symbols.filter((value): value is string => Boolean(value))));
  }, [investments]);

  const { data: quoteMap = {} } = useBrapiQuotes(symbolsForQuote);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Calculate totals
  const totalIncome = valuesVisible ? allIncomes.filter(i => i.is_realized).reduce((sum, i) => sum + Number(i.amount), 0) : 0;
  // Soma despesas realizadas + recorrentes ativas do mês/ano
  const recurringTotal = valuesVisible ? recurringExpenses
    .filter(r => r.is_active && new Date(r.start_date).getMonth() + 1 === currentMonth && new Date(r.start_date).getFullYear() === currentYear)
    .reduce((sum, r) => sum + Number(r.amount), 0) : 0;
  const totalExpenses = valuesVisible ? allExpenses.filter(e => e.is_realized).reduce((sum, e) => sum + Number(e.amount), 0) + recurringTotal : 0;
  const totalBalance = valuesVisible ? totalIncome - totalExpenses : 0;
  const totalSavings = valuesVisible
    ? investments.reduce((sum, investment) => {
        if (investment.type === 'consortium') {
          const current = calcConsortiumCurrentValue(
            investment.start_date || new Date().toISOString().slice(0, 10),
            Number(investment.consortium_monthly_value || 0),
            Number(investment.consortium_term_months || 0),
            Boolean(investment.consortium_is_contemplated),
            Number(investment.consortium_contemplated_value || 0),
            Boolean(investment.consortium_will_sell),
            Number(investment.consortium_sale_value || 0)
          );
          return sum + current;
        }

        if (investment.type === 'cdb') {
          const current = calcCdbCurrentValue(
            investment.start_date || new Date().toISOString().slice(0, 10),
            Number(investment.initial_value || investment.purchase_price || 0),
            (investment.cdb_indexer as 'cdi' | 'selic') || 'cdi',
            Number(investment.cdb_rate_percent || 0),
            bcbRates
          );
          return sum + current;
        }

        const quantity = Number(investment.quantity || 0);
        const quote = getQuoteValue(quoteMap, investment.symbol, investment.type);
        const current = quote && quantity > 0
          ? Number((quote * quantity).toFixed(2))
          : Number(investment.current_value || 0);

        return sum + current;
      }, 0)
    : 0;
  const pendingInstallments = recurringExpenses.filter(r => r.is_active).length;

  // Calculate per member
  const memberHealthData = members.map(member => {
    const memberIncomes = allIncomes.filter(i => i.member_id === member.id && i.is_realized);
    const memberExpenses = allExpenses.filter(e => e.member_id === member.id && e.is_realized);
    const recurringMemberTotal = recurringExpenses
      .filter(r => r.is_active && r.member_id === member.id && new Date(r.start_date).getMonth() + 1 === currentMonth && new Date(r.start_date).getFullYear() === currentYear)
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const income = memberIncomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const expenses = memberExpenses.reduce((sum, e) => sum + Number(e.amount), 0) + recurringMemberTotal;
    return {
      member,
      income,
      expenses,
      balance: income - expenses,
    };
  });

  // Comprometimento familiar com parcelas
  const familyInstallmentTotal = allExpenses
    .filter(e => Number(e.total_installments || 0) > 1)
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const familyFixedIncome = allIncomeSources
    .filter(s => s.is_fixed && Number(s.amount || 0) > 0)
    .reduce((sum, s) => sum + Number(s.amount), 0);
  const familyInstallmentPct = familyFixedIncome > 0 ? (familyInstallmentTotal / familyFixedIncome) * 100 : undefined;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="w-full sm:w-auto rounded-2xl border border-primary/25 bg-primary/10 backdrop-blur-md px-4 py-3 sm:px-5 sm:py-4 text-center sm:text-left shadow-sm">
            <p className="text-[11px] sm:text-xs font-medium uppercase tracking-wide text-primary/80 mb-1">
              Painel da Família
            </p>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground leading-tight">
              Olá, {currentMember?.name?.split(' ')[0]}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Confira a saúde financeira da sua família
            </p>
          </div>

          {/* Sync balance button + Month selector */}
          <div className="flex w-full sm:w-auto flex-col sm:flex-row sm:items-center gap-3">
            {/* Sync balance button (hidden for essential plan) */}
            {!isEssentialPlan(currentPlan) && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleSyncBalance}
                disabled={syncBalance.isPending}
                title="Sincroniza o saldo com o total dos bancos"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncBalance.isPending ? 'animate-spin' : ''}`} />
                {syncBalance.isPending ? 'Sincronizando...' : 'Sincronizar Saldos'}
              </Button>
            )}
            
            {/* Month selector */}
            <div className="flex items-center justify-between gap-2 bg-card rounded-xl p-2 border border-border w-full sm:w-auto">
              <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-medium text-foreground w-[128px] sm:min-w-[140px] text-center">
                {monthNames[currentMonth - 1]} {currentYear}
              </span>
              <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <QuickStats
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          totalSavings={totalSavings}
          pendingInstallments={pendingInstallments}
          investments={investments}
        />

        {/* Family Health + Members Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Family Health Card */}
          <div className="lg:col-span-1">
            <HealthCard
              title="Saúde da Família"
              income={totalIncome}
              expenses={totalExpenses}
              balance={totalBalance}
              variant="deep-purple"
              installmentPct={familyInstallmentPct}
            />
          </div>

          {/* Members Cards */}
          <div className="lg:col-span-2">
            <h3 className="font-semibold text-lg mb-4">Membros</h3>
            {memberHealthData.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center">
                <p className="text-muted-foreground mb-4">Nenhum membro cadastrado</p>
                <Button onClick={() => navigate('/members')}>
                  Cadastrar Membro
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {memberHealthData.map(({ member, income, expenses, balance }) => {
                  const memberInstallmentTotal = allExpenses
                    .filter(e => e.member_id === member.id && Number(e.total_installments || 0) > 1)
                    .reduce((sum, e) => sum + Number(e.amount), 0);
                  const memberFixedIncome = allIncomeSources
                    .filter(s => s.member_id === member.id && s.is_fixed && Number(s.amount || 0) > 0)
                    .reduce((sum, s) => sum + Number(s.amount), 0);
                  const installmentPct = memberFixedIncome > 0 ? (memberInstallmentTotal / memberFixedIncome) * 100 : undefined;
                  return (
                  <MemberHealthCard
                    key={member.id}
                    member={member}
                    income={income}
                    expenses={expenses}
                    balance={balance}
                    installmentPct={installmentPct}
                  />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <RecentTransactions
          incomes={allIncomes}
          expenses={allExpenses}
          categories={categories}
        />
      </div>
    </MainLayout>
  );
}
