// Mapeamento de cores dos bancos e fintechs
const bankColors: Record<string, string> = {
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
import { useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useBanks, useCreateBank, useIncomes, useExpenses } from '@/hooks/useFinances';
import { useMembers } from '@/hooks/useMembers';
import { useUpdateBankBalance } from '@/hooks/useBankActions';
import { EditBankDialog } from '@/components/forms/EditBankDialog';
import { useUpdateBank, useDeleteBank } from '@/hooks/useBankMutations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/formatters';
import { Plus, Wallet, Building, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, ChevronRight, ArrowRightLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { checkSession, handleAuthError } from '@/lib/authErrorHandler';

const bankSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  account_type: z.string().optional(),
  balance: z.number().optional(),
});

type BankFormData = z.infer<typeof bankSchema>;

export default function BanksPage() {
    const [confirmDelete, setConfirmDelete] = useState<{ bankId: string; bankName: string } | null>(null);
  const navigate = useNavigate();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState<string>('');
  const [transferTo, setTransferTo] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferError, setTransferError] = useState<string>('');
  const [bankTransfers, setBankTransfers] = useState<Array<{ id: string; fromId: string; toId: string; amount: number; date: Date; fromName: string; toName: string }>>([]);
  
  const { currentMember, isAuthenticated } = useAuth();
  const { data: members = [] } = useMembers();
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>('all');
  const { data: banks = [], isLoading } = useBanks(selectedMemberId === 'all' ? undefined : selectedMemberId);
  const createBank = useCreateBank();
  const updateBankBalance = useUpdateBankBalance();
  const updateBank = useUpdateBank();
  const deleteBank = useDeleteBank();
  const [showActivity, setShowActivity] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<BankFormData>({
    resolver: zodResolver(bankSchema),
  });

  const onSubmit = async (data: BankFormData) => {
    if (!selectedMemberId) return;

    try {
      // Verifica se a sessão ainda está ativa
      const isSessionValid = await checkSession();
      if (!isSessionValid) {
        toast.error('Sua sessão expirou. Por favor, faça login novamente.');
        navigate('/');
        return;
      }

      await createBank.mutateAsync({
        member_id: selectedMemberId,
        name: data.name,
        account_type: data.account_type,
        balance: data.balance || 0,
      });
      toast.success('Banco cadastrado com sucesso!');
      reset();
      setIsAddDialogOpen(false);
    } catch (error: any) {
      const errorMsg = handleAuthError(error, () => navigate('/'));
      if (errorMsg !== 'Sessão expirada') {
        toast.error(errorMsg);
      }
    }
  };

  // Corrigir saldo dos bancos para considerar apenas entradas realizadas
  // Supondo que você tem acesso às entradas (incomes) e que cada banco tem um id
  // Se não, ajuste para buscar as entradas realizadas do banco
  const { data: allIncomes = [] } = useIncomes();
  const { data: allExpenses = [] } = useExpenses();

  type BankActivityEntry = {
    id: string;
    type: 'income' | 'expense' | 'income-removed' | 'transfer';
    description: string;
    amount: number;
    bankName: string;
    bankId: string;
    date: Date;
  };

  const bankActivityEntries = useMemo<BankActivityEntry[]>(() => {
        // Remoção de entradas realizadas
        allIncomes.forEach(income => {
          if (!income.bank_id || income.is_realized !== false || !income._deleted) return;
          const bank = banks.find(b => b.id === income.bank_id);
          if (!bank) return;
          entries.push({
            id: `income-removed-${income.id}`,
            type: 'income-removed',
            description: income.description || 'Entrada sem descrição',
            amount: Number(income.amount) || 0,
            bankName: bank.name,
            bankId: income.bank_id,
            date: safeDate(income.deleted_at, income.realized_date || income.date),
          });
        });
    const entries: BankActivityEntry[] = [];
    const safeDate = (primary?: string | null, fallback?: string | null) => {
      const value = primary || fallback;
      if (!value) return new Date();
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    };


    // Entradas realizadas
    allIncomes.forEach(income => {
      if (!income.bank_id || !income.is_realized) return;
      const bank = banks.find(b => b.id === income.bank_id);
      if (!bank) return;
      entries.push({
        id: `income-${income.id}`,
        type: 'income',
        description: income.description || 'Entrada sem descrição',
        amount: Number(income.amount) || 0,
        bankName: bank.name,
        bankId: income.bank_id,
        date: safeDate(income.realized_date, income.date),
      });
    });

    // Saídas realizadas (deduzidas do banco)
    allExpenses.forEach(expense => {
      // Caso padrão: despesa já tem bank_id
      if (expense.bank_id && expense.is_realized) {
        const bank = banks.find(b => b.id === expense.bank_id);
        if (!bank) return;
        entries.push({
          id: `expense-${expense.id}`,
          type: 'expense',
          description: expense.description || 'Despesa sem descrição',
          amount: Number(expense.amount) || 0,
          bankName: bank.name,
          bankId: expense.bank_id,
          date: safeDate(expense.realized_date, expense.date),
        });
      }
      // Caso especial: despesa realizada com banco selecionado na hora (campo auxiliar _realizeBankId)
      if (expense._realizeBankId && expense.is_realized) {
        const bank = banks.find(b => b.id === expense._realizeBankId);
        if (!bank) return;
        entries.push({
          id: `expense-deducted-${expense.id}-${expense._realizeBankId}`,
          type: 'expense',
          description: expense.description || 'Despesa sem descrição',
          amount: Number(expense.amount) || 0,
          bankName: bank.name,
          bankId: expense._realizeBankId,
          date: safeDate(expense.realized_date, expense.date),
        });
      }
    });

    // Transferências entre bancos
    bankTransfers.forEach(transfer => {
      // Registro de saída do banco de origem
      entries.push({
        id: `transfer-out-${transfer.id}`,
        type: 'transfer',
        description: `Transferência para ${transfer.toName}`,
        amount: transfer.amount,
        bankName: transfer.fromName,
        bankId: transfer.fromId,
        date: transfer.date,
      });
      // Registro de entrada no banco de destino
      entries.push({
        id: `transfer-in-${transfer.id}`,
        type: 'transfer',
        description: `Transferência de ${transfer.fromName}`,
        amount: transfer.amount,
        bankName: transfer.toName,
        bankId: transfer.toId,
        date: transfer.date,
      });
    });

    return entries
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 8);
  }, [allIncomes, allExpenses, banks, bankTransfers]);

  // O balance agora é gerenciado automaticamente pelos triggers do Supabase
  // Basta usar diretamente bank.balance

  // Função para transferir entre bancos
  const handleTransfer = async () => {
    setTransferError('');
    
    if (!transferFrom || !transferTo) {
      setTransferError('Selecione os bancos de origem e destino');
      return;
    }
    
    if (transferFrom === transferTo) {
      setTransferError('Os bancos de origem e destino devem ser diferentes');
      return;
    }
    
    if (transferAmount <= 0) {
      setTransferError('Informe um valor maior que zero');
      return;
    }
    
    const bankFrom = banks.find(b => b.id === transferFrom);
    if (!bankFrom || bankFrom.balance < transferAmount) {
      setTransferError('Saldo insuficiente no banco de origem');
      return;
    }

    try {
      const bankToName = banks.find(b => b.id === transferTo)?.name || 'Banco desconhecido';
      const bankFromName = bankFrom.name;

      // Deduz do banco de origem
      await updateBankBalance.mutateAsync({ 
        bank_id: transferFrom, 
        amount: -transferAmount 
      });
      
      // Soma no banco de destino
      await updateBankBalance.mutateAsync({ 
        bank_id: transferTo, 
        amount: transferAmount 
      });

      // Adiciona o registro da transferência ao log
      setBankTransfers(prev => [...prev, {
        id: `transfer-${Date.now()}`,
        fromId: transferFrom,
        toId: transferTo,
        amount: transferAmount,
        date: new Date(),
        fromName: bankFromName,
        toName: bankToName,
      }]);

      setIsTransferDialogOpen(false);
      setTransferFrom('');
      setTransferTo('');
      setTransferAmount(0);
      toast.success('Transferência realizada com sucesso!');
    } catch (error: any) {
      setTransferError(error.message || 'Erro ao realizar transferência');
    }
  };

  const totalBalance = banks.reduce((sum, b) => sum + (b.balance || 0), 0);

  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Building className="w-16 h-16 text-primary mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Cadastre seus Bancos
          </h1>
          <p className="text-muted-foreground mb-6">
            Faça login para gerenciar suas contas bancárias
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
            <div className="w-10 h-10 rounded-xl gradient-banks flex items-center justify-center flex-shrink-0">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                Bancos
              </h1>
              <p className="text-muted-foreground">
                Gerencie suas contas bancárias
              </p>
            </div>
          </div>
          {/* Mobile Header Box */}
          <div className="sm:hidden flex flex-col items-center gap-3 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-xl p-4 border border-blue-300 dark:border-blue-700 shadow-sm w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-banks flex items-center justify-center flex-shrink-0">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                Bancos
              </h1>
            </div>
            <p className="text-muted-foreground text-center text-sm">
              Gerencie suas contas bancárias
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {/* Botão Transferir */}
            <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Transferir entre bancos
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Transferir entre bancos</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Banco de origem</Label>
                    <Select value={transferFrom} onValueChange={setTransferFrom}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o banco de origem" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map(bank => (
                          <SelectItem key={bank.id} value={bank.id}>
                            {bank.name} ({formatCurrency(bank.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Banco de destino</Label>
                    <Select value={transferTo} onValueChange={setTransferTo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o banco de destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map(bank => (
                          <SelectItem key={bank.id} value={bank.id}>
                            {bank.name} ({formatCurrency(bank.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input 
                      inputMode="numeric" 
                      placeholder="R$ 0,00"
                      value={
                        (() => {
                          if (transferAmount && !isNaN(transferAmount)) {
                            return transferAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                          }
                          return '';
                        })()
                      }
                      onChange={e => {
                        let digits = e.target.value.replace(/\D/g, '');
                        let number = digits ? parseFloat(digits) / 100 : 0;
                        setTransferAmount(number || 0);
                      }}
                    />
                  </div>
                  
                  {transferError && (
                    <div className="p-3 bg-destructive/10 border border-destructive rounded-md text-destructive text-sm">
                      {transferError}
                    </div>
                  )}
                  
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setIsTransferDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleTransfer}>Transferir</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Botão Novo Banco */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Banco
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar Banco</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Membro da Família</Label>
                  <Select
                    onValueChange={value => {
                      setSelectedMemberId(value);
                    }}
                    defaultValue={selectedMemberId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Banco</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder="Ex: Nubank, Itaú"
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Conta</Label>
                  <Select onValueChange={(value) => setValue('account_type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Conta Corrente</SelectItem>
                      <SelectItem value="savings">Poupança</SelectItem>
                      <SelectItem value="digital">Conta Digital</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="balance">Saldo Atual</Label>
                  <Input
                    id="balance"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={
                      (() => {
                        const raw = watch('balance');
                        if (typeof raw === 'number' && !isNaN(raw)) {
                          return raw.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        }
                        return '';
                      })()
                    }
                    onChange={e => {
                      let digits = e.target.value.replace(/\D/g, '');
                      let number = digits ? parseFloat(digits) / 100 : 0;
                      setValue('balance', number || undefined);
                    }}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={createBank.isPending}>
                  {createBank.isPending ? 'Cadastrando...' : 'Cadastrar Banco'}
                </Button>
              </form>
              </DialogContent>
            </Dialog>
          </div>
          </div>

        {/* Total Card */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 w-full sm:w-auto text-center sm:text-left">
              <div className="w-12 h-12 rounded-xl bg-blue-800 flex items-center justify-center flex-shrink-0">
                <Building className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo Total em Bancos</p>
                <p className="text-2xl font-bold text-blue-800">{formatCurrency(totalBalance)}</p>
              </div>
            </div>
            <div className="w-full lg:w-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <Label className="text-sm">Filtrar por membro</Label>
              <Select
                value={selectedMemberId ?? 'all'}
                onValueChange={value => setSelectedMemberId(value === 'all' ? undefined : value)}
              >
                <SelectTrigger className="w-full sm:w-56">
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
        </div>

        {bankActivityEntries.length > 0 && (
          <div className="glass-card rounded-2xl">
            <button
              className="w-full flex items-center justify-between px-6 py-5 focus:outline-none"
              onClick={() => setShowActivity(prev => !prev)}
              aria-expanded={showActivity}
              aria-controls="bank-activity-panel"
            >
              <div className="flex items-center gap-3 text-left">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary transition-transform ${showActivity ? 'rotate-90' : ''}`}>
                  <ChevronRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-semibold text-foreground">Movimentações recentes</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">Tudo o que impactou seus saldos bancários</p>
                </div>
              </div>
              <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide">
                {showActivity ? 'ocultar' : `ver últimas ${bankActivityEntries.length}`}
              </span>
            </button>
            {showActivity && (
              <div id="bank-activity-panel" className="px-6 pb-6 space-y-4">
                <ul className="divide-y divide-border">
                  {bankActivityEntries.map(entry => {
                    const isIncome = entry.type === 'income';
                    const isIncomeRemoved = entry.type === 'income-removed';
                    const isExpense = entry.type === 'expense';
                    const isTransfer = entry.type === 'transfer';
                    const formattedDate = entry.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
                    const formattedTime = entry.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <li key={entry.id} className="py-3 flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isIncome ? 'bg-emerald-100 text-emerald-700' : isIncomeRemoved ? 'bg-yellow-100 text-yellow-700' : isTransfer ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                          {isIncome ? <ArrowDownLeft className="w-5 h-5" /> : isIncomeRemoved ? <ArrowUpRight className="w-5 h-5" /> : isTransfer ? <ArrowRightLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {isIncome && `Entrada realizada • ${entry.description}`}
                            {isExpense && `Despesa realizada • ${entry.description}`}
                            {isIncomeRemoved && `Entrada removida • ${entry.description}`}
                            {isTransfer && `Transferência • ${entry.description}`}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {formatCurrency(entry.amount)} {isIncome
                              ? 'adicionado ao saldo do banco'
                              : isIncomeRemoved
                                ? 'removido e saldo deduzido do banco'
                                : isTransfer
                                  ? 'transferido'
                                  : 'deduzido do saldo do banco'} {entry.bankName}
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

        {/* Banks List */}
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
        ) : banks.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Building className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhum banco cadastrado
            </h3>
            <p className="text-muted-foreground mb-6">
              Cadastre suas contas bancárias para acompanhar seus saldos
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Banco
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {banks.map((bank, index) => (
              <div
                key={bank.id}
                className="glass-card rounded-2xl p-6 animate-fade-in hover:shadow-xl transition-shadow"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#F5F5F5' }}>
                      <Building
                        className="w-6 h-6"
                        style={{ color: bankColors[bank.name.trim()] || '#8A05BE' }}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{bank.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {bank.account_type === 'checking' && 'Conta Corrente'}
                        {bank.account_type === 'savings' && 'Poupança'}
                        {bank.account_type === 'digital' && 'Conta Digital'}
                        {!bank.account_type && 'Conta'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{(members.find(m => m.id === bank.member_id)?.name?.split(' ')[0]) || 'Desconhecido'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <EditBankDialog
                      bank={bank}
                      onUpdate={async (bankId, data) => {
                        await updateBank.mutateAsync({ bankId, data });
                      }}
                      trigger={<Button variant="ghost" size="icon" className="hover:bg-blue-100"><Pencil className="w-5 h-5 text-muted-foreground" /></Button>}
                      onDelete={async (bankId) => {
                        setConfirmDelete({ bankId, bankName: bank.name });
                      }}
                    />
                    <Button variant="ghost" size="icon" className="hover:bg-red-100" onClick={() => setConfirmDelete({ bankId: bank.id, bankName: bank.name })}>
                      <Trash2 className="w-5 h-5 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="pt-4 border-t border-border flex flex-row items-center justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <p className="text-sm text-muted-foreground">Saldo</p>
                    <p
                      className={`font-bold ${(bank.balance || 0) >= 0 ? 'text-income' : 'text-expense'}`}
                      style={{
                        fontSize: '1.1rem',
                        width: '100%',
                        wordBreak: 'break-all',
                        textAlign: 'left',
                        lineHeight: 1.1,
                        margin: 0,
                        letterSpacing: '-1px',
                      }}
                      title={formatCurrency(bank.balance || 0)}
                    >
                      {formatCurrency(bank.balance || 0)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Pop-up de confirmação de exclusão */}
        {confirmDelete && (
          <Dialog open={true} onOpenChange={() => setConfirmDelete(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Excluir Banco</DialogTitle>
              </DialogHeader>
              <p>Tem certeza que deseja excluir o banco <b>{confirmDelete.bankName}</b>?</p>
              <div className="flex gap-2 mt-4">
                <Button variant="destructive" onClick={async () => {
                  await deleteBank.mutateAsync(confirmDelete.bankId);
                  setConfirmDelete(null);
                }}>Excluir</Button>
                <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </MainLayout>
  );
}
