// ...existing code...
import { useState } from 'react';
import { useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ExpenseForm } from '@/components/forms/ExpenseForm';
import { useAuth } from '@/contexts/AuthContext';
import { useExpenses, useExpenseCategories, useUpdateExpense, useDeleteExpense, useCreateExpense } from '@/hooks/useFinances';
import { useCustomCategories } from '@/hooks/useCustomCategoriesAndTags';
import { useMembers } from '@/hooks/useMembers';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Plus, TrendingDown, ChevronLeft, ChevronRight, ChevronDown, RotateCcw, Eye, Trash2, CheckCircle2, CreditCard, Banknote, ShoppingCart, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUpdateBankBalance } from '@/hooks/useBankActions';
import { useDeleteIncome } from '@/hooks/useIncomeActions';
import { useBanks, useCards } from '@/hooks/useFinances';
import { useUpdateCard } from '@/hooks/useCardActions';
import { useFamilyTransfers, useRegisterFamilyTransferPayment, useUpdateFamilyTransferStatus, useDeleteFamilyTransfer, useCreateFamilyTransferRequest, resolveFamilyTransferRecipient, type FamilyTransfer } from '@/hooks/useFamilyTransfers';
import type { Expense, RecurringExpense } from '@/types/finance';
import { isEssentialPlan } from '@/lib/plans';
import { toast } from 'sonner';

function getTodayLocalISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function ExpensesPage() {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Novo: controle de dialog de exclusão recorrente
  const [recurringDeleteId, setRecurringDeleteId] = useState<string|null>(null);
  const [isRealizeDialogOpen, setIsRealizeDialogOpen] = useState(false);
  const [realizingExpense, setRealizingExpense] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<
    (Expense & {
      _returnToBank?: boolean;
      _returnBankId?: string;
      _deleteFutureInstallments?: boolean;
    }) | null
  >(null);
  const { data: banks = [] } = useBanks(realizingExpense?.member_id || undefined);
  const { data: deleteBanks = [] } = useBanks(deletingExpense?.member_id || undefined);
  const [deductBank, setDeductBank] = useState(true);
  // Buscar todos os cartões para filtrar por membro nos recorrentes
  const { data: allCards = [] } = useCards();
  const [realizeDate, setRealizeDate] = useState(() => getTodayLocalISO());
  const [isDeductDialogOpen, setIsDeductDialogOpen] = useState(false);
  const [pendingDeduct, setPendingDeduct] = useState(null);
  const navigate = useNavigate();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addExpenseMode, setAddExpenseMode] = useState<'simple' | 'full'>('full');
  const [isResetMonthDialogOpen, setIsResetMonthDialogOpen] = useState(false);
  const [isResettingMonth, setIsResettingMonth] = useState(false);
  const [resetInstallmentAction, setResetInstallmentAction] = useState<'delete-future' | 'keep-installments'>('delete-future');
  const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false);
  const [isRealizeAllDialogOpen, setIsRealizeAllDialogOpen] = useState(false);
  const [realizeAllDate, setRealizeAllDate] = useState(() => getTodayLocalISO());
  const [realizeAllBankId, setRealizeAllBankId] = useState('');
  const [showRealizeBankList, setShowRealizeBankList] = useState(false);
  const [showRealizeAllBankList, setShowRealizeAllBankList] = useState(false);
  const [isRealizingAll, setIsRealizingAll] = useState(false);
  const [isPayTransferDialogOpen, setIsPayTransferDialogOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedTransferForPayment, setSelectedTransferForPayment] = useState<FamilyTransfer | null>(null);
  const [transferPaymentDate, setTransferPaymentDate] = useState(() => getTodayLocalISO());
  const [transferPaymentBankId, setTransferPaymentBankId] = useState('');
  const [showTransferPaymentBankList, setShowTransferPaymentBankList] = useState(false);
  const [isTransfersExpanded, setIsTransfersExpanded] = useState(false);
  const [lendingPage, setLendingPage] = useState(1);
  const [deletingTransferId, setDeletingTransferId] = useState<string | null>(null);
  const [isDeleteTransferDialogOpen, setIsDeleteTransferDialogOpen] = useState(false);
  const [previewTransfer, setPreviewTransfer] = useState<FamilyTransfer | null>(null);
  const [isPreviewTransferOpen, setIsPreviewTransferOpen] = useState(false);
  const [isExpenseEditDialogOpen, setIsExpenseEditDialogOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  // Consulta despesas recorrentes
  const { data: recurringExpenses = [], isLoading: isLoadingRecurring } = useQuery({
    queryKey: ['recurring_expenses_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select(`*, category:expense_categories(name)`)
        .eq('is_active', true)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses_active'] });
    },
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>('all');
  const [selectedPaymentTarget, setSelectedPaymentTarget] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest' | 'realized' | 'unrealized'>('recent');

  const { currentMember, currentPlan, isAuthenticated } = useAuth();
  const isEssential = isEssentialPlan(currentPlan);
  const { data: members = [] } = useMembers();
  const { data: myBanks = [] } = useBanks(currentMember?.id || undefined);
  const { data: familyTransfers = [] } = useFamilyTransfers(currentMember?.id || undefined);
  const updateTransferStatus = useUpdateFamilyTransferStatus();
  const registerTransferPayment = useRegisterFamilyTransferPayment();
  const deleteTransfer = useDeleteFamilyTransfer();
  const createFamilyTransferRequest = useCreateFamilyTransferRequest();
  const { data: expenses = [], isLoading } = useExpenses(selectedMemberId === 'all' ? undefined : selectedMemberId, currentMonth, currentYear);
  const { data: filterBanks = [] } = useBanks(selectedMemberId === 'all' ? undefined : selectedMemberId);
  const { data: categories = [] } = useExpenseCategories();
  const { data: customExpenseCategories = [] } = useCustomCategories('expense');
  const updateExpense = useUpdateExpense();
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();
  const updateBankBalance = useUpdateBankBalance();
  const deleteIncome = useDeleteIncome();
  const updateCard = useUpdateCard();
  const [expenseTagsMap, setExpenseTagsMap] = useState<Record<string, Array<{ id: string; name: string; color: string }>>>({});

  useEffect(() => {
    const loadExpenseTags = async () => {
      if (!expenses.length) {
        setExpenseTagsMap({});
        return;
      }

      const expenseIds = expenses.map((expense) => expense.id);
      const { data, error } = await supabase
        .from('expense_tags')
        .select('expense_id, tag:custom_tags(id, name, color)')
        .in('expense_id', expenseIds);

      if (error) {
        console.error('Erro ao carregar tags das despesas:', error);
        return;
      }

      const map: Record<string, Array<{ id: string; name: string; color: string }>> = {};
      (data || []).forEach((row: any) => {
        if (!row?.expense_id || !row?.tag) return;
        if (!map[row.expense_id]) map[row.expense_id] = [];
        map[row.expense_id].push({
          id: row.tag.id,
          name: row.tag.name,
          color: row.tag.color,
        });
      });
      setExpenseTagsMap(map);
    };

    loadExpenseTags();
  }, [expenses]);

  function handlePrevMonth() {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }

  function handleNextMonth() {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }

  const filterCards = selectedMemberId === 'all'
    ? allCards
    : allCards.filter((card: any) => card.member_id === selectedMemberId);

  const matchesPaymentFilter = (record: { bank_id?: string | null; card_id?: string | null }) => {
    if (isEssential) return true;
    if (selectedPaymentTarget === 'all') return true;
    const [type, id] = selectedPaymentTarget.split(':');
    if (type === 'bank') return record.bank_id === id;
    if (type === 'card') return record.card_id === id;
    return true;
  };

  const getSelectedPaymentLabel = () => {
    if (selectedPaymentTarget === 'all') return 'Todos';
    const [type, id] = selectedPaymentTarget.split(':');
    if (type === 'bank') return filterBanks.find(bank => bank.id === id)?.name || 'Banco selecionado';
    if (type === 'card') return filterCards.find(card => card.id === id)?.name || 'Cartão selecionado';
    return 'Todos';
  };

  const renderBankSelectorList = (
    bankOptions: any[],
    selectedBankId: string,
    setSelectedBankId: (value: string) => void,
    emptyLabel: string,
  ) => (
    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto rounded-md border border-border bg-background p-1">
      <button
        type="button"
        onClick={() => setSelectedBankId('')}
        className={`flex items-center gap-2 px-3 py-2 rounded text-sm text-left transition-colors ${!selectedBankId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/60 text-muted-foreground'}`}
      >
        {emptyLabel}
      </button>
      {bankOptions.map(bank => {
        const memberName = members.find(m => m.id === bank.member_id)?.name;
        const isSelected = selectedBankId === bank.id;
        return (
          <button
            key={bank.id}
            type="button"
            onClick={() => setSelectedBankId(bank.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded text-sm text-left transition-colors ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/60 text-foreground'}`}
          >
            <span>{bank.name}</span>
            {memberName && (
              <span className="ml-auto shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                {memberName}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const resetMonthFilteredExpenses = expenses.filter((e) =>
    (selectedMemberId === 'all' || e.member_id === selectedMemberId) &&
    matchesPaymentFilter(e)
  );
  const resetMonthInstallments = resetMonthFilteredExpenses.filter(
    (e) => Number(e.total_installments || 0) > 1 && Number(e.installment_number || 0) > 0
  );
  const hasInstallmentsInResetScope = resetMonthInstallments.length > 0;

  const releaseCardLimitForLoan = async (cardId: string | null | undefined, amount: number) => {
    if (!cardId || !Number.isFinite(amount)) return;
    const card = allCards.find(item => item.id === cardId);
    if (!card) return;

    const creditLimit = Number(card.credit_limit ?? 0) || 0;
    const currentUsed = Number(card.used_limit ?? 0) || 0;
    const currentAvailable = Number(
      card.available_limit ?? (creditLimit - currentUsed)
    ) || 0;
    const nextUsed = currentUsed - amount;
    const nextAvailable = currentAvailable + amount;

    await updateCard.mutateAsync({
      id: card.id,
      used_limit: nextUsed,
      available_limit: nextAvailable,
    });
  };

  async function handleRealizeAll() {
    setIsRealizingAll(true);
    try {
      // Filtra despesas não realizadas do membro selecionado
      const filteredExpenses = expenses.filter(e => !e.is_realized
        && (selectedMemberId === 'all' || e.member_id === selectedMemberId)
        && matchesPaymentFilter(e));
      // Filtra recorrentes ativas do membro selecionado
      const filteredRecurring = recurringExpenses.filter(r => r.is_active
        && (selectedMemberId === 'all' || r.member_id === selectedMemberId)
        && matchesPaymentFilter(r));
      // Realiza despesas normais
      for (const expense of filteredExpenses) {
        await updateExpense.mutateAsync({ id: expense.id, is_realized: true, date: realizeAllDate });
        if (expense.lend_card && !expense.is_realized) {
          await releaseCardLimitForLoan(expense.card_id, Number(expense.amount) || 0);
        }
        // Saldo do banco atualizado automaticamente por trigger
        // if (realizeAllBankId && expense.bank_id) {
        //   const bank = banks.find(b => b.id === realizeAllBankId);
        //   if (bank) {
        //     const amount = -Number(expense.amount);
        //     await updateBankBalance.mutateAsync({ bank_id: realizeAllBankId, amount });
        //   }
        // }
      }
      // Realiza recorrentes (cria expense para cada uma)
      for (const rec of filteredRecurring) {
        const recurringRecord = rec as RecurringExpense & { bank_id?: string | null; lend_card?: boolean; lend_to?: string | null; };
        await createExpense.mutateAsync({
          member_id: recurringRecord.member_id,
          category_id: recurringRecord.category_id,
          custom_category_id: recurringRecord.custom_category_id,
          card_id: recurringRecord.card_id,
          bank_id: realizeAllBankId || recurringRecord.bank_id,
          amount: recurringRecord.amount,
          description: recurringRecord.description,
          date: realizeAllDate,
          is_recurring: false,
          lend_card: recurringRecord.lend_card,
          lend_to: recurringRecord.lend_to,
          total_installments: recurringRecord.total_installments,
        });
        // Saldo do banco atualizado automaticamente por trigger
        // if (realizeAllBankId) {
        //   const bank = banks.find(b => b.id === realizeAllBankId);
        //   if (bank) {
        //     const amount = -Number(recurringRecord.amount);
        //     await updateBankBalance.mutateAsync({ bank_id: realizeAllBankId, amount });
        //   }
        // }
      }
      setIsRealizeAllDialogOpen(false);
    } finally {
      setIsRealizingAll(false);
    }
  }

  async function handleResetMonth() {
    setIsResettingMonth(true);
    try {
      const idsToDelete = new Set<string>();

      if (hasInstallmentsInResetScope && resetInstallmentAction === 'keep-installments') {
        // Keep all installment rows (including current month) and remove only non-installments.
        const nonInstallments = resetMonthFilteredExpenses.filter(
          (e) => Number(e.total_installments || 0) <= 1
        );
        for (const expense of nonInstallments) {
          idsToDelete.add(expense.id);
        }
      } else {
        // Default reset behavior for the month scope: remove everything in scope.
        for (const expense of resetMonthFilteredExpenses) {
          idsToDelete.add(expense.id);
        }

        // Optional cascade: also remove future installments from installment series.
        if (hasInstallmentsInResetScope && resetInstallmentAction === 'delete-future') {
          for (const installmentExpense of resetMonthInstallments) {
            const futureIds = await findFutureInstallmentIds(installmentExpense);
            for (const id of futureIds) idsToDelete.add(id);
          }
        }
      }

      for (const id of idsToDelete) {
        await deleteExpense.mutateAsync(id);
      }

      if (hasInstallmentsInResetScope && resetInstallmentAction === 'delete-future') {
        const removedCurrentMonthCount = resetMonthFilteredExpenses.filter((e) => idsToDelete.has(e.id)).length;
        const removedFutureCount = idsToDelete.size - removedCurrentMonthCount;
        toast.success(`Mês resetado com sucesso. ${removedCurrentMonthCount} saída(s) do mês e ${removedFutureCount} parcela(s) futura(s) removida(s).`);
      } else if (hasInstallmentsInResetScope && resetInstallmentAction === 'keep-installments') {
        toast.success(`Mês resetado com manutenção de parcelamentos. ${idsToDelete.size} saída(s) não parcelada(s) removida(s).`);
      } else {
        toast.success(`Mês resetado com sucesso. ${idsToDelete.size} saída(s) removida(s).`);
      }

      setIsResetMonthDialogOpen(false);
    } catch (error) {
      console.error('Erro ao resetar mês:', error);
      toast.error('Erro ao resetar mês. Tente novamente.');
    } finally {
      setIsResettingMonth(false);
    }
  }

  function toLocalISO(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function findFutureInstallmentIds(expense: Expense) {
    const currentInstallment = Number(expense.installment_number || 0);
    const totalInstallments = Number(expense.total_installments || 0);

    if (totalInstallments <= 1 || currentInstallment <= 0 || currentInstallment >= totalInstallments) {
      return [] as string[];
    }

    // Build a restrictive query to ensure we only get the exact series
    let query = supabase
      .from('expenses')
      .select('id')
      .eq('member_id', expense.member_id)
      .eq('total_installments', totalInstallments)
      .gt('installment_number', currentInstallment)
      .neq('id', expense.id);

    // Filter by recurring_id (primary grouping)
    if (expense.recurring_id) {
      query = query.eq('recurring_id', expense.recurring_id);
    } else {
      const baseDescription = (expense.description || '').replace(/\s*\(\d+\/\d+\)$/, '').trim();
      query = query.eq('amount', Number(expense.amount || 0));
      if (expense.category_id) {
        query = query.eq('category_id', expense.category_id);
      } else {
        query = query.is('category_id', null);
      }
      if (expense.custom_category_id) {
        query = query.eq('custom_category_id', expense.custom_category_id);
      } else {
        query = query.is('custom_category_id', null);
      }
      if (baseDescription) {
        query = query.ilike('description', `${baseDescription} (%/%)`);
      }
    }

    // Filter by payment method to avoid cross-contamination
    if (expense.card_id) {
      query = query.eq('card_id', expense.card_id);
    } else if (expense.bank_id) {
      query = query.eq('bank_id', expense.bank_id);
    } else {
      query = query.is('card_id', null).is('bank_id', null);
    }

    const { data, error } = await query.order('installment_number', { ascending: true });

    if (error) {
      console.error('Erro ao buscar parcelas futuras:', error);
      return [];
    }

    return (data || []).map((row) => row.id);
  }

  const renderRealizeDialog = () => (
    <Dialog open={isRealizeDialogOpen} onOpenChange={open => {
      setIsRealizeDialogOpen(open);
      if (!open) setRealizingExpense(null);
    }}>
      <DialogContent aria-describedby="realizar-desc">
        <DialogHeader>
          <DialogTitle>Realizar Despesa</DialogTitle>
        </DialogHeader>
        {realizingExpense && (
          <div className="space-y-4">
            <p id="realizar-desc">
              Confirma a realização da despesa <b>{realizingExpense.description}</b> no valor de <b>R$ {Number(realizingExpense.amount).toFixed(2)}</b>?
            </p>
            <label className="block text-sm font-medium">Selecione a data de realização:</label>
            <input
              type="date"
              className="input w-full bg-background text-foreground border border-border"
              value={realizeDate}
              onChange={e => setRealizeDate(e.target.value)}
              max={getTodayLocalISO()}
            />
            {!isEssential && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const next = !showRealizeBankList;
                    setShowRealizeBankList(next);
                    if (!next) {
                      setRealizingExpense({ ...realizingExpense, _realizeBankId: '' });
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors w-full mt-2 ${
                    showRealizeBankList
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                  }`}
                >
                  <span className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors ${showRealizeBankList ? 'bg-primary border-primary' : 'bg-muted-foreground/30 border-transparent'}`}>
                    <span className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${showRealizeBankList ? 'translate-x-3' : 'translate-x-0'}`} />
                  </span>
                  Deduzir do banco
                </button>
                {showRealizeBankList && (
                  <div className="space-y-2 mt-2">
                    <label className="block text-sm font-medium">Selecione o banco para deduzir:</label>
                    {renderBankSelectorList(
                      banks,
                      realizingExpense._realizeBankId || '',
                      (value) => setRealizingExpense({ ...realizingExpense, _realizeBankId: value }),
                      'Não deduzir saldo'
                    )}
                  </div>
                )}
              </>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setIsRealizeDialogOpen(false)}>Cancelar</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={async () => {
                  if (!realizingExpense?.id) {
                    alert('Despesa inválida. Tente novamente.');
                    return;
                  }
                  // Se for recorrente, criar despesa nova
                  if (realizingExpense.is_active !== undefined) {
                    await createExpense.mutateAsync({
                      member_id: realizingExpense.member_id,
                      category_id: realizingExpense.category_id,
                      custom_category_id: realizingExpense.custom_category_id,
                      card_id: realizingExpense.card_id,
                      bank_id: realizingExpense._realizeBankId || realizingExpense.bank_id || undefined,
                      amount: realizingExpense.amount,
                      description: realizingExpense.description,
                      date: realizeDate,
                      is_recurring: true,
                      total_installments: realizingExpense.total_installments,
                      lend_card: realizingExpense.lend_card,
                      lend_to: realizingExpense.lend_to,
                      lend_card_family_public_id: realizingExpense.lend_card_family_public_id || null,
                      lend_money: realizingExpense.lend_money,
                      lend_money_to: realizingExpense.lend_money_to || null,
                    });
                  } else {
                    // Atualiza despesa como realizada e salva o banco selecionado
                    const updated = await updateExpense.mutateAsync({
                      id: realizingExpense.id,
                      is_realized: true,
                      date: realizeDate,
                      bank_id: realizingExpense._realizeBankId || undefined,
                    });
                    if (realizingExpense.lend_card && !realizingExpense.is_realized) {
                      await releaseCardLimitForLoan(realizingExpense.card_id, Number(realizingExpense.amount) || 0);
                    }
                    await createCardTransferOnRealize((updated || realizingExpense) as Expense, realizeDate);
                  }
                  // Deduz do banco se selecionado
                  // Saldo do banco atualizado automaticamente por trigger
                  // if (realizingExpense._realizeBankId) {
                  //   const bank = banks.find(b => b.id === realizingExpense._realizeBankId);
                  //   if (bank) {
                  //     const amount = -Number(realizingExpense.amount);
                  //     await updateBankBalance.mutateAsync({ bank_id: realizingExpense._realizeBankId, amount });
                  //   }
                  // }
                  setIsRealizeDialogOpen(false);
                  setRealizingExpense(null);
                }}
                disabled={updateExpense.isPending}
              >{updateExpense.isPending ? 'Salvando...' : 'Confirmar'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  if (!isAuthenticated) {
    return (
      <>
        <MainLayout>
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <TrendingDown className="w-16 h-16 text-expense mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Registre suas Saídas
            </h1>
            <p className="text-muted-foreground mb-6">
              Faça login para registrar suas despesas
            </p>
            <Button onClick={() => navigate('/members')}>
              Ir para Membros
            </Button>
          </div>
        </MainLayout>
              onClick={() => {
                setResetInstallmentAction('delete-future');
                setIsResetMonthDialogOpen(true);
              }}
      </>
    );
  }

  // Função utilitária para buscar o primeiro nome do membro
  const getMemberFirstName = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return '';
    return member.name.split(' ')[0];
  };

  // Função utilitária para buscar a categoria pelo id
  function getCategory(categoryId?: string | null, customCategoryId?: string | null) {
    if (customCategoryId) {
      return customExpenseCategories.find(c => c.id === customCategoryId) || null;
    }
    if (categoryId) {
      return categories.find(c => c.id === categoryId) || null;
    }
    return null;
  }

  const isTransferInCurrentMonth = (transfer: FamilyTransfer) => {
    const referenceDate =
      transfer.status === 'payment_received'
        ? (transfer.payment_date || transfer.requested_date)
        : transfer.status === 'rejected'
          ? (transfer.rejected_at || transfer.requested_date)
          : transfer.requested_date;
    const date = new Date(referenceDate || transfer.created_at);
    return date.getMonth() + 1 === currentMonth && date.getFullYear() === currentYear;
  };

  const shouldShowTransfer = (transfer: FamilyTransfer) => {
    if (transfer.status === 'pending_confirmation' || transfer.status === 'confirmed_waiting_payment') {
      return true;
    }
    return isTransferInCurrentMonth(transfer);
  };

  const incomingPendingTransfers = familyTransfers.filter(
    (transfer) =>
      transfer.debtor_member_id === currentMember?.id &&
      transfer.status === 'pending_confirmation',
  );

  const incomingConfirmedTransfers = familyTransfers.filter(
    (transfer) =>
      transfer.debtor_member_id === currentMember?.id &&
      transfer.status === 'confirmed_waiting_payment',
  );

  const outgoingTransfers = familyTransfers.filter(
    (transfer) =>
      transfer.creditor_member_id === currentMember?.id &&
      shouldShowTransfer(transfer),
  );

  const expenseTransferMap = new Map<string, FamilyTransfer>();
  familyTransfers.forEach((transfer) => {
    if (transfer.creditor_expense_id) {
      expenseTransferMap.set(transfer.creditor_expense_id, transfer);
    }
    if (transfer.debtor_expense_id) {
      expenseTransferMap.set(transfer.debtor_expense_id, transfer);
    }
  });

  console.log('[ExpensesPage] Family transfers:', {
    total: familyTransfers.length,
    incomingPending: incomingPendingTransfers.length,
    incomingConfirmed: incomingConfirmedTransfers.length,
    outgoing: outgoingTransfers.length,
    expenseTransferMapSize: expenseTransferMap.size,
    currentMemberId: currentMember?.id,
  });

  // Mapear IDs de despesas que são empréstimos (para excluir da lista normal)
  const lendingExpenseIds = new Set<string>();
  familyTransfers.forEach((transfer) => {
    if (transfer.creditor_expense_id) {
      lendingExpenseIds.add(transfer.creditor_expense_id);
    }
  });
  
  // Despesas de cartão emprestadas também vão pro card de empréstimos
  const cardLendingExpenses = expenses.filter(e => e.lend_card && e.lend_to);
  const cardLendingExpensesWithoutTransfer = cardLendingExpenses.filter(
    (expense) => !expenseTransferMap.has(expense.id),
  );
  cardLendingExpenses.forEach((e) => {
    lendingExpenseIds.add(e.id);
  });

  // Empréstimos de banco sem transfer também vão pro card de empréstimos
  const bankLendingExpenses = expenses.filter(e => e.lend_money && !expenseTransferMap.has(e.id));
  bankLendingExpenses.forEach((e) => {
    lendingExpenseIds.add(e.id);
  });

  const lendingItems = [
    ...outgoingTransfers.map((transfer) => ({ type: 'transfer' as const, transfer })),
    ...cardLendingExpensesWithoutTransfer.map((expense) => ({ type: 'expense' as const, expense, loanType: 'card' as const })),
    ...bankLendingExpenses.map((expense) => ({ type: 'expense' as const, expense, loanType: 'bank' as const })),
  ];

  const lendingFilteredItems = lendingItems.filter((item) => {
    if (selectedMemberId && selectedMemberId !== 'all') {
      if (item.type === 'transfer' && item.transfer.creditor_member_id !== selectedMemberId) return false;
      if (item.type === 'expense' && item.expense.member_id !== selectedMemberId) return false;
    }

    if (item.type === 'transfer' && !shouldShowTransfer(item.transfer)) return false;

    const paymentRecord = item.type === 'transfer'
      ? { bank_id: item.transfer.creditor_bank_id || null, card_id: null }
      : { bank_id: item.expense.bank_id || null, card_id: item.expense.card_id || null };
    if (!matchesPaymentFilter(paymentRecord)) return false;

    if (searchText) {
      const searchLower = searchText.toLowerCase();
      const description = item.type === 'transfer' ? item.transfer.description : item.expense.description;
      const amount = item.type === 'transfer' ? item.transfer.amount : item.expense.amount;
      const matchesDescription = description.toLowerCase().includes(searchLower);
      const matchesAmount = Number(amount).toFixed(2).includes(searchText);
      if (!matchesDescription && !matchesAmount) return false;
    }

    if (sortOrder === 'realized') {
      if (item.type === 'transfer') return item.transfer.status === 'payment_received';
      return item.expense.is_realized;
    }
    if (sortOrder === 'unrealized') {
      if (item.type === 'transfer') return item.transfer.status !== 'payment_received';
      return !item.expense.is_realized;
    }

    return true;
  });

  const sortedLendingItems = [...lendingFilteredItems].sort((a, b) => {
    const getDate = (item: typeof lendingItems[number]) => {
      if (item.type === 'transfer') {
        return new Date(item.transfer.payment_date || item.transfer.requested_date || item.transfer.created_at).getTime();
      }
      return new Date(item.expense.realized_date || item.expense.date).getTime();
    };
    const dateA = getDate(a);
    const dateB = getDate(b);
    if (sortOrder === 'realized' || sortOrder === 'unrealized') {
      return dateB - dateA;
    }
    return sortOrder === 'recent' ? dateB - dateA : dateA - dateB;
  });

  const lendingPerPage = 3;
  const lendingTotalPages = Math.max(1, Math.ceil(sortedLendingItems.length / lendingPerPage));
  const lendingPageSafe = Math.min(lendingPage, lendingTotalPages);
  const lendingStart = (lendingPageSafe - 1) * lendingPerPage;
  const lendingPageItems = sortedLendingItems.slice(lendingStart, lendingStart + lendingPerPage);

  useEffect(() => {
    setLendingPage(1);
  }, [outgoingTransfers.length, cardLendingExpenses.length, selectedMemberId, selectedPaymentTarget, searchText, sortOrder]);

  const getTransferStatusLabel = (status: string) => {
    if (status === 'pending_confirmation') return 'Pendente de confirmação';
    if (status === 'confirmed_waiting_payment') return 'Confirmado, aguardando pagamento';
    if (status === 'payment_received') return 'Pagamento recebido';
    if (status === 'rejected') return 'Recusado';
    return status;
  };

  const getTransferStatusClass = (status: string) => {
    if (status === 'pending_confirmation') return 'bg-yellow-100 text-yellow-700';
    if (status === 'confirmed_waiting_payment') return 'bg-blue-100 text-blue-700';
    if (status === 'payment_received') return 'bg-green-100 text-green-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    return 'bg-secondary text-foreground';
  };

  const handleConfirmTransfer = async (transferId: string) => {
    try {
      await updateTransferStatus.mutateAsync({
        transferId,
        status: 'confirmed_waiting_payment',
      });
      toast.success('Cobrança confirmada com sucesso.');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao confirmar cobrança.');
    }
  };

  const handleRejectTransfer = async (transferId: string) => {
    try {
      await updateTransferStatus.mutateAsync({
        transferId,
        status: 'rejected',
      });
      toast.success('Cobrança recusada.');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao recusar cobrança.');
    }
  };

  const handleResendTransfer = async (transferId: string) => {
    try {
      await updateTransferStatus.mutateAsync({
        transferId,
        status: 'pending_confirmation',
      });
      toast.success('Cobrança reenviada.');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao reenviar cobrança.');
    }
  };

  const createCardTransferOnRealize = async (expense: Expense, requestedDate: string) => {
    if (!expense.lend_card || !expense.lend_card_family_public_id?.trim()) return;
    if (expenseTransferMap.has(expense.id)) return;

    try {
      const recipient = await resolveFamilyTransferRecipient(expense.lend_card_family_public_id);
      if (!recipient) {
        toast.error('ID da família inválido.');
        return;
      }

      if (recipient.member_id === expense.member_id) {
        toast.error('Você não pode lançar cobrança para o próprio membro.');
        return;
      }

      await createFamilyTransferRequest.mutateAsync({
        creditor_member_id: expense.member_id,
        debtor_member_id: recipient.member_id,
        creditor_name: currentMember?.name || undefined,
        debtor_name: recipient.member_name,
        creditor_expense_id: expense.id,
        creditor_bank_id: (expense as any)._realizeBankId || expense.bank_id || undefined,
        amount: expense.amount,
        description: expense.description,
        requested_date: requestedDate,
      });

      toast.success('Cobrança enviada para a família.');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao enviar cobrança.');
    }
  };

  const handleOpenPayTransferDialog = (transfer: FamilyTransfer) => {
    setSelectedTransferForPayment(transfer);
    setTransferPaymentDate(getTodayLocalISO());
    setTransferPaymentBankId('');
    setShowTransferPaymentBankList(false);
    setIsPayTransferDialogOpen(true);
  };

  const handleRegisterTransferPayment = async () => {
    if (!selectedTransferForPayment) return;

    if (!transferPaymentBankId) {
      toast.error('Selecione o banco que será debitado.');
      return;
    }

    try {
      await registerTransferPayment.mutateAsync({
        transfer: selectedTransferForPayment,
        paymentDate: transferPaymentDate,
        paymentBankId: transferPaymentBankId,
      });

      toast.success('Pagamento registrado e entrada criada para quem cobrou.');
      setIsPayTransferDialogOpen(false);
      setSelectedTransferForPayment(null);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao registrar pagamento.');
    }
  };

  const handleDeleteTransfer = async () => {
    if (!deletingTransferId) return;

    try {
      const transferToDelete = familyTransfers.find((transfer) => transfer.id === deletingTransferId);
      if (transferToDelete?.creditor_expense_id) {
        await deleteExpense.mutateAsync(transferToDelete.creditor_expense_id);
      }
      if (transferToDelete?.debtor_expense_id) {
        await deleteExpense.mutateAsync(transferToDelete.debtor_expense_id);
      }
      if (transferToDelete?.creditor_income_id) {
        await deleteIncome.mutateAsync(transferToDelete.creditor_income_id);
      }
      await deleteTransfer.mutateAsync(deletingTransferId);
      toast.success('Transferência deletada com sucesso.');
      setIsDeleteTransferDialogOpen(false);
      setDeletingTransferId(null);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao deletar transferência.');
    }
  };

  // Soma despesas realizadas + recorrentes ativas do mês/ano/membro
  const recurringTotal = recurringExpenses
    .filter(r => {
      const isSameMonth = new Date(r.start_date).getMonth() + 1 === currentMonth;
      const isSameYear = new Date(r.start_date).getFullYear() === currentYear;
      const isMember = !selectedMemberId || selectedMemberId === 'all' || r.member_id === selectedMemberId;
      return r.is_active && isSameMonth && isSameYear && isMember;
    })
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const totalExpenses = expenses.filter(e => e.is_realized).reduce((sum, e) => sum + Number(e.amount), 0) + recurringTotal;

  // Paginação e filtro de ordenação das despesas
  const perPage = 10;
  
  // Aplicar ordenação aos dados (excluir despesas que são empréstimos)
  const paymentFilteredExpenses = expenses
    .filter(e => !lendingExpenseIds.has(e.id))
    .filter(e => matchesPaymentFilter(e));
  const searchFilteredExpenses = paymentFilteredExpenses.filter(e => {
    const searchLower = searchText.toLowerCase();
    const matchesDescription = e.description.toLowerCase().includes(searchLower);
    const matchesAmount = Number(e.amount).toFixed(2).includes(searchText);
    return matchesDescription || matchesAmount;
  });
  const statusFilteredExpenses = searchFilteredExpenses.filter(e => {
    if (sortOrder === 'realized') return e.is_realized;
    if (sortOrder === 'unrealized') return !e.is_realized;
    return true;
  });
  const sortedExpenses = [...statusFilteredExpenses].sort((a, b) => {
    if (sortOrder === 'realized' || sortOrder === 'unrealized') {
      const dateA = new Date(a.realized_date || a.date).getTime();
      const dateB = new Date(b.realized_date || b.date).getTime();
      return dateB - dateA;
    }
    const dateA = new Date(a.realized_date || a.date).getTime();
    const dateB = new Date(b.realized_date || b.date).getTime();
    return sortOrder === 'recent' ? dateB - dateA : dateA - dateB;
  });
  
  const totalPages = Math.ceil(sortedExpenses.length / perPage);
  const paginatedExpenses = sortedExpenses.slice(
    (page - 1) * perPage,
    page * perPage
  );
  
  // Calcular total de despesas (considerar todas as despesas filtradas, não apenas a página atual)
  const totalSearchAmount = sortedExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  useEffect(() => {
    setPage(1);
    setSelectedPaymentTarget('all');
  }, [currentMonth, currentYear, selectedMemberId]);

  useEffect(() => {
    setPage(1);
  }, [searchText]);

  return (
    <>
      <MainLayout>
        <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Desktop Header */}
          <div className="hidden sm:flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                Saídas
              </h1>
              <p className="text-muted-foreground">
                Gerencie suas despesas e compras parceladas
              </p>
            </div>
          </div>
          {/* Mobile Header Box */}
          <div className="sm:hidden flex flex-col items-center gap-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 rounded-xl p-4 border border-red-200 dark:border-red-800 shadow-sm w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                Saídas
              </h1>
            </div>
            <p className="text-muted-foreground text-center text-sm">
              Gerencie suas despesas e compras parceladas
            </p>
          </div>

          <div className="flex w-full sm:w-auto flex-col sm:flex-row sm:items-center gap-3">
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

            <div className="flex w-full justify-end flex-wrap gap-2">
              <Dialog open={isRecurringDialogOpen} onOpenChange={setIsRecurringDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2 w-full sm:w-auto">
                    <RotateCcw className="w-4 h-4" />
                    Recorrentes
                  </Button>
                </DialogTrigger>
                  <DialogContent className="max-w-2xl" aria-describedby="recorrentes-desc">
                    <DialogHeader>
                      <DialogTitle>Despesas Recorrentes</DialogTitle>
                      <div id="recorrentes-desc" className="text-muted-foreground text-xs">Controle quais recorrentes deduzem do limite do cartão e selecione o cartão relacionado.</div>
                    </DialogHeader>
                  {isLoadingRecurring ? (
                    <div className="p-8 text-center">Carregando...</div>
                  ) : recurringExpenses.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">Nenhuma despesa recorrente cadastrada.</div>
                  ) : (
                    <div className="space-y-3 max-h-[60vh] overflow-auto">
                      {recurringExpenses.map((item: any) => {
                        // Filtra cartões do membro do recorrente
                        const cards = allCards.filter((c: any) => c.member_id === item.member_id);
                        const category = getCategory(item.category_id, item.custom_category_id);
                        return (
                          <div key={item.id} className="flex flex-col gap-2 bg-muted rounded-lg p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div>
                                <div className="font-semibold text-foreground flex items-center gap-2">
                                  {item.description}
                                  {item.lend_card && item.lend_to && (
                                    <span className="ml-2 px-2 py-0.5 rounded-full bg-yellow-200 text-yellow-800 text-xs font-semibold">
                                      Emprestado: {item.lend_to}
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">{category?.name}</div>
                                <div className="text-xs text-muted-foreground">Início: {item.start_date && new Date(item.start_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                              </div>
                              <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-2">
                                <span className="font-bold text-red-600 text-base sm:text-sm">R$ {Number(item.amount).toFixed(2)}</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2.5 text-xs"
                                  title="Realizar"
                                  onClick={() => {
                                    setRealizingExpense(item);
                                    setRealizeDate(getTodayLocalISO());
                                    setIsRealizeDialogOpen(true);
                                  }}
                                  aria-label="Realizar"
                                >
                                  Realizar
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setRecurringDeleteId(item.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {/* Dialog de exclusão recorrente */}
                      <Dialog open={!!recurringDeleteId} onOpenChange={open => { if (!open) setRecurringDeleteId(null); }}>
                        <DialogContent aria-describedby="recorrente-delete-desc">
                          <DialogHeader>
                            <DialogTitle>Excluir recorrente?</DialogTitle>
                            <span id="recorrente-delete-desc" className="sr-only">Confirmação de exclusão de recorrente</span>
                          </DialogHeader>
                          <div className="space-y-4">
                            <p>Tem certeza que deseja excluir a despesa recorrente <b>{recurringExpenses.find((r: any) => r.id === recurringDeleteId)?.description}</b>?</p>
                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" onClick={() => setRecurringDeleteId(null)} autoFocus={false}>Cancelar</Button>
                              <Button variant="destructive" onClick={async () => {
                                if (recurringDeleteId) {
                                  await deleteMutation.mutateAsync(recurringDeleteId);
                                  setRecurringDeleteId(null);
                                }
                              }}>
                                Excluir
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-expense text-expense-foreground w-full sm:w-auto">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Saída
                  </Button>
                </DialogTrigger>
                <DialogContent aria-describedby="add-expense-desc">
                  <span id="add-expense-desc" className="sr-only">Formulário para adicionar nova despesa</span>
                  <DialogHeader>
                    <DialogTitle className="whitespace-nowrap text-base sm:text-lg leading-none pr-2 shrink-0">
                        {addExpenseMode === 'simple' ? 'Registrar Despesa Simples' : 'Registrar Despesa'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 mb-3">
                    <Label>Modo de lançamento</Label>
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/70 bg-muted/20 p-1">
                      <button
                        type="button"
                        onClick={() => setAddExpenseMode('full')}
                        className={`h-9 rounded-md text-sm font-medium transition-colors ${
                          addExpenseMode === 'full'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                        }`}
                      >
                        Completo
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddExpenseMode('simple')}
                        className={`h-9 rounded-md text-sm font-medium transition-colors ${
                          addExpenseMode === 'simple'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                        }`}
                      >
                        Simples
                      </button>
                    </div>
                  </div>
                  <ExpenseForm
                    simpleMode={addExpenseMode === 'simple'}
                    onSuccess={() => {
                      setIsAddDialogOpen(false);
                      setAddExpenseMode('full');
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Total Card */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 w-full sm:w-auto text-center sm:text-left">
              <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total do Mês</p>
                <p className="text-2xl font-bold text-expense">{formatCurrency(totalExpenses)}</p>
              </div>

            </div>
            <div className="w-full flex flex-col gap-2">
              <div className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-2 text-xs">
                <Label className="text-xs text-right">Filtrar por membro</Label>
                <Select
                  value={selectedMemberId ?? 'all'}
                  onValueChange={value => setSelectedMemberId(value === 'all' ? undefined : value)}
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="Todos os membros" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os membros</SelectItem>
                    {members.map(member => (
                      <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isEssential && (
                <div className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-2 text-xs">
                  <Label className="text-xs text-right">Banco/cartão</Label>
                  <Select value={selectedPaymentTarget} onValueChange={setSelectedPaymentTarget}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {filterBanks.map(bank => (
                        <SelectItem key={`bank-${bank.id}`} value={`bank:${bank.id}`}>Banco: {bank.name}</SelectItem>
                      ))}
                      {filterCards.map(card => (
                        <SelectItem key={`card-${card.id}`} value={`card:${card.id}`}>Cartão: {card.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-2 text-xs">
                <Label className="text-xs text-right">Ordenação</Label>
                <Select value={sortOrder} onValueChange={(value) => {
                  setSortOrder(value as 'recent' | 'oldest' | 'realized' | 'unrealized');
                  setPage(1);
                }}>
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Mais recentes</SelectItem>
                    <SelectItem value="oldest">Mais antigas</SelectItem>
                    <SelectItem value="realized">Realizadas</SelectItem>
                    <SelectItem value="unrealized">Não Realizadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-2 text-xs">
                <Label className="text-xs text-right">Pesquisar</Label>
                <input
                  type="text"
                  placeholder="Título ou valor..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-xs placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

            </div>
          </div>
        </div>

        {(incomingPendingTransfers.length > 0 || incomingConfirmedTransfers.length > 0 || outgoingTransfers.length > 0 || cardLendingExpenses.length > 0) && (
          <div>
            {/* Cards grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* ...existing code... */}
            </div>
            <div className="flex items-center justify-center mt-2 mb-4 gap-1 cursor-pointer select-none" onClick={() => setIsTransfersExpanded(!isTransfersExpanded)}>
              <span className="text-xs text-muted-foreground">{isTransfersExpanded ? 'Clique para recolher' : 'Clique para expandir'}</span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isTransfersExpanded ? 'rotate-180' : ''}`} />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Cobranças Recebidas */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-2xl p-4 space-y-3 border border-blue-200 dark:border-blue-800 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground text-left">Cobranças recebidas</h3>
                </div>

                {incomingPendingTransfers.length === 0 && incomingConfirmedTransfers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma cobrança recebida no momento.</p>
                ) : !isTransfersExpanded ? null : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {incomingPendingTransfers.map((transfer) => (
                      <div key={transfer.id} className="rounded-lg bg-white/80 dark:bg-black/20 border border-blue-200 dark:border-blue-700 p-3 space-y-2 backdrop-blur-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{transfer.description}</p>
                          <span className="text-sm font-bold text-red-600">{formatCurrency(Number(transfer.amount))}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          De: {transfer.creditor?.name || transfer.creditor_name || members.find((m) => m.id === transfer.creditor_member_id)?.name || 'Usuário'}
                        </p>
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => void handleRejectTransfer(transfer.id)}
                              disabled={updateTransferStatus.isPending}
                            >
                              Recusar
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => void handleConfirmTransfer(transfer.id)}
                              disabled={updateTransferStatus.isPending}
                            >
                              Confirmar
                            </Button>
                          </div>
                          <button
                            onClick={() => {
                              setDeletingTransferId(transfer.id);
                              setIsDeleteTransferDialogOpen(true);
                            }}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}

                    {incomingConfirmedTransfers.map((transfer) => (
                      <div key={transfer.id} className="rounded-lg bg-white/80 dark:bg-black/20 border border-green-200 dark:border-green-700 p-3 space-y-2 backdrop-blur-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{transfer.description}</p>
                          <span className="text-sm font-bold text-red-600">{formatCurrency(Number(transfer.amount))}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Status: {getTransferStatusLabel(transfer.status)}
                        </p>
                        <div className="flex justify-between items-center gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleOpenPayTransferDialog(transfer)}
                            disabled={registerTransferPayment.isPending}
                          >
                            Registrar pagamento
                          </Button>
                          <button
                            onClick={() => {
                              setDeletingTransferId(transfer.id);
                              setIsDeleteTransferDialogOpen(true);
                            }}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Meus Empréstimos */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 rounded-2xl p-4 space-y-3 border border-amber-200 dark:border-amber-800 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Meus empréstimos (enviados)</h3>
                </div>

                {sortedLendingItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Você ainda não enviou cobranças ou empréstimos.</p>
                ) : !isTransfersExpanded ? null : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {lendingPageItems.map((item) => {
                      if (item.type === 'transfer') {
                        const transfer = item.transfer;
                        return (
                          <div key={`transfer-${transfer.id}`} className="rounded-lg bg-white/80 dark:bg-black/20 border border-amber-200 dark:border-amber-700 p-3 backdrop-blur-sm">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground truncate">{transfer.description}</p>
                              <span className="text-sm font-bold text-green-600">{formatCurrency(Number(transfer.amount))}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              Para: {transfer.debtor?.name || transfer.debtor_name || members.find((m) => m.id === transfer.debtor_member_id)?.name || 'Usuário'}
                            </p>
                            <div className="mt-2 flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', getTransferStatusClass(transfer.status))}>
                                  {getTransferStatusLabel(transfer.status)}
                                </span>
                                {transfer.status === 'rejected' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => void handleResendTransfer(transfer.id)}
                                    disabled={updateTransferStatus.isPending}
                                  >
                                    Reenviar
                                  </Button>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setPreviewTransfer(transfer);
                                    setIsPreviewTransferOpen(true);
                                  }}
                                  className="p-1 hover:bg-muted rounded text-muted-foreground transition"
                                  aria-label="Visualizar"
                                  title="Visualizar"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setDeletingTransferId(transfer.id);
                                    setIsDeleteTransferDialogOpen(true);
                                  }}
                                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 transition"
                                  aria-label="Excluir"
                                  title="Excluir"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      const expense = item.expense;
                      return (
                        <div key={`card-${expense.id}`} className="rounded-lg bg-white/80 dark:bg-black/20 border border-amber-200 dark:border-amber-700 p-3 backdrop-blur-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{expense.description}</p>
                            <span className="text-sm font-bold text-green-600">{formatCurrency(Number(expense.amount))}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            Para: {expense.lend_to || expense.lend_money_to || 'Não especificado'}
                          </p>
                          <div className="mt-2 flex justify-between items-center gap-2">
                            <div className="flex items-center gap-2">
                              {!expense.is_realized && (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setRealizingExpense(expense);
                                    setRealizeDate(getTodayLocalISO());
                                    setIsRealizeDialogOpen(true);
                                  }}
                                >
                                  Realizar
                                </Button>
                              )}
                              {expense.is_realized && (
                                <span className="text-xs font-semibold text-green-600">Realizado</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setExpenseToEdit(expense);
                                  setIsExpenseEditDialogOpen(true);
                                }}
                                className="p-1 hover:bg-muted rounded text-muted-foreground transition"
                                aria-label="Editar"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingExpense(expense);
                                  setIsEditDialogOpen(true);
                                }}
                                className="p-1 hover:bg-muted rounded text-muted-foreground transition"
                                aria-label="Visualizar"
                                title="Visualizar"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingExpense(expense);
                                  setIsDeleteDialogOpen(true);
                                }}
                                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 transition"
                                aria-label="Excluir"
                                title="Excluir"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {lendingTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setLendingPage((p) => Math.max(1, p - 1))}
                          disabled={lendingPageSafe === 1}
                        >
                          Anterior
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Página {lendingPageSafe} de {lendingTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setLendingPage((p) => Math.min(lendingTotalPages, p + 1))}
                          disabled={lendingPageSafe === lendingTotalPages}
                        >
                          Próxima
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end mt-4 gap-2">
          <Button
            variant="outline"
            className="font-semibold px-3 py-1.5 rounded-md shadow text-xs min-h-8"
            onClick={() => setIsResetMonthDialogOpen(true)}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Resetar Mês
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1.5 rounded-md shadow text-xs min-h-8"
            onClick={() => setIsRealizeAllDialogOpen(true)}
          >
            Realizar Todos
          </Button>
        </div>

        {/* Modal Realizar Todos */}
        <Dialog open={isRealizeAllDialogOpen} onOpenChange={setIsRealizeAllDialogOpen}>
          <DialogContent aria-describedby="realize-all-desc">
            <span id="realize-all-desc" className="sr-only">Confirmação de realização de todas as despesas</span>
            <DialogHeader>
              <DialogTitle>Realizar Todos</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                Todos os lançamentos desse membro: <b>{selectedMemberId === 'all' ? 'Todos os membros' : members.find(m => m.id === selectedMemberId)?.name || ''}</b> incluindo recorrentes serão realizados.
                {selectedPaymentTarget !== 'all' && (
                  <> Filtro: <b>{getSelectedPaymentLabel()}</b>.</>
                )}
                {' '}Você confirma?
              </p>
              <label className="block text-sm font-medium">Selecione a data de realização:</label>
              <input
                type="date"
                className="input w-full bg-background text-foreground border border-border"
                value={realizeAllDate}
                onChange={e => setRealizeAllDate(e.target.value)}
                max={getTodayLocalISO()}
              />
              {!isEssential && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showRealizeAllBankList;
                      setShowRealizeAllBankList(next);
                      if (!next) setRealizeAllBankId('');
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors w-full mt-2 ${
                      showRealizeAllBankList
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                    }`}
                  >
                    <span className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors ${showRealizeAllBankList ? 'bg-primary border-primary' : 'bg-muted-foreground/30 border-transparent'}`}>
                      <span className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${showRealizeAllBankList ? 'translate-x-3' : 'translate-x-0'}`} />
                    </span>
                    Deduzir do banco
                  </button>
                  {showRealizeAllBankList && (
                    <div className="space-y-2 mt-2">
                      <label className="block text-sm font-medium">Selecione o banco para deduzir:</label>
                      {renderBankSelectorList(filterBanks, realizeAllBankId, setRealizeAllBankId, 'Não deduzir saldo')}
                    </div>
                  )}
                </>
              )}
              <div className="flex gap-2 justify-end mt-4">
                <Button variant="outline" onClick={() => setIsRealizeAllDialogOpen(false)}>Cancelar</Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleRealizeAll}
                  disabled={isRealizingAll}
                >{isRealizingAll ? 'Salvando...' : 'Confirmar'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isResetMonthDialogOpen}
          onOpenChange={(open) => {
            setIsResetMonthDialogOpen(open);
            if (!open) setResetInstallmentAction('delete-future');
          }}
        >
          <DialogContent aria-describedby="reset-month-desc">
            <span id="reset-month-desc" className="sr-only">Confirmação para remover as saídas do mês atual</span>
            <DialogHeader>
              <DialogTitle>Resetar Mês</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                Isso vai remover todas as saídas do período atual para <b>{selectedMemberId === 'all' ? 'todos os membros' : members.find(m => m.id === selectedMemberId)?.name || 'membro selecionado'}</b>
                {selectedPaymentTarget !== 'all' && <> com filtro <b>{getSelectedPaymentLabel()}</b></>}.
              </p>
              {hasInstallmentsInResetScope && (
                <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
                  <p className="text-sm font-medium">
                    Encontramos {resetMonthInstallments.length} despesa(s) parcelada(s) neste mês. Como deseja resetar?
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="reset-installment-action"
                        value="delete-future"
                        checked={resetInstallmentAction === 'delete-future'}
                        onChange={() => setResetInstallmentAction('delete-future')}
                        className="mt-0.5"
                      />
                      <span>Excluir as saídas do mês e parcelas dos meses seguintes.</span>
                    </label>
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="reset-installment-action"
                        value="keep-installments"
                        checked={resetInstallmentAction === 'keep-installments'}
                        onChange={() => setResetInstallmentAction('keep-installments')}
                        className="mt-0.5"
                      />
                      <span>Manter somente os parcelamentos (incluindo mês atual).</span>
                    </label>
                  </div>
                </div>
              )}
              <div className="rounded-md bg-red-500/10 border border-red-500/40 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400">
                <p>A ação é irreversível.</p>
                <p>Não é possível lançar o valor de volta aos bancos automaticamente. Ajuste manualmente.</p>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button variant="outline" onClick={() => setIsResetMonthDialogOpen(false)} disabled={isResettingMonth}>Cancelar</Button>
                <Button variant="destructive" onClick={handleResetMonth} disabled={isResettingMonth}>
                  {isResettingMonth ? 'Resetando...' : 'Confirmar Reset'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Expenses List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-secondary rounded" />
                    <div className="h-3 w-24 bg-secondary rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-expense/10 flex items-center justify-center mx-auto mb-4">
              <TrendingDown className="w-8 h-8 text-expense" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhuma despesa neste mês
            </h3>
            <p className="text-muted-foreground mb-6">
              Registre sua primeira despesa de {monthNames[currentMonth - 1]}
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="gradient-expense">
              <Plus className="w-4 h-4 mr-2" />
              Registrar Despesa
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Total de despesas filtradas */}
            {searchText && sortedExpenses.length > 0 && (
              <div className="glass-card rounded-xl p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Despesas encontradas: <span className="font-semibold text-foreground">{sortedExpenses.length}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-xl font-bold text-expense">{formatCurrency(totalSearchAmount)}</p>
                  </div>
                </div>
              </div>
            )}
            {paginatedExpenses.map((expense, index) => {
              const category = getCategory(expense.category_id, expense.custom_category_id);
              const memberFirstName = getMemberFirstName(expense.member_id);
              const tags = expenseTagsMap[expense.id] || [];
              const relatedTransfer = expenseTransferMap.get(expense.id);
              return (
                <div
                  key={expense.id}
                  className={cn(
                    "glass-card rounded-xl p-4 animate-fade-in hover:shadow-lg transition-shadow border",
                    expense.is_realized ? "border-green-500" : "border-yellow-500"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: category?.color ? `${category.color}20` : 'hsl(var(--expense) / 0.1)' }}
                    >
                      {expense.card_id ? (
                        <CreditCard className="w-5 h-5 text-blue-600" />
                      ) : expense.bank_id ? (
                        <Banknote className="w-5 h-5 text-green-600" />
                      ) : (
                        <TrendingDown
                          className="w-5 h-5"
                          style={{ color: category?.color || 'hsl(var(--expense))' }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-sm sm:text-base text-foreground truncate flex items-center gap-2">
                          {expense.description}
                        </p>
                        {memberFirstName && (
                          <span className="font-semibold text-xs sm:text-sm text-expense mr-1 flex items-center gap-2">
                            {memberFirstName}
                            {expense.lend_card && expense.lend_to && (
                              <span className="px-2 py-0.5 rounded-full bg-yellow-200 text-yellow-800 text-xs font-semibold">
                                Emprestado: {expense.lend_to}
                              </span>
                            )}
                          </span>
                        )}
                        {expense.is_recurring && (
                          <div className="flex items-center gap-1 text-xs bg-secondary px-2 py-0.5 rounded-full">
                            <RotateCcw className="w-3 h-3" />
                            {expense.installment_number}/{expense.total_installments}
                          </div>
                        )}
                        {!expense.is_realized && (
                          <span className={cn(
                            "ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700"
                          )}>
                            Não realizado
                          </span>
                        )}
                        {relatedTransfer && (
                          <span
                            className={cn(
                              'text-xs font-semibold px-2 py-0.5 rounded-full',
                              getTransferStatusClass(relatedTransfer.status),
                            )}
                          >
                            {getTransferStatusLabel(relatedTransfer.status)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {formatDate(expense.date)}
                        {category && ` • ${category.name}`}
                      </p>
                      {tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="px-2 py-0.5 rounded-full text-xs text-white"
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-2">
                      <span className="font-bold text-expense text-base sm:text-lg">R$ {Number(expense.amount).toFixed(2)}</span>
                      <div className="flex items-center gap-1">
                        {!expense.is_realized && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-xs"
                            title="Realizar"
                            onClick={() => {
                              setRealizingExpense(expense);
                              setRealizeDate(getTodayLocalISO());
                              setIsRealizeDialogOpen(true);
                            }}
                            aria-label="Realizar"
                          >
                            Realizar
                          </Button>
                        )}
                        <button
                          className="p-2 rounded hover:bg-muted"
                          title="Editar"
                          onClick={() => {
                            setExpenseToEdit(expense);
                            setIsExpenseEditDialogOpen(true);
                          }}
                          aria-label="Editar"
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          className="p-2 rounded hover:bg-muted"
                          title="Visualizar"
                          onClick={() => {
                            setEditingExpense(expense);
                            setIsEditDialogOpen(true);
                          }}
                          aria-label="Visualizar"
                        >
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          className="p-2 rounded hover:bg-destructive/10"
                          title="Excluir"
                          onClick={() => {
                            setDeletingExpense({
                              ...expense,
                              _returnToBank: false,
                              _returnBankId: '',
                              _deleteFutureInstallments: false,
                            });
                            setIsDeleteDialogOpen(true);
                          }}
                          aria-label="Excluir"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-6">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Anterior
            </Button>

            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>

            <Button
              variant="outline"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </div>
      <Dialog open={isPayTransferDialogOpen} onOpenChange={setIsPayTransferDialogOpen}>
        <DialogContent aria-describedby="pay-transfer-desc">
          <span id="pay-transfer-desc" className="sr-only">Registrar pagamento da cobrança recebida</span>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          {selectedTransferForPayment && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{selectedTransferForPayment.description}</p>
                <p>Valor: {formatCurrency(Number(selectedTransferForPayment.amount))}</p>
              </div>

              <div className="space-y-2">
                <Label>Data do pagamento</Label>
                <input
                  type="date"
                  className="input w-full bg-background text-foreground border border-border"
                  value={transferPaymentDate}
                  onChange={(event) => setTransferPaymentDate(event.target.value)}
                  max={getTodayLocalISO()}
                />
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !showTransferPaymentBankList;
                    setShowTransferPaymentBankList(next);
                    if (!next) setTransferPaymentBankId('');
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors w-full ${
                    showTransferPaymentBankList
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                  }`}
                >
                  <span className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors ${showTransferPaymentBankList ? 'bg-primary border-primary' : 'bg-muted-foreground/30 border-transparent'}`}>
                    <span className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${showTransferPaymentBankList ? 'translate-x-3' : 'translate-x-0'}`} />
                  </span>
                  Selecionar banco para débito
                </button>
                {showTransferPaymentBankList && (
                  <>
                    <Label>Banco que será debitado</Label>
                    {renderBankSelectorList(myBanks, transferPaymentBankId, setTransferPaymentBankId, 'Nenhum banco')}
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsPayTransferDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => void handleRegisterTransferPayment()} disabled={registerTransferPayment.isPending}>
                  {registerTransferPayment.isPending ? 'Salvando...' : 'Confirmar pagamento'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Transfer Dialog */}
      <Dialog open={isDeleteTransferDialogOpen} onOpenChange={setIsDeleteTransferDialogOpen}>
        <DialogContent aria-describedby="delete-transfer-desc">
          <span id="delete-transfer-desc" className="sr-only">Confirmação para deletar transferência</span>
          <DialogHeader>
            <DialogTitle>Deletar Transferência?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja deletar esta transferência? Essa ação é irreversível.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDeleteTransferDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteTransfer()}
              disabled={deleteTransfer.isPending}
            >
              {deleteTransfer.isPending ? 'Deletando...' : 'Deletar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isExpenseEditDialogOpen}
        onOpenChange={(open) => {
          setIsExpenseEditDialogOpen(open);
          if (!open) setExpenseToEdit(null);
        }}
      >
        <DialogContent aria-describedby="edit-expense-desc">
          <span id="edit-expense-desc" className="sr-only">Formulário para editar saída existente</span>
          <DialogHeader>
            <DialogTitle>Editar Saída</DialogTitle>
          </DialogHeader>
          {expenseToEdit && (
            <ExpenseForm
              initialData={expenseToEdit as any}
              onSuccess={() => {
                setIsExpenseEditDialogOpen(false);
                setExpenseToEdit(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Expense Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent aria-describedby="view-expense-desc">
          <span id="view-expense-desc" className="sr-only">Visualização dos detalhes da despesa</span>
          <DialogHeader>
            <DialogTitle>Visualizar Despesa</DialogTitle>
          </DialogHeader>
          {editingExpense && (
            <div className="space-y-3">
              <div><span className="font-semibold">Descrição:</span> {editingExpense.description}</div>
              <div><span className="font-semibold">Valor:</span> {formatCurrency(Number(editingExpense.amount))}</div>
              <div><span className="font-semibold">Data:</span> {formatDate(editingExpense.date)}</div>
              {(editingExpense.launch_date) && (
                <div><span className="font-semibold">Data do Lançamento:</span> {formatDate(editingExpense.launch_date)}</div>
              )}
              {getCategory(editingExpense.category_id, editingExpense.custom_category_id) && (
                <div><span className="font-semibold">Categoria:</span> {getCategory(editingExpense.category_id, editingExpense.custom_category_id)!.name}</div>
              )}
              {expenseTagsMap[editingExpense.id]?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">Tags:</span>
                  {expenseTagsMap[editingExpense.id].map((tag) => (
                    <span
                      key={tag.id}
                      className="px-2 py-0.5 rounded-full text-xs text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
              {editingExpense.output_mode && (
                <div><span className="font-semibold">Tipo de Saída:</span> {editingExpense.output_mode.charAt(0).toUpperCase() + editingExpense.output_mode.slice(1)}</div>
              )}
              {editingExpense.bank_id && (
                <div><span className="font-semibold">Banco:</span> {banks.find(b => b.id === editingExpense.bank_id)?.name || editingExpense.bank_id}</div>
              )}
              {editingExpense.card_id && (
                <div><span className="font-semibold">Cartão:</span> {allCards.find(c => c.id === editingExpense.card_id)?.name || editingExpense.card_id}</div>
              )}
              {editingExpense.total_installments && editingExpense.total_installments > 1 && (
                <div><span className="font-semibold">Parcelado:</span> {editingExpense.installment_number || 1}/{editingExpense.total_installments}</div>
              )}
              {editingExpense.is_recurring && (
                <div><span className="font-semibold">Recorrente:</span> Sim</div>
              )}
              {editingExpense.lend_card && (
                <div><span className="font-semibold">Empréstimo de Cartão:</span> Sim{editingExpense.lend_to ? ` (${editingExpense.lend_to})` : ''}</div>
              )}
              {editingExpense.lend_money && (
                <div><span className="font-semibold">Empréstimo de Banco:</span> Sim{editingExpense.lend_money_to ? ` (${editingExpense.lend_money_to})` : ''}</div>
              )}
              {expenseTransferMap.get(editingExpense.id) && (
                <div>
                  <span className="font-semibold">Status cobrança família:</span>{' '}
                  {getTransferStatusLabel(expenseTransferMap.get(editingExpense.id)!.status)}
                </div>
              )}
              <div><span className="font-semibold">Status:</span> {editingExpense.is_realized ? 'Realizado' : 'Não realizado'}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Transfer Dialog */}
      <Dialog
        open={isPreviewTransferOpen}
        onOpenChange={(open) => {
          setIsPreviewTransferOpen(open);
          if (!open) setPreviewTransfer(null);
        }}
      >
        <DialogContent aria-describedby="view-transfer-desc">
          <span id="view-transfer-desc" className="sr-only">Visualização dos detalhes do empréstimo</span>
          <DialogHeader>
            <DialogTitle>Visualizar Empréstimo</DialogTitle>
          </DialogHeader>
          {previewTransfer && (
            <div className="space-y-3">
              <div><span className="font-semibold">Descrição:</span> {previewTransfer.description}</div>
              <div><span className="font-semibold">Valor:</span> {formatCurrency(Number(previewTransfer.amount))}</div>
              <div><span className="font-semibold">Status:</span> {getTransferStatusLabel(previewTransfer.status)}</div>
              <div><span className="font-semibold">Solicitado em:</span> {formatDate(previewTransfer.requested_date)}</div>
              <div><span className="font-semibold">Pagamento:</span> {previewTransfer.payment_date ? formatDate(previewTransfer.payment_date) : '-'}</div>
              <div><span className="font-semibold">De:</span> {previewTransfer.creditor?.name || previewTransfer.creditor_name || members.find((m) => m.id === previewTransfer.creditor_member_id)?.name || 'Usuário'}</div>
              <div><span className="font-semibold">Para:</span> {previewTransfer.debtor?.name || previewTransfer.debtor_name || members.find((m) => m.id === previewTransfer.debtor_member_id)?.name || 'Usuário'}</div>
              <div><span className="font-semibold">Banco de recebimento:</span> {myBanks.find((bank) => bank.id === previewTransfer.creditor_bank_id)?.name || '-'}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Expense Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent aria-describedby="delete-expense-desc">
          <span id="delete-expense-desc" className="sr-only">Confirmação de exclusão de despesa</span>
          <DialogHeader className="space-y-3 pb-2">
            <DialogTitle className="text-xl leading-tight">Excluir despesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tem certeza que deseja excluir o lançamento{' '}
              <span className="font-semibold text-foreground">{deletingExpense?.description}</span>?
            </p>
            {deletingExpense && (
              <>
                {Number(deletingExpense.total_installments || 0) > 1 &&
                  Number(deletingExpense.installment_number || 0) < Number(deletingExpense.total_installments || 0) && (
                    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          id="delete-future-installments"
                          checked={!!deletingExpense._deleteFutureInstallments}
                          onChange={(e) => {
                            setDeletingExpense({ ...deletingExpense, _deleteFutureInstallments: e.target.checked });
                          }}
                          className="mt-0.5"
                        />
                        <label htmlFor="delete-future-installments" className="select-none cursor-pointer text-sm leading-snug">
                          Excluir também as parcelas futuras deste lançamento
                          <span className="block text-xs text-muted-foreground mt-1">
                            Será excluída a parcela atual e as próximas ({deletingExpense.installment_number}/{deletingExpense.total_installments} em diante).
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                {!isEssential && (
                  <button
                    type="button"
                    onClick={() => setDeletingExpense({ ...deletingExpense, _returnToBank: !deletingExpense._returnToBank })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors w-full mt-2 ${
                      deletingExpense._returnToBank
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                    }`}
                  >
                    <span className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors ${deletingExpense._returnToBank ? 'bg-primary border-primary' : 'bg-muted-foreground/30 border-transparent'}`}>
                      <span className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${deletingExpense._returnToBank ? 'translate-x-3' : 'translate-x-0'}`} />
                    </span>
                    Lançar valor como saldo no banco
                  </button>
                )}
                {!isEssential && deletingExpense._returnToBank && (
                  <div className="space-y-2 mt-2">
                    <label className="block text-sm font-medium">Selecione o banco para lançar o valor:</label>
                    {renderBankSelectorList(
                      deleteBanks,
                      deletingExpense._returnBankId || '',
                      (value) => setDeletingExpense({ ...deletingExpense, _returnBankId: value }),
                      'Não selecionar banco'
                    )}
                  </div>
                )}
              </>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (deletingExpense) {
                    const shouldDeleteFutureInstallments =
                      !!deletingExpense._deleteFutureInstallments &&
                      Number(deletingExpense.total_installments || 0) > 1;

                    let deletedFutureCount = 0;
                    if (shouldDeleteFutureInstallments) {
                      const futureIds = await findFutureInstallmentIds(deletingExpense);
                      for (const futureId of futureIds) {
                        const linkedFutureTransfer = expenseTransferMap.get(futureId);
                        if (linkedFutureTransfer) {
                          await deleteTransfer.mutateAsync(linkedFutureTransfer.id);
                        }
                        await deleteExpense.mutateAsync(futureId);
                        deletedFutureCount++;
                      }
                    }

                    const linkedTransfer = expenseTransferMap.get(deletingExpense.id);
                    if (linkedTransfer) {
                      await deleteTransfer.mutateAsync(linkedTransfer.id);
                    }

                    // Saldo do banco retornado automaticamente por trigger
                    // if (deletingExpense._returnToBank && deletingExpense._returnBankId) {
                    //   const bank = deleteBanks.find(b => b.id === deletingExpense._returnBankId);
                    //   if (bank) {
                    //     const amount = Number(deletingExpense.amount);
                    //     await updateBankBalance.mutateAsync({ bank_id: deletingExpense._returnBankId, amount });
                    //   }
                    // }
                    await deleteExpense.mutateAsync(deletingExpense.id);

                    if (shouldDeleteFutureInstallments) {
                      toast.success(`Despesa excluída com ${deletedFutureCount} parcela(s) futura(s).`);
                    } else {
                      toast.success('Despesa excluída com sucesso.');
                    }

                    setIsDeleteDialogOpen(false);
                    setDeletingExpense(null);
                  }
                }}
                disabled={deleteExpense.isPending}
              >{deleteExpense.isPending ? 'Excluindo...' : 'Excluir'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </MainLayout>
      {renderRealizeDialog()}
    </>
  );
}

