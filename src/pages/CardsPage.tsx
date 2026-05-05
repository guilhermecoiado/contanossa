// Mapeamento de cores dos bancos e fintechs
const bankColors: Record<string, string> = {
  // ...existing code...
  'Banco do Brasil': '#FFCC00',
  'Caixa Econômica Federal': '#0033A0',
  'Itaú Unibanco': '#FF6600',
  'Bradesco': '#E60028',
  'Santander Brasil': '#EB001B',
  'Banco Safra': '#004478',
  'Banco Votorantim': '#12468A',
  'BV': '#0052A5',
  'Banco Pan': '#FF7900',
  'Banrisul': '#003366',
  'Banco da Amazônia': '#007F4F',
  'Banco do Nordeste': '#0066CC',
  'Banco BMG': '#0057A3',
  'Citibank Brasil': '#2868B0',
  'Banco Daycoval': '#003366',
  'Nubank': '#8A05BE',
  'Banco Inter': '#00C28C',
  'C6 Bank': '#000000',
  'Neon': '#FF00FF',
  'Original': '#045CB4',
  'Agibank': '#F02027',
  'BS2': '#2E3192',
  'Digio': '#00A6D6',
  'Next': '#FF7900',
  'PagBank': '#FF0000',
  'PicPay': '#00CC66',
  'Mercado Pago': '#0033CC',
  'Banco Genial': '#6699CC',
  'Banco Creditas': '#FF6600',
  'Banco Will': '#000000',
  'Sicredi': '#007F3F',
  'Sicoob': '#FFCC00',
  'Unicred': '#990000',
  'Cresol': '#008000',
  'Bancoob': '#005B9F',
  'Banco Crefisa': '#0066CC',
  'Banco Modal': '#0055A4',
  'BNDES': '#005EB8',
  'Banco Palmas': '#F7941D',
  'Banco24Horas': '#0070C0',
};

// Ajustes manuais de limites são agora armazenados em colunas separadas:
// - used_limit: valor calculado pelo trigger (sempre atualizado automaticamente)
// - used_limit_manual_offset: ajuste manual do usuário (adicionado ao value exibido)
// - available_limit: valor calculado pelo trigger 
// - available_limit_manual_offset: ajuste manual do usuário (adicionado ao value exibido)

const clampValue = (value: number, min = 0, max = Number.POSITIVE_INFINITY) => {
  return Math.min(Math.max(value, min), max);
};

type CardActivityEntry = {
  id: string;
  variant: 'realized' | 'restored';
  description: string;
  amount: number;
  cardName: string;
  cardId: string;
  date: Date;
};

import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useCards, useCreateCard, useExpenses, useRecurringExpenses } from '@/hooks/useFinances';
// Utilitário para calcular limite utilizado de um cartão, incluindo recorrentes marcados
// Agora soma todas as despesas recorrentes do cartão, independente do campo deduct_from_card_limit
// Limite utilizado: soma todas as despesas realizadas do cartão + todas as recorrentes
// Limite utilizado: soma todas as despesas do cartão (parceladas: soma todas as parcelas, não só as realizadas) + todas as recorrentes
function getCardUsedLimit(cardId: string, expenses: any[], recurring: any[]): number {
  // Soma todas as despesas do cartão (parceladas: soma todas as parcelas, não só as realizadas)
  const cardExpenses = expenses.filter(e => String(e.card_id) === String(cardId));
  const totalInstallmentsSum = cardExpenses
    .filter(e => e.total_installments && e.total_installments > 1)
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const singleExpensesSum = cardExpenses
    .filter(e => !e.total_installments || e.total_installments <= 1)
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  // Soma todas as recorrentes do cartão
  const recurringSum = recurring
    .filter(r => String(r.card_id) === String(cardId) && r.amount != null && !isNaN(Number(r.amount)))
    .reduce((sum, r) => sum + Number(r.amount), 0);
  return totalInstallmentsSum + singleExpensesSum + recurringSum;
}
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Pencil, Trash2, Eye, FileText, ChevronRight, ArrowUpRight, ArrowDownLeft, Ban, CheckCircle } from 'lucide-react';
import { useUpdateCard, useDeleteCard } from '@/hooks/useCardActions';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/formatters';
import { Plus, CreditCard, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMembers } from '@/hooks/useMembers';
import { useBanks, useUpdateExpense } from '@/hooks/useFinances';
import { useUpdateBankBalance } from '@/hooks/useBankActions';
import { checkSession, handleAuthError } from '@/lib/authErrorHandler';

const cardSchema = z.object({
  member_id: z.string().optional(),
  name: z.string().min(1, 'Nome obrigatório'),
  card_type: z.string().optional(),
  credit_limit: z.number().optional(),
  closing_day: z.number().min(1).max(31).optional(),
  due_day: z.number().min(1).max(31).optional(),
});

