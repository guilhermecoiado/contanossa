// ...existing code...
// Garantir que React/useState seja importado primeiro para evitar erro de hoisting
import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { HealthCard } from '@/components/dashboard/HealthCard';
import { MemberHealthCard } from '@/components/dashboard/MemberHealthCard';
import { useMembers, useIncomeSources } from '@/hooks/useMembers';
import { useIncomes, useExpenses, useInvestments, useExpenseCategories, useBanks, useCards } from '@/hooks/useFinances';
import { useDebts } from '@/hooks/useDebts';
import { useBrapiQuotes } from '@/hooks/useBrapi';
import { useBcbRates } from '@/hooks/useBcbRates';
import { useSyncBalance } from '@/hooks/useSyncBalance';
import { useFamilyTransfers } from '@/hooks/useFamilyTransfers';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Heart, Users, PiggyBank, Search, RefreshCw, Download, CreditCard, Wallet } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import financialTips from '@/data/financialTips.json';
import { isEssentialPlan } from '@/lib/plans';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportFamilyHealthData, type FamilyHealthExportFormat, type FamilyHealthExportScope } from '@/lib/familyHealthExport';

type FinancialTip = {
  titulo: string;
  texto: string;
};

function getTipsBatch(tips: FinancialTip[], startIndex: number, batchSize = 3) {
  if (tips.length <= batchSize) return tips;

  return Array.from({ length: batchSize }, (_, offset) => {
    const index = (startIndex + offset) % tips.length;
    return tips[index];
  });
}

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