type CardFormData = z.infer<typeof cardSchema>;

export default function CardsPage() {
  // Busca todas as despesas de todos os cartões do membro selecionado
  const { data: allExpenses = [] } = useExpenses(undefined, undefined, undefined);
  // Busca todas as recorrentes ativas
  const { data: allRecurring = [] } = useRecurringExpenses();

          const updateBankBalance = useUpdateBankBalance();
        const updateExpense = useUpdateExpense();
        const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
      // State para dialog de seleção de banco ao registrar pagamento
      const [selectBankDialogOpen, setSelectBankDialogOpen] = useState(false);
      const [showDevAlert, setShowDevAlert] = useState(false);
      const [selectedInvoiceTotal, setSelectedInvoiceTotal] = useState(0);
      const [selectedInvoiceCard, setSelectedInvoiceCard] = useState(null);
      const { data: allBanks = [] } = useBanks();
    // State para dialog de fatura
    const [invoiceDialogCard, setInvoiceDialogCard] = useState(null);
    const [invoiceMonth, setInvoiceMonth] = useState<number>(new Date().getMonth() + 1);
    const [showCardActivity, setShowCardActivity] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState(null);
  const [blockCardDialogOpen, setBlockCardDialogOpen] = useState(false);
  const [cardToBlock, setCardToBlock] = useState(null);
  // State para modal de visualização de despesas do cartão
  const [viewExpensesCard, setViewExpensesCard] = useState(null);
    const updateCard = useUpdateCard();
    const deleteCard = useDeleteCard();
    const [editCard, setEditCard] = useState(null);
    const [manualUsedEditValue, setManualUsedEditValue] = useState(0);
    const [manualAvailableEditValue, setManualAvailableEditValue] = useState(0);
    // Formulário de edição de cartão
    const {
      register: registerEdit,
      handleSubmit: handleSubmitEdit,
      setValue: setValueEdit,
      reset: resetEdit,
      watch: watchEdit,
      formState: { errors: errorsEdit },
    } = useForm<CardFormData>({
      resolver: zodResolver(cardSchema),
    });
  const navigate = useNavigate();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  const { currentMember, isAuthenticated } = useAuth();
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const { data: cards = [], isLoading } = useCards(selectedMemberId === 'all' ? undefined : selectedMemberId);

  const createCard = useCreateCard();
  const { data: members = [] } = useMembers();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
    watch,
  } = useForm<CardFormData>({
    resolver: zodResolver(cardSchema),
  });

  const filteredCards = selectedMemberId === 'all' ? cards : cards.filter(card => card.member_id === selectedMemberId);

  const cardActivityEntries = useMemo<CardActivityEntry[]>(() => {
    if (filteredCards.length === 0) return [];
    const visibleCardIds = new Set(filteredCards.map(card => card.id));
    const entries: CardActivityEntry[] = [];
    const safeDate = (primary?: string | null, fallback?: string | null) => {
      const raw = primary || fallback;
      if (!raw) return new Date();
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    };

    // Saídas realizadas (despesas)
    allExpenses.forEach(expense => {
      if (!expense.card_id || !visibleCardIds.has(String(expense.card_id))) return;
      const card = cards.find(c => String(c.id) === String(expense.card_id));
      if (!card) return;
      if (expense.is_realized) {
        entries.push({
          id: `realized-${expense.id}`,
          variant: 'realized',
          description: expense.description || 'Despesa sem descrição',
          amount: Number(expense.amount) || 0,
          cardName: card.name,
          cardId: card.id,
          date: safeDate(expense.realized_date, expense.date),
        });
      }
    });

    return entries
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 8);
  }, [allExpenses, cards, filteredCards]);

  const watchedEditCreditLimit = watchEdit('credit_limit');
  const editModalCreditLimit = clampValue(
    Number(watchedEditCreditLimit ?? (editCard?.credit_limit ?? 0)) || 0,
    0,
    Number.POSITIVE_INFINITY
  );

  useEffect(() => {
    if (!editCard) return;
    setManualUsedEditValue(prev => clampValue(prev, 0, editModalCreditLimit));
    setManualAvailableEditValue(prev => clampValue(prev, 0, editModalCreditLimit));
  }, [editCard, editModalCreditLimit]);

  const cardLimitSummaries = useMemo(() => {
    const summaryMap: Record<string, {
      creditLimit: number;
      calculatedUsed: number;
      usedAdjustment: number;
      used: number;
      baseAvailable: number;
      availableAdjustment: number;
      available: number;
    }> = {};

    cards.forEach(card => {
      const creditLimit = clampValue(Number(card.credit_limit ?? 0) || 0, 0, Number.POSITIVE_INFINITY);
      const calculatedUsed = Number(card.used_limit ?? 0) || 0;
      const baseAvailable = Number(card.available_limit ?? (creditLimit - calculatedUsed)) || 0;

      // Mantem ajustes manuais separados; o display reflete as colunas usadas no banco
      const usedManualOffset = Number(card.used_limit_manual_offset ?? 0) || 0;
      const availableManualOffset = Number(card.available_limit_manual_offset ?? 0) || 0;

      const clampedUsed = clampValue(calculatedUsed, 0, creditLimit);
      const clampedAvailable = clampValue(baseAvailable, 0, creditLimit);

      summaryMap[card.id] = {
        creditLimit,
        calculatedUsed,
        usedAdjustment: usedManualOffset,
        used: clampedUsed,
        baseAvailable,
        availableAdjustment: availableManualOffset,
        available: clampedAvailable,
      };
    });

    return summaryMap;
  }, [cards, allExpenses, allRecurring]);

  const getLimitSummary = (cardId: string) => {
    if (cardLimitSummaries[cardId]) return cardLimitSummaries[cardId];

    const fallbackCard = cards.find(c => c.id === cardId);
    if (!fallbackCard) {
      return {
        creditLimit: 0,
        calculatedUsed: 0,
        usedAdjustment: 0,
        used: 0,
        baseAvailable: 0,
        availableAdjustment: 0,
        available: 0,
      };
    }

    // Calcula valores base a partir das colunas do banco
    const creditLimit = clampValue(Number(fallbackCard.credit_limit ?? 0) || 0, 0, Number.POSITIVE_INFINITY);
    const calculatedUsed = Number(fallbackCard.used_limit ?? 0) || 0;
    const baseAvailable = Number(fallbackCard.available_limit ?? (creditLimit - calculatedUsed)) || 0;

    // Mantem ajustes manuais separados; o display reflete as colunas usadas no banco
    const usedManualOffset = Number(fallbackCard.used_limit_manual_offset ?? 0) || 0;
    const availableManualOffset = Number(fallbackCard.available_limit_manual_offset ?? 0) || 0;

    const clampedUsed = clampValue(calculatedUsed, 0, creditLimit);
    const clampedAvailable = clampValue(baseAvailable, 0, creditLimit);

    return {
      creditLimit,
      calculatedUsed,
      usedAdjustment: usedManualOffset,
      used: clampedUsed,
      baseAvailable,
      availableAdjustment: availableManualOffset,
      available: clampedAvailable,
    };
  };

  const onSubmit = async (data: CardFormData) => {
    if (!currentMember && !data.member_id) return;
    try {
      // Verifica se a sessão ainda está ativa
      const isSessionValid = await checkSession();
      if (!isSessionValid) {
        toast.error('Sua sessão expirou. Por favor, faça login novamente.');
        navigate('/');
        return;
      }

      await createCard.mutateAsync({
        member_id: data.member_id || currentMember?.id,
        name: data.name,
        card_type: data.card_type || 'credit',
        credit_limit: data.credit_limit,
        closing_day: data.closing_day,
        due_day: data.due_day,
      });
      toast.success('Cartão cadastrado com sucesso!');
      reset();
      setIsAddDialogOpen(false);
    } catch (error: any) {
      const errorMsg = handleAuthError(error, () => navigate('/'));
      if (errorMsg !== 'Sessão expirada') {
        toast.error(errorMsg);
      }
    }
  };

  // Soma dos limites totais dos cartões filtrados
  const totalLimit = cards.reduce((sum, c) => sum + Number(c.credit_limit || 0), 0);
  // Soma dos limites disponíveis dos cartões filtrados (calculado no front)
  const totalAvailableLimit = cards.reduce((sum, card) => {
    const summary = getLimitSummary(card.id);
    const available = clampValue(summary.creditLimit - summary.used, 0, summary.creditLimit);
    return sum + available;
  }, 0);

  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <CreditCard className="w-16 h-16 text-primary mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Cadastre seus Cartões
          </h1>
          <p className="text-muted-foreground mb-6">
            Faça login para gerenciar seus cartões
          </p>
          <Button onClick={() => navigate('/members')}>
            Ir para Membros
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Desktop Header */}
          <div className="hidden sm:flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl gradient-cards flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                Cartões
              </h1>
              <p className="text-muted-foreground">
                Gerencie seus cartões de crédito e débito
              </p>
            </div>
          </div>
          {/* Mobile Header Box */}
          <div className="sm:hidden flex flex-col items-center gap-3 bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950 dark:to-violet-900 rounded-xl p-4 border border-purple-200 dark:border-violet-800 shadow-sm w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-cards flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                Cartões
              </h1>
            </div>
            <p className="text-muted-foreground text-center text-sm">
              Gerencie seus cartões de crédito e débito
            </p>
          </div>
          <div className="flex gap-2 items-center">
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Cartão
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Cartão</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="member_id">Membro</Label>
                  <Select value={watch('member_id') || ''} onValueChange={value => setValue('member_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o membro" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map(member => (
                        <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Cartão</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder="Ex: Nubank, Itaú Platinum"
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Cartão</Label>
                  <Select onValueChange={(value) => setValue('card_type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">Crédito</SelectItem>
                      <SelectItem value="debit">Débito</SelectItem>
                      <SelectItem value="both">Crédito e Débito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="credit_limit">Limite de Crédito</Label>
                  <Input
                    id="credit_limit"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    disabled
                    value={
                      (() => {
                        const raw = watch('credit_limit');
                        if (typeof raw === 'number' && !isNaN(raw)) {
                          return raw.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        }
                        return '';
                      })()
                    }
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="closing_day">Dia de Fechamento</Label>
                    <Input
                      id="closing_day"
                      type="number"
                      min="1"
                      max="31"
                      {...register('closing_day', { valueAsNumber: true })}
                      placeholder="10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_day">Dia de Vencimento</Label>
                    <Input
                      id="due_day"
                      type="number"
                      min="1"
                      max="31"
                      {...register('due_day', { valueAsNumber: true })}
                      placeholder="20"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={createCard.isPending}>
                  {createCard.isPending ? 'Cadastrando...' : 'Cadastrar Cartão'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Total Card */}
        <div className="glass-card rounded-2xl p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 w-full sm:w-auto text-center sm:text-left">
            <div className="w-12 h-12 rounded-xl bg-purple-700 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Limite Total</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground">{formatCurrency(totalLimit)}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Limite Total Disponível</p>
                  <p className="text-lg sm:text-2xl font-bold text-purple-700">{formatCurrency(totalAvailableLimit)}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="w-full lg:w-auto flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtrar por membro</span>
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className="w-full sm:w-[180px]">
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
        </div>

        {cardActivityEntries.length > 0 && (
          <div className="glass-card rounded-2xl">
            <button
              className="w-full flex items-center justify-between px-6 py-5 focus:outline-none"
              onClick={() => setShowCardActivity(prev => !prev)}
              aria-expanded={showCardActivity}
              aria-controls="card-activity-panel"
            >
              <div className="flex items-center gap-3 text-left">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary transition-transform ${showCardActivity ? 'rotate-90' : ''}`}>
                  <ChevronRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-semibold text-foreground">Movimentações recentes</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">Acompanhe como cada despesa afetou seus limites</p>
                </div>
              </div>
              <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide">
                {showCardActivity ? 'ocultar' : `ver últimas ${cardActivityEntries.length}`}
              </span>
            </button>
            {showCardActivity && (
              <div id="card-activity-panel" className="px-6 pb-6 space-y-4">
                <ul className="divide-y divide-border">
                  {cardActivityEntries.map(entry => {
                    const isRestore = entry.variant === 'restored';
                    const formattedDate = entry.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
                    const formattedTime = entry.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <li key={entry.id} className="py-3 flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isRestore ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {isRestore ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            Despesa {isRestore ? 'estornada' : 'realizada'} • {entry.description}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {formatCurrency(entry.amount)} {isRestore ? 'devolvido ao limite disponível e abatido do limite utilizado' : 'adicionado ao limite utilizado e deduzido do limite disponível'} do cartão {entry.cardName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Registrado em {formattedDate} às {formattedTime}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Cards List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-secondary rounded" />
                    <div className="h-3 w-16 bg-secondary rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhum cartão cadastrado
            </h3>
            <p className="text-muted-foreground mb-6">
              Cadastre seus cartões para controlar seus gastos
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Cartão
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCards.map((card, index) => {
              const member = members.find(m => m.id === card.member_id);
              const limitSummary = getLimitSummary(card.id);
              const displayAvailableLimit = clampValue(
                limitSummary.creditLimit - limitSummary.used,
                0,
                limitSummary.creditLimit
              );
              return (
                <div
                  key={card.id}
                  className={`glass-card rounded-2xl p-8 animate-fade-in hover:shadow-xl transition-shadow ${card.is_blocked ? '!bg-red-100/80 !border-red-200 border dark:!bg-red-900/40 dark:!border-red-800' : ''}`}
                  style={{ width: '100%', animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#F5F5F5' }}>
                      <CreditCard
                        className="w-6 h-6"
                        style={{ color: bankColors[card.name.trim()] || '#8A05BE' }}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{card.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {card.card_type === 'credit' && 'Crédito'}
                        {card.card_type === 'debit' && 'Débito'}
                        {card.card_type === 'both' && 'Crédito/Débito'}
                      </p>
                      {member && (
                        <p className="text-xs text-muted-foreground mt-1">{member.name.split(' ')[0]}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 ml-auto max-w-full overflow-hidden">
                      <button
                        className="p-2 rounded hover:bg-blue-100"
                        title="Editar"
                        onClick={() => {
                          const summary = getLimitSummary(card.id);
                          setManualUsedEditValue(clampValue(summary.used, 0, summary.creditLimit));
                          setManualAvailableEditValue(clampValue(summary.available, 0, summary.creditLimit));
                          setEditCard(card);
                          resetEdit({
                            name: card.name,
                            card_type: card.card_type,
                            credit_limit: card.credit_limit || 0,
                            closing_day: card.closing_day || undefined,
                            due_day: card.due_day || undefined,
                          });
                        }}
                      >
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button
                        className="p-2 rounded hover:bg-gray-100"
                        title="Visualizar"
                        onClick={() => setViewExpensesCard(card)}
                      >
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button
                        className={`p-2 rounded ${
                          card.is_blocked ? 'hover:bg-green-100' : 'hover:bg-red-100'
                        }`}
                        title={card.is_blocked ? 'Desbloquear Cartão' : 'Bloquear Cartão'}
                        onClick={() => {
                          setCardToBlock(card);
                          setBlockCardDialogOpen(true);
                        }}
                      >
                        {card.is_blocked ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Ban className="w-4 h-4 text-red-500" />
                        )}
                      </button>
                      <button
                        className="p-2 rounded hover:bg-red-100"
                        title="Excluir"
                        onClick={() => {
                          setCardToDelete(card);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                          {/* Modal de visualização de despesas do cartão - fora do loop */}
                          <Dialog open={!!viewExpensesCard} onOpenChange={open => { if (!open) setViewExpensesCard(null); }}>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="text-base md:text-lg font-semibold text-center md:text-left">
                                  Despesas do Cartão {viewExpensesCard?.name}
                                </DialogTitle>
                              </DialogHeader>
                              {viewExpensesCard && (
                                <div className="space-y-4">
                                  <h4 className="text-xs md:text-sm font-normal text-muted-foreground text-center md:text-left">
                                    Despesas Rotativas e Parceladas
                                  </h4>
                                  <ul className="divide-y divide-border">
                                    {allExpenses.filter(e => String(e.card_id) === String(viewExpensesCard.id)).length === 0 && (
                                      <li className="py-2 text-muted-foreground">Nenhuma despesa encontrada.</li>
                                    )}
                                    {allExpenses.filter(e => String(e.card_id) === String(viewExpensesCard.id)).map(e => (
                                      <li key={e.id} className="py-2 flex justify-between items-center">
                                        <span>{e.description} {e.is_recurring && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-2">Recorrente</span>}</span>
                                        <span className="font-medium">R$ {Number(e.amount).toFixed(2)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                  <h4 className="font-semibold mt-6">Despesas Recorrentes</h4>
                                  <ul className="divide-y divide-border">
                                    {allRecurring.filter(r => String(r.card_id) === String(viewExpensesCard.id)).length === 0 && (
                                      <li className="py-2 text-muted-foreground">Nenhuma despesa recorrente encontrada.</li>
                                    )}
                                    {allRecurring.filter(r => String(r.card_id) === String(viewExpensesCard.id)).map(r => (
                                      <li key={r.id} className="py-2 flex justify-between items-center">
                                        <span>{r.description}</span>
                                        <span className="font-medium">R$ {Number(r.amount).toFixed(2)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                    </div>
                  </div>

                  {/* Limite e limites utilizados/disponíveis agora só nos modais de edição */}
                                    {card.credit_limit && (
                                      <div className="mb-4 space-y-0.5">
                                        <p className="text-xs text-muted-foreground">Limite</p>
                                        <p className="text-base font-semibold text-foreground">
                                          {formatCurrency(Number(card.credit_limit))}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Limite utilizado:</p>
                                        <p className="text-sm font-normal">{formatCurrency(limitSummary.used)}</p>
                                        <p className="text-xs text-muted-foreground">Limite disponível:</p>
                                        <p className="text-sm font-normal">{formatCurrency(displayAvailableLimit)}</p>
                                      </div>
                                    )}
                  {/* Pop-up de confirmação para excluir cartão */}
                  <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Cartão</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir o cartão <b>{cardToDelete?.name}</b>? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-white hover:bg-destructive/90"
                          onClick={async () => {
                            if (cardToDelete) {
                              await deleteCard.mutateAsync(cardToDelete.id);
                              toast.success('Cartão excluído com sucesso!');
                              setCardToDelete(null);
                              setDeleteDialogOpen(false);
                            }
                          }}
                        >Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* Pop-up de confirmação para bloquear/desbloquear cartão */}
                  <AlertDialog open={blockCardDialogOpen} onOpenChange={setBlockCardDialogOpen}>
                    <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {cardToBlock?.is_blocked ? 'Desbloquear Cartão' : 'Bloquear Cartão'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {cardToBlock?.is_blocked ? (
                            <>Tem certeza que deseja desbloquear o cartão <b>{cardToBlock?.name}</b>? Ele voltará a aparecer na lista de cartões ao lançar saídas.</>
                          ) : (
                            <>Tem certeza que deseja bloquear o cartão <b>{cardToBlock?.name}</b>? Ele não aparecerá mais na lista de cartões ao lançar saídas.</>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className={cardToBlock?.is_blocked ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700'}
                          onClick={async () => {
                            if (cardToBlock) {
                              await updateCard.mutateAsync({
                                id: cardToBlock.id,
                                is_blocked: !cardToBlock.is_blocked,
                              });
                              toast.success(cardToBlock.is_blocked ? 'Cartão desbloqueado com sucesso!' : 'Cartão bloqueado com sucesso!');
                              setCardToBlock(null);
                              setBlockCardDialogOpen(false);
                            }
                          }}
                        >{cardToBlock?.is_blocked ? 'Desbloquear' : 'Bloquear'}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* Modal para editar limite do cartão removido - funcionalidade disponível em "Editar" */}

                  <div className="flex gap-4 pt-4 border-t border-border text-sm items-center">
                    {card.closing_day && (
                      <div>
                        <p className="text-muted-foreground">Fecha</p>
                        <p className="font-medium">Dia {card.closing_day}</p>
                      </div>
                    )}
                    {card.due_day && (
                      <div>
                        <p className="text-muted-foreground">Vence</p>
                        <p className="font-medium">Dia {card.due_day}</p>
                      </div>
                    )}
                    <button
                      className="ml-auto flex items-center gap-1 px-3 py-1 rounded bg-secondary hover:bg-primary/10 text-primary transition-colors"
                      title="Fatura"
                      onClick={() => {
                        setInvoiceDialogCard(card);
                        setInvoiceMonth(new Date().getMonth() + 1);
                      }}
                    >
                      <FileText className="w-4 h-4" />
                      <span className="font-medium">Fatura</span>
                    </button>
                        {/* Dialog de Fatura do Cartão */}
                        <Dialog open={!!invoiceDialogCard} onOpenChange={open => { if (!open) setInvoiceDialogCard(null); }}>
                          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Fatura do Cartão {invoiceDialogCard?.name}</DialogTitle>
                            </DialogHeader>
                            {invoiceDialogCard && (
                              <div className="space-y-4">
                                <div className="flex items-center gap-2 mt-6">
                                  <span className="font-medium">Mês:</span>
                                  <Select value={String(invoiceMonth)} onValueChange={v => setInvoiceMonth(Number(v))}>
                                    <SelectTrigger className="min-w-[120px]">
                                      <SelectValue placeholder="Selecione o mês" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {[...Array(12)].map((_, i) => (
                                        <SelectItem key={i+1} value={String(i+1)}>{new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {/* Filtra despesas e recorrentes pela lógica de fatura considerando fechamento */}
                                {(() => {
                                  const closingDay = invoiceDialogCard.closing_day || 1;
                                  const year = new Date().getFullYear();
                                  // Data de início e fim da fatura
                                  const start = new Date(year, invoiceMonth - 1, closingDay + 1);
                                  const end = new Date(year, invoiceMonth, closingDay);
                                  if (end.getMonth() !== invoiceMonth % 12) end.setDate(0);
                                  // Filtra despesas do cartão: período da fatura + não realizadas antes
                                  const periodExpenses = allExpenses.filter(e => String(e.card_id) === String(invoiceDialogCard.id) && new Date(e.date) >= start && new Date(e.date) <= end);
                                  const unrealizedBefore = allExpenses.filter(e => String(e.card_id) === String(invoiceDialogCard.id) && !e.is_realized && new Date(e.date) < start);
                                  const expenses = [...periodExpenses, ...unrealizedBefore];
                                  // Filtra recorrentes do cartão para o período da fatura
                                  const recurring = allRecurring.filter(r => String(r.card_id) === String(invoiceDialogCard.id) && new Date(r.start_date) >= start && new Date(r.start_date) <= end);
                                  // Junta ambos
                                  const all = [
                                    ...expenses.map(e => ({
                                      id: e.id,
                                      description: e.description,
                                      amount: e.amount,
                                      isRecurring: false
                                    })),
                                    ...recurring.map(r => ({
                                      id: r.id,
                                      description: r.description + ' (Recorrente)',
                                      amount: r.amount,
                                      isRecurring: true
                                    }))
                                  ];
                                  all.sort((a, b) => a.description.localeCompare(b.description));
                                  const total = all.reduce((sum, e) => sum + Number(e.amount), 0);
                                  return (
                                    <>
                                      <h4 className="font-semibold">
                                        Lançamentos da Fatura{' '}
                                        <span className="text-xs sm:text-sm font-normal text-muted-foreground">
                                          ({start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} a {end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })})
                                        </span>
                                      </h4>
                                      <ul className="divide-y divide-border">
                                        {all.length === 0 && (
                                          <li className="py-2 text-muted-foreground">Nenhum lançamento encontrado para este mês.</li>
                                        )}
                                        {all.map(e => (
                                          <li key={e.id} className="py-2 flex justify-between items-center">
                                            <span>{e.description}</span>
                                            <span className="font-medium">R$ {Number(e.amount).toFixed(2)}</span>
                                          </li>
                                        ))}
                                      </ul>
                                      <div className="flex justify-between items-center gap-2 mt-4">
                                        <Button variant="default" className="px-3 py-1.5 text-xs sm:text-sm h-auto" onClick={() => {
                                          setSelectedInvoiceTotal(total);
                                          setSelectedInvoiceCard(invoiceDialogCard);
                                          setShowDevAlert(true);
                                          setSelectBankDialogOpen(true);
                                        }}>
                                          Registrar Pagamento
                                        </Button>
                                        <div className="flex items-center gap-1 whitespace-nowrap shrink-0 text-right">
                                          <span className="font-semibold text-xs sm:text-sm">Total Fatura:</span>
                                          <span className="font-bold text-sm sm:text-base">{formatCurrency(total)}</span>
                                        </div>
                                      </div>
                                          {/* Dialog para selecionar banco ao registrar pagamento */}
                                          <Dialog open={selectBankDialogOpen} onOpenChange={(open) => {
                                            setSelectBankDialogOpen(open);
                                            if (!open) setShowDevAlert(false);
                                          }}>
                                            <DialogContent className="max-w-md">
                                              <DialogHeader>
                                                <DialogTitle>Escolha o banco para pagamento</DialogTitle>
                                              </DialogHeader>
                                              {showDevAlert && (
                                                <div className="mb-4">
                                                  <Alert className="bg-yellow-100 border-yellow-300 text-yellow-800">
                                                    <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z" /></svg>
                                                    <AlertTitle>Em Desenvolvimento</AlertTitle>
                                                    <AlertDescription>O registro de pagamento de fatura está em desenvolvimento.</AlertDescription>
                                                  </Alert>
                                                </div>
                                              )}
                                              <div className="space-y-4">
                                                <p>Selecione o banco de onde sairá o valor da fatura:</p>
                                                <Select value={selectedBankId || ''} onValueChange={bankId => setSelectedBankId(bankId)}>
                                                  <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Selecione o banco" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {allBanks.map(bank => (
                                                      <SelectItem key={bank.id} value={bank.id}>
                                                        {bank.name} {bank.member_name ? `- ${bank.member_name}` : ''}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                                <div className="flex justify-between gap-2 mt-4">
                                                  <Button variant="secondary" onClick={() => setSelectBankDialogOpen(false)}>Cancelar</Button>
                                                  <Button
                                                    variant="default"
                                                    disabled={!selectedBankId}
                                                    onClick={async () => {
                                                      if (!selectedBankId || !selectedInvoiceCard) return;
                                                      // Filtra despesas do cartão para o período da fatura
                                                      const closingDay = selectedInvoiceCard.closing_day || 1;
                                                      const year = new Date().getFullYear();
                                                      const start = new Date(year, invoiceMonth - 1, closingDay + 1);
                                                      const end = new Date(year, invoiceMonth, closingDay);
                                                      if (end.getMonth() !== invoiceMonth % 12) end.setDate(0);
                                                      const expensesToRealize = allExpenses.filter(e => String(e.card_id) === String(selectedInvoiceCard.id) && new Date(e.date) >= start && new Date(e.date) <= end && !e.is_realized);
                                                      const totalToPay = expensesToRealize.reduce((sum, e) => sum + Number(e.amount), 0);
                                                      // Realiza todos os lançamentos não realizados
                                                      await Promise.all(expensesToRealize.map(e => updateExpense.mutateAsync({ id: e.id, is_realized: true, bank_id: selectedBankId })));
                                                      // Saldo do banco atualizado automaticamente por trigger
                                                      // await updateBankBalance.mutateAsync({ bank_id: selectedBankId, amount: -totalToPay });
                                                      // Repor valor no limite do cartão (limite disponível e utilizado)
                                                      if (selectedInvoiceCard.credit_limit != null) {
                                                        // O limite utilizado é recalculado automaticamente, mas para garantir, pode-se atualizar o limite se necessário
                                                        // Aqui não é necessário atualizar o limite do cartão, pois o cálculo é dinâmico, mas se houver lógica de "limite utilizado" persistente, atualizar aqui
                                                      }
                                                      setSelectBankDialogOpen(false);
                                                      setInvoiceDialogCard(null);
                                                      setSelectedBankId(null);
                                                    }}
                                                  >Realizar Pagamento</Button>
                                                </div>
                                              </div>
                                            </DialogContent>
                                          </Dialog>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de edição completa do cartão - fora do loop */}
      <Dialog open={!!editCard} onOpenChange={open => { if (!open) setEditCard(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cartão</DialogTitle>
          </DialogHeader>
          {editCard && (
            <form className="space-y-4" onSubmit={handleSubmitEdit(async (data) => {
              if (editCard) {
                const pendingCreditLimit = typeof data.credit_limit === 'number' ? data.credit_limit : (editCard.credit_limit ?? 0);
                const normalizedCreditLimit = clampValue(Number(pendingCreditLimit) || 0, 0, Number.POSITIVE_INFINITY);
                const desiredUsed = clampValue(manualUsedEditValue, 0, normalizedCreditLimit);
                const desiredAvailable = clampValue(manualAvailableEditValue, 0, normalizedCreditLimit);

                await updateCard.mutateAsync({
                  id: editCard.id,
                  ...data,
                  credit_limit: normalizedCreditLimit,
                  used_limit: desiredUsed,
                  available_limit: desiredAvailable
                });
                toast.success('Cartão atualizado com sucesso!');
                setEditCard(null);
              }
            })}>
              <div className="space-y-2">
                <Label htmlFor="edit-member">Membro</Label>
                <Select value={watch('member_id') || editCard.member_id} onValueChange={val => setValueEdit('member_id', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o membro" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map(member => (
                      <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errorsEdit.member_id && <p className="text-xs text-destructive">{errorsEdit.member_id.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome</Label>
                <Input id="edit-name" {...registerEdit('name')} />
                {errorsEdit.name && <p className="text-xs text-destructive">{errorsEdit.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-type">Tipo</Label>
                <Select value={registerEdit('card_type').value} onValueChange={val => setValueEdit('card_type', val)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Crédito</SelectItem>
                    <SelectItem value="debit">Débito</SelectItem>
                    <SelectItem value="both">Crédito/Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-limit">Limite</Label>
                <Input
                  id="edit-limit"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={
                    (() => {
                      const raw = watchEdit('credit_limit');
                      if (typeof raw === 'number' && !isNaN(raw)) {
                        return raw.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                      }
                      return '';
                    })()
                  }
                  onChange={e => {
                    let digits = e.target.value.replace(/\D/g, '');
                    let number = digits ? parseFloat(digits) / 100 : 0;
                    setValueEdit('credit_limit', number || undefined);
                  }}
                />
                {errorsEdit.credit_limit && <p className="text-xs text-destructive">{errorsEdit.credit_limit.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-closing">Dia de Fechamento</Label>
                <Input id="edit-closing" type="number" min={1} max={31} {...registerEdit('closing_day', { valueAsNumber: true })} />
                {errorsEdit.closing_day && <p className="text-xs text-destructive">{errorsEdit.closing_day.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-due">Dia de Vencimento</Label>
                <Input id="edit-due" type="number" min={1} max={31} {...registerEdit('due_day', { valueAsNumber: true })} />
                {errorsEdit.due_day && <p className="text-xs text-destructive">{errorsEdit.due_day.message}</p>}
              </div>
              {/* Limite utilizado e disponível (agora persistente) */}
              <div className="space-y-2">
                <Label htmlFor="edit-used-limit">Limite utilizado</Label>
                <Input
                  id="edit-used-limit"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  className="w-32"
                  value={
                    (() => {
                      if (typeof manualUsedEditValue === 'number' && !isNaN(manualUsedEditValue)) {
                        return manualUsedEditValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                      }
                      return '';
                    })()
                  }
                  onChange={e => {
                    let digits = e.target.value.replace(/\D/g, '');
                    let number = digits ? parseFloat(digits) / 100 : 0;
                    const nextValue = clampValue(number || 0, 0, editModalCreditLimit);
                    setManualUsedEditValue(nextValue);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-available-limit">Limite disponível</Label>
                <Input
                  id="edit-available-limit"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  className="w-32"
                  value={
                    (() => {
                      if (typeof manualAvailableEditValue === 'number' && !isNaN(manualAvailableEditValue)) {
                        return manualAvailableEditValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                      }
                      return '';
                    })()
                  }
                  onChange={e => {
                    let digits = e.target.value.replace(/\D/g, '');
                    let number = digits ? parseFloat(digits) / 100 : 0;
                    const nextValue = clampValue(number || 0, 0, editModalCreditLimit);
                    setManualAvailableEditValue(nextValue);
                  }}
                />
              </div>
              <Button type="submit" className="w-full">Salvar Alterações</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