export default function FamilyHealthPage() {
  const [showTopCategories, setShowTopCategories] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [tipsStartIndex, setTipsStartIndex] = useState(0);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<FamilyHealthExportFormat>('csv');
  const [exportScope, setExportScope] = useState<FamilyHealthExportScope>('all');
  const [isExporting, setIsExporting] = useState(false);

  const { currentMember, currentPlan } = useAuth();
  const { data: members = [] } = useMembers();
  const { data: allIncomes = [] } = useIncomes(undefined, currentMonth, currentYear);
  const { data: allExpenses = [] } = useExpenses(undefined, currentMonth, currentYear);
  const { data: allExpensesFull = [] } = useExpenses(undefined, undefined, undefined);
  const { data: allBanks = [] } = useBanks();
  const { data: allCards = [] } = useCards();
  // Income sources (renda fixa) de todos os membros para cálculo de comprometimento
  const { data: allIncomeSources = [] } = useIncomeSources(undefined);
  const { data: familyTransfers = [] } = useFamilyTransfers(currentMember?.id || undefined);
  const { data: investments = [] } = useInvestments();
  const { data: bcbRates } = useBcbRates();
  const { data: categories = [] } = useExpenseCategories();
  const { data: allDebts = [] } = useDebts();
  
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

  useEffect(() => {
    if (financialTips.length <= 3) return;

    const randomStart = Math.floor(Math.random() * financialTips.length);
    setTipsStartIndex(randomStart);

    const interval = setInterval(() => {
      setTipsStartIndex((prev) => (prev + 3) % financialTips.length);
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  const visibleTips = useMemo(
    () => getTipsBatch(financialTips as FinancialTip[], tipsStartIndex, 3),
    [tipsStartIndex]
  );

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const monthLabels = monthNames;

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
  const totalIncome = allIncomes.filter(i => i.is_realized).reduce((sum, i) => sum + Number(i.amount), 0);
  // Soma despesas realizadas + recorrentes ativas do mês/ano
  const { data: recurringExpenses = [] } = useQuery({
    queryKey: ['recurring_expenses_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('is_active', true)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const recurringTotal = recurringExpenses
    .filter(r => r.is_active && new Date(r.start_date).getMonth() + 1 === currentMonth && new Date(r.start_date).getFullYear() === currentYear)
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const totalExpenses = allExpenses.filter(e => e.is_realized).reduce((sum, e) => sum + Number(e.amount), 0) + recurringTotal;
  const totalBalance = totalIncome - totalExpenses;
  const totalSavings = investments.reduce((sum, investment) => {
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
  }, 0);

  const valuesTransfers = familyTransfers.filter((transfer) =>
    transfer.creditor_member_id === currentMember?.id &&
    transfer.status !== 'payment_received' &&
    transfer.status !== 'rejected'
  );
  const currentValuesMonth = String(new Date().getMonth() + 1);
  const [valuesSectionOpen, setValuesSectionOpen] = useState(false);
  const [valuesMonthFilter, setValuesMonthFilter] = useState<string>(currentValuesMonth);
  const hasAnyValues = valuesTransfers.length > 0;
  const handleToggleValuesSection = () => {
    setValuesSectionOpen(open => {
      const next = !open;
      if (next) setValuesMonthFilter(String(new Date().getMonth() + 1));
      return next;
    });
  };
  const filteredValuesEntries = useMemo(() => {
    const monthNumber = valuesMonthFilter === 'all' ? null : Number(valuesMonthFilter);
    return valuesTransfers.filter(entry => {
      if (!monthNumber) return true;
      const rawDate = entry.requested_date || entry.created_at;
      if (!rawDate) return false;
      const entryMonth = new Date(rawDate).getMonth() + 1;
      return entryMonth === monthNumber;
    });
  }, [valuesTransfers, valuesMonthFilter]);

  const valuesTotals = useMemo(() => {
    const byPerson: Record<string, number> = {};
    let total = 0;
    filteredValuesEntries.forEach(entry => {
      const amount = Number(entry.amount || 0);
      const displayName =
        entry.debtor?.name ||
        entry.debtor_name ||
        members.find((m) => m.id === entry.debtor_member_id)?.name ||
        'Nao especificado';
      byPerson[displayName] = (byPerson[displayName] || 0) + amount;
      total += amount;
    });
    return { total, byPerson };
  }, [filteredValuesEntries, members]);

  const lentCardExpenses = allExpensesFull.filter(e => e.lend_card);
  const lentRecurring = recurringExpenses.filter((r: any) => r.lend_card);
  const currentLentMonth = String(new Date().getMonth() + 1);
  const [lentSectionOpen, setLentSectionOpen] = useState(false);
  const [lentMonthFilter, setLentMonthFilter] = useState<string>(currentLentMonth);
  const hasAnyLent = lentCardExpenses.length > 0 || lentRecurring.length > 0;
  const handleToggleLentSection = () => {
    setLentSectionOpen(open => {
      const next = !open;
      if (next) setLentMonthFilter(String(new Date().getMonth() + 1));
      return next;
    });
  };
  const filteredLentEntries = useMemo(() => {
    const monthNumber = lentMonthFilter === 'all' ? null : Number(lentMonthFilter);
    const entries = [...lentCardExpenses, ...lentRecurring];
    return entries.filter(entry => {
      if (!monthNumber) return true;
      const rawDate = 'date' in entry ? entry.date : entry.start_date;
      if (!rawDate) return false;
      const entryMonth = new Date(rawDate).getMonth() + 1;
      return entryMonth === monthNumber;
    });
  }, [lentCardExpenses, lentRecurring, lentMonthFilter]);

  const lentTotals = useMemo(() => {
    const byPerson: Record<string, { total: number; open: number; received: number }> = {};
    let total = 0;

    filteredLentEntries.forEach((entry: any) => {
      const amount = Number(entry.amount || 0);
      const displayName = entry.lend_to?.trim() || 'Nao especificado';
      const isReceived = 'is_realized' in entry ? Boolean(entry.is_realized) : false;

      if (!byPerson[displayName]) {
        byPerson[displayName] = { total: 0, open: 0, received: 0 };
      }

      byPerson[displayName].total += amount;
      if (isReceived) {
        byPerson[displayName].received += amount;
      } else {
        byPerson[displayName].open += amount;
      }

      total += amount;
    });

    return { total, byPerson };
  }, [filteredLentEntries]);

  // Calculate per member
  const memberHealthData = members.map(member => {
    const memberIncomes = allIncomes.filter(i => i.member_id === member.id && i.is_realized);
    const memberExpenses = allExpenses.filter(e => e.member_id === member.id && e.is_realized);
    const recurringMemberTotal = recurringExpenses
      .filter(r => r.is_active && r.member_id === member.id && new Date(r.start_date).getMonth() + 1 === currentMonth && new Date(r.start_date).getFullYear() === currentYear)
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const income = memberIncomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const expenses = memberExpenses.reduce((sum, e) => sum + Number(e.amount), 0) + recurringMemberTotal;

    // Comprometimento com parcelas: parcelas do mês corrente (realizadas ou não) / renda fixa
    const memberInstallments = allExpenses.filter(
      e => e.member_id === member.id && Number(e.total_installments || 0) > 1
    );
    const installmentTotal = memberInstallments.reduce((sum, e) => sum + Number(e.amount), 0);
    const memberFixedIncome = allIncomeSources
      .filter(s => s.member_id === member.id && s.is_fixed && Number(s.amount || 0) > 0)
      .reduce((sum, s) => sum + Number(s.amount), 0);
    const installmentPct = memberFixedIncome > 0 ? (installmentTotal / memberFixedIncome) * 100 : undefined;

    return {
      member,
      income,
      expenses,
      balance: income - expenses,
      contribution: totalIncome > 0 ? (income / totalIncome) * 100 : 0,
      installmentPct,
    };
  });

  // Comprometimento familiar total (soma de todos os membros)
  const familyInstallmentTotal = memberHealthData.reduce((sum, m) => {
    const memberInstallments = allExpenses.filter(
      e => e.member_id === m.member.id && Number(e.total_installments || 0) > 1
    );
    return sum + memberInstallments.reduce((s, e) => s + Number(e.amount), 0);
  }, 0);
  const familyFixedIncome = allIncomeSources
    .filter(s => s.is_fixed && Number(s.amount || 0) > 0)
    .reduce((sum, s) => sum + Number(s.amount), 0);
  const familyInstallmentPct = familyFixedIncome > 0 ? (familyInstallmentTotal / familyFixedIncome) * 100 : undefined;

  // Savings rate
  const savingsRate = totalIncome > 0 ? (totalBalance / totalIncome) * 100 : 0;

  // Maiores gastos por categoria
  const realizedExpenses = allExpenses.filter(e => e.is_realized);
  let expensesByCategory = categories.map(category => {
    const total = realizedExpenses
      .filter(e => e.category_id === category.id)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    return {
      ...category,
      total,
    };
  });
  // Adiciona "Dívidas" como categoria extra
  const totalDebts = allDebts.filter(d => d.status === 'open').reduce((sum, d) => sum + Number(d.current_value), 0);
  if (totalDebts > 0) {
    expensesByCategory.push({
      id: 'debts',
      name: 'Dívidas',
      total: totalDebts,
      color: '#e11d48',
    });
  }
  expensesByCategory = expensesByCategory.filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const monthLabel = `${monthNames[currentMonth - 1]} ${currentYear}`;
      await exportFamilyHealthData(exportFormat, exportScope, {
        month: currentMonth,
        year: currentYear,
        monthLabel,
        totalIncome,
        totalExpenses,
        totalBalance,
        totalSavings,
        savingsRate,
        incomes: [...allIncomes].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        expenses: [...allExpenses].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        members,
        banks: allBanks,
        cards: allCards,
        categories,
        memberSummaries: memberHealthData.map(({ member, income, expenses, balance, contribution }) => ({
          memberName: member.name,
          income,
          expenses,
          balance,
          contribution,
        })),
        topCategories: expensesByCategory.map(({ name, total }) => ({ name, total: Number(total) })),
      });
      toast.success('Arquivo exportado com sucesso!');
      setIsExportDialogOpen(false);
    } catch {
      toast.error('Não foi possível exportar os dados.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="hidden sm:flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl gradient-family-chumbo flex items-center justify-center flex-shrink-0">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                Saúde da Família
              </h1>
              <p className="text-muted-foreground">
                Finança Familiar
              </p>
            </div>
          </div>

          {/* Mobile Header Box */}
          <div className="sm:hidden flex flex-col items-center gap-3 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-family-chumbo flex items-center justify-center flex-shrink-0">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                Saúde da Família
              </h1>
            </div>
            <p className="text-muted-foreground text-center text-sm">
              Finança Familiar
            </p>
          </div>

          {/* Sync balance button + Month selector */}
          <div className="flex w-full sm:w-auto flex-col sm:flex-row sm:items-center gap-3">
            <Button
              variant="default"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              size="sm"
              onClick={() => setIsExportDialogOpen(true)}
              title="Exportar dados da saúde da família"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>

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

        <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Exportar dados</DialogTitle>
              <DialogDescription>
                Escolha o formato do arquivo e o conteúdo que deseja exportar da Saúde da Família.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Formato do arquivo</p>
                <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as FamilyHealthExportFormat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV (planilha completa)</SelectItem>
                    <SelectItem value="pdf">PDF (relatório visual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">O que exportar</p>
                <Select value={exportScope} onValueChange={(value) => setExportScope(value as FamilyHealthExportScope)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incomes">Lançamentos de entradas</SelectItem>
                    <SelectItem value="expenses">Lançamentos de saídas</SelectItem>
                    <SelectItem value="summary">Resumo da saúde da família</SelectItem>
                    <SelectItem value="all">Todas as informações (entradas + saídas + resumo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                className="h-9 px-3 text-sm w-full sm:w-auto"
                onClick={() => setIsExportDialogOpen(false)}
                disabled={isExporting}
              >
                Cancelar
              </Button>
              <Button
                className="h-9 px-3 text-sm w-full sm:w-auto"
                onClick={handleExportData}
                disabled={isExporting}
              >
                {isExporting ? 'Exportando...' : 'Exportar arquivo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Family Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={isEssentialPlan(currentPlan) ? "md:col-span-3" : "md:col-span-2"}>
            <HealthCard
              title="Consolidado da Família"
              income={totalIncome}
              expenses={totalExpenses}
              balance={totalBalance}
              variant="family"
              installmentPct={familyInstallmentPct}
            />
          </div>

          {/* Patrimônio card (hidden for essential plan) */}
          {!isEssentialPlan(currentPlan) && (
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <PiggyBank className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Patrimônio</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(totalSavings)}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Taxa de Poupança</span>
                <span className={cn(
                  "font-semibold",
                  savingsRate >= 20 ? "text-income" : savingsRate >= 10 ? "text-warning" : "text-expense"
                )}>
                  {savingsRate.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "absolute top-0 left-0 h-full rounded-full transition-all duration-500",
                    savingsRate >= 20 ? "bg-income" : savingsRate >= 10 ? "bg-warning" : "bg-expense"
                  )}
                  style={{ width: `${Math.min(savingsRate, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {savingsRate >= 20 
                  ? "Excelente! Você está poupando bem." 
                  : savingsRate >= 10 
                    ? "Bom, mas pode melhorar."
                    : "Atenção: tente poupar mais."}
              </p>
            </div>
            </div>
          )}

          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            {hasAnyValues && (
              <div className="w-full rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg animate-fade-in">
                <button
                  className="w-full flex items-center justify-between p-6 focus:outline-none"
                  onClick={handleToggleValuesSection}
                  aria-expanded={valuesSectionOpen}
                  aria-controls="valores-emprestados-content"
                >
                  <span className="font-bold text-lg">Valores Emprestados</span>
                  <span className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold">Atenção</span>
                    <svg className={`w-5 h-5 transition-transform ${valuesSectionOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </span>
                </button>
                {valuesSectionOpen && (
                  <div id="valores-emprestados-content" className="px-6 pb-4 space-y-4">
                    <div className="flex flex-col gap-3 py-2">
                      <div className="flex justify-between items-center font-bold text-base">
                        <span>Total</span>
                        <span>{formatCurrency(valuesTotals.total)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-white/80">Filtrar por mês:</span>
                        <Select value={valuesMonthFilter} onValueChange={setValuesMonthFilter}>
                          <SelectTrigger className="w-44 bg-white/10 border-white/30 text-white">
                            <SelectValue placeholder="Todos os meses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os meses</SelectItem>
                            {monthLabels.map((label, index) => (
                              <SelectItem key={label} value={String(index + 1)}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {Object.keys(valuesTotals.byPerson).length === 0 ? (
                      <p className="py-2 text-white/80">Nenhum valor emprestado neste período.</p>
                    ) : (
                      Object.entries(valuesTotals.byPerson).map(([name, value]) => (
                        <div key={name} className="flex justify-between items-center py-2 border-t border-white/20">
                          <span className="font-medium text-base">{name}</span>
                          <span className="font-bold text-lg">{formatCurrency(value)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {hasAnyLent && (
              <div className="w-full rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white shadow-lg animate-fade-in">
                <button
                  className="w-full flex items-center justify-between p-6 focus:outline-none"
                  onClick={handleToggleLentSection}
                  aria-expanded={lentSectionOpen}
                  aria-controls="emprestados-content"
                >
                  <span className="font-bold text-lg">Cartões Emprestados</span>
                  <span className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold">Atenção</span>
                    <svg className={`w-5 h-5 transition-transform ${lentSectionOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </span>
                </button>
                {lentSectionOpen && (
                  <div id="emprestados-content" className="px-6 pb-4 space-y-4">
                    <div className="flex flex-col gap-3 py-2">
                      <div className="flex justify-between items-center font-bold text-base">
                        <span>Total</span>
                        <span>{formatCurrency(lentTotals.total)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-white/80">Filtrar por mês:</span>
                        <Select value={lentMonthFilter} onValueChange={setLentMonthFilter}>
                          <SelectTrigger className="w-44 bg-white/10 border-white/30 text-white">
                            <SelectValue placeholder="Todos os meses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os meses</SelectItem>
                            {monthLabels.map((label, index) => (
                              <SelectItem key={label} value={String(index + 1)}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {Object.keys(lentTotals.byPerson).length === 0 ? (
                      <p className="py-2 text-white/80">Nenhum valor emprestado neste período.</p>
                    ) : (
                      Object.entries(lentTotals.byPerson).map(([name, stats]) => (
                        <div key={name} className="flex flex-col gap-2 py-3 border-t border-white/20">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-base">{name}</span>
                            <span className="font-bold text-lg">{formatCurrency(stats.total)}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {stats.open > 0 && (
                              <span className="px-2 py-1 rounded-full bg-amber-500/25 border border-amber-200/40 text-amber-100">
                                Em aberto: {formatCurrency(stats.open)}
                              </span>
                            )}
                            {stats.received > 0 && (
                              <span className="px-2 py-1 rounded-full bg-emerald-500/25 border border-emerald-200/40 text-emerald-100">
                                Recebido: {formatCurrency(stats.received)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>


        {/* Maiores Gastos por Categoria (Dropdown) */}
        <div className="glass-card rounded-2xl p-6 mb-8">
          <button
            className="flex items-center gap-2 mb-4 font-semibold text-sm md:text-base focus:outline-none hover:opacity-80 transition"
            onClick={() => setShowTopCategories((v) => !v)}
            aria-expanded={showTopCategories}
            aria-controls="top-categories-list"
            type="button"
          >
            <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mr-2">
              <Search className="w-5 h-5 text-primary" />
            </span>
            <span>Maiores Gastos por Categoria</span>
            {showTopCategories ? (
              <ChevronUp className="w-5 h-5 ml-2 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 ml-2 text-muted-foreground" />
            )}
          </button>
          {showTopCategories && (
            expensesByCategory.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma despesa realizada neste mês.</p>
            ) : (
              <div className="space-y-2" id="top-categories-list">
                {expensesByCategory.map(category => (
                  <div key={category.id} className="flex items-center justify-between py-1 border-b border-border last:border-b-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{category.name}</span>
                    </div>
                    <span className="font-semibold text-expense">{formatCurrency(category.total)}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Members Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Contribuição por Membro</h2>
          </div>

          {members.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-muted-foreground">
                Nenhum membro cadastrado. Cadastre os membros da família para ver a análise consolidada.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {memberHealthData.map(({ member, income, expenses, balance, contribution, installmentPct }) => (
                <MemberHealthCard
                  key={member.id}
                  member={member}
                  income={income}
                  expenses={expenses}
                  balance={balance}
                  installmentPct={installmentPct}
                  footer={(
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Contribuição na Renda</span>
                        <span className="font-semibold text-primary">{contribution.toFixed(1)}%</span>
                      </div>
                      <div className="relative h-2 bg-secondary rounded-full overflow-hidden mt-2">
                        <div 
                          className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${contribution}%` }}
                        />
                      </div>
                    </>
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* Financial Tips */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="font-semibold text-lg mb-4">💡 Dicas Financeiras</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleTips.map((tip, index) => (
              <div
                key={`${tip.titulo}-${index}`}
                className="p-4 bg-secondary/50 rounded-xl"
              >
                <p className="font-medium text-foreground mb-1">{tip.titulo}</p>
                <p className="text-sm text-muted-foreground">{tip.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
