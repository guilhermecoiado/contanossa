import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate, calculateRemainingMonths } from '@/lib/formatters';
import { Plus, FileText, Pencil, Trash2, TrendingUp, TrendingDown, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { checkSession, handleAuthError } from '@/lib/authErrorHandler';
import { useDebts, useCreateDebt, useCloseDebt, useDeleteDebt, useUpdateDebt } from '@/hooks/useDebts';
import { useCreateExpense, useExpenses, useBanks } from '@/hooks/useFinances';
import { Debt } from '@/types/finance';
import { useMembers, useIncomeSources } from '@/hooks/useMembers';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CategorySelector } from '@/components/CategorySelector';
import { TagSelector } from '@/components/TagSelector';
import { useCustomCategories } from '@/hooks/useCustomCategoriesAndTags';
import { supabase } from '@/integrations/supabase/client';

function getTodayLocalISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const debtSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  type: z.string().min(1, 'Tipo obrigatório'),
  custom_type: z.string().optional(),
  initial_value: z.number().min(0),
  current_value: z.number().min(0),
  start_date: z.string().optional(),
  end_date: z.string().min(1, 'Data de fim obrigatória'),
  notes: z.string().optional(),
  member_id: z.string().min(1, 'Selecione o membro'),
  tags: z.array(z.string()).optional().default([]),
});

type DebtFormData = z.infer<typeof debtSchema>;

export default function DebtsPage() {
  // Estado para modal de lançamento de saída
  const [launchDialogOpen, setLaunchDialogOpen] = React.useState(false);
  const [debtToLaunch, setDebtToLaunch] = React.useState<Debt | null>(null);
  const [launchType, setLaunchType] = React.useState<'realizada' | 'nao_realizada' | null>(null);
  const [realizeDate, setRealizeDate] = React.useState(() => getTodayLocalISO());
  const [selectedBankId, setSelectedBankId] = React.useState<string>('');
    // Bancos do membro da dívida selecionada para lançamento
    const memberIdForBanks = debtToLaunch?.member_id || undefined;
    const { data: banks = [] } = useBanks(memberIdForBanks);
  const createExpense = useCreateExpense();
  const updateDebt = useUpdateDebt();
  const deleteDebt = useDeleteDebt();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [debtToDelete, setDebtToDelete] = React.useState<string | null>(null);
  const [isIncomeBalanceOpen, setIsIncomeBalanceOpen] = React.useState(true);
  const [selectedMemberId, setSelectedMemberId] = React.useState<string | undefined>('all');
  const { data: members = [] } = useMembers();
  const { data: incomeSources = [] } = useIncomeSources(selectedMemberId && selectedMemberId !== 'all' ? selectedMemberId : undefined);
  const { data: customDebtCategories = [] } = useCustomCategories('debt');
  const defaultDebtTypes: Array<{ value: string; label: string }> = [
    { value: 'boleto', label: 'Boleto' },
    { value: 'emprestimo', label: 'Empréstimo' },
    { value: 'financiamento', label: 'Financiamento' },
    { value: 'acordo', label: 'Acordo' },
    { value: 'cartao', label: 'Cartão de Crédito' },
  ];
  const defaultDebtLabelMap = defaultDebtTypes.reduce((acc, item) => {
    acc[item.value] = item.label;
    return acc;
  }, {} as Record<string, string>);

  const getDebtCategoryLabel = (type: string, customType?: string | null) => {
    if (defaultDebtLabelMap[type]) return defaultDebtLabelMap[type];
    const custom = customDebtCategories.find(c => c.id === type);
    if (custom) return custom.name;
    if (type === 'outro' && customType) return customType;
    return type;
  };

  const getDebtCategoryValue = (type?: string) => {
    if (!type) return '';
    if (type.startsWith('custom:') || type.startsWith('default:')) return type;
    if (defaultDebtLabelMap[type]) return `default:${type}`;
    return `custom:${type}`;
  };

  const parseDebtCategoryValue = (value: string) => {
    if (value.startsWith('custom:')) return value.replace('custom:', '');
    if (value.startsWith('default:')) return value.replace('default:', '');
    return value;
  };
  const navigate = useNavigate();
  const { currentMember, isAuthenticated } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editDebt, setEditDebt] = React.useState<Debt | null>(null);
  const { data: debts = [], isLoading } = useDebts(selectedMemberId && selectedMemberId !== 'all' ? selectedMemberId : undefined);
  const { data: allExpenses = [] } = useExpenses(selectedMemberId && selectedMemberId !== 'all' ? selectedMemberId : undefined);
  const createDebt = useCreateDebt();
  const closeDebt = useCloseDebt();
  const [debtTagsMap, setDebtTagsMap] = React.useState<Record<string, Array<{ id: string; name: string; color: string }>>>({});

  React.useEffect(() => {
    const loadDebtTags = async () => {
      if (!debts.length) {
        setDebtTagsMap({});
        return;
      }

      const debtIds = debts.map((debt) => debt.id);
      const { data, error } = await supabase
        .from('debt_tags')
        .select('debt_id, tag:custom_tags(id, name, color)')
        .in('debt_id', debtIds);

      if (error) {
        console.error('Erro ao carregar tags das dividas:', error);
        return;
      }

      const map: Record<string, Array<{ id: string; name: string; color: string }>> = {};
      (data || []).forEach((row: any) => {
        if (!row?.debt_id || !row?.tag) return;
        if (!map[row.debt_id]) map[row.debt_id] = [];
        map[row.debt_id].push({
          id: row.tag.id,
          name: row.tag.name,
          color: row.tag.color,
        });
      });
      setDebtTagsMap(map);
    };

    loadDebtTags();
  }, [debts]);

  // Formulário
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<DebtFormData>({
    resolver: zodResolver(debtSchema),
    defaultValues: { initial_value: 0, current_value: 0, member_id: currentMember?.id, tags: [] },
  });
  const selectedType = watch('type');
  const selectedTags = watch('tags') || [];

  // Preencher formulário ao editar e limpar ao criar nova dívida
  React.useEffect(() => {
    if (editDebt) {
      reset({
        name: editDebt.name,
        type: editDebt.type,
        custom_type: editDebt.custom_type || '',
        initial_value: editDebt.initial_value,
        current_value: editDebt.current_value,
        start_date: editDebt.start_date || '',
        end_date: editDebt.end_date || '',
        notes: editDebt.notes || '',
        member_id: editDebt.member_id,
        tags: [],
      });
      setIsAddDialogOpen(true);
    }
  }, [editDebt, reset]);

  // Limpar formulário ao abrir para nova dívida
  React.useEffect(() => {
    if (isAddDialogOpen && !editDebt) {
      reset({
        name: '',
        type: '',
        custom_type: '',
        initial_value: 0,
        current_value: 0,
        start_date: '',
        end_date: '',
        notes: '',
        member_id: currentMember?.id || '',
        tags: [],
      });
    } else if (!isAddDialogOpen && !editDebt) {
      // Limpar também ao fechar se não for editar
      reset({
        name: '',
        type: '',
        custom_type: '',
        initial_value: 0,
        current_value: 0,
        start_date: '',
        end_date: '',
        notes: '',
        member_id: currentMember?.id || '',
        tags: [],
      });
    }
  }, [isAddDialogOpen, editDebt, reset, currentMember]);

  React.useEffect(() => {
    const loadDebtTags = async (debtId: string) => {
      const { data, error } = await supabase
        .from('debt_tags')
        .select('tag_id')
        .eq('debt_id', debtId);

      if (error) {
        console.error('Erro ao carregar tags da dívida:', error);
        return;
      }

      const tagIds = (data || []).map(item => item.tag_id);
      setValue('tags', tagIds);
    };

    if (editDebt?.id) {
      loadDebtTags(editDebt.id);
    }
  }, [editDebt?.id, setValue]);

  // Submit real para Supabase
  const onSubmit = async (data: DebtFormData) => {
    try {
      // Verifica se a sessão ainda está ativa
      const isSessionValid = await checkSession();
      if (!isSessionValid) {
        toast.error('Sua sessão expirou. Por favor, faça login novamente.');
        navigate('/');
        return;
      }

      const replaceDebtTags = async (debtId: string, tagIds: string[]) => {
        await supabase
          .from('debt_tags')
          .delete()
          .eq('debt_id', debtId);

        if (!tagIds || tagIds.length === 0) return;

        const rows = tagIds.map(tagId => ({ debt_id: debtId, tag_id: tagId }));
        const { error } = await supabase.from('debt_tags').insert(rows);
        if (error) throw error;
      };

      if (editDebt) {
        await updateDebt.mutateAsync({
          ...data,
          id: editDebt.id,
        });
        await replaceDebtTags(editDebt.id, selectedTags);
        toast.success('Dívida atualizada!');
      } else {
        const createdDebt = await createDebt.mutateAsync({
          name: data.name,
          type: data.type,
          custom_type: data.custom_type ?? null,
          initial_value: data.initial_value,
          current_value: data.current_value,
          start_date: data.start_date || getTodayLocalISO(),
          end_date: data.end_date || null,
          notes: data.notes ?? null,
          member_id: data.member_id,
        });
        if (createdDebt?.id) {
          await replaceDebtTags(createdDebt.id, selectedTags);
        }
        toast.success('Dívida cadastrada!');
      }
      reset();
      setIsAddDialogOpen(false);
      setEditDebt(null);
    } catch (error: any) {
      const errorMsg = handleAuthError(error, () => navigate('/'));
      if (errorMsg !== 'Sessão expirada') {
        toast.error(errorMsg);
      }
    }
  };

  // Lógica de finalização automática
  const today = new Date();

  // Filtra dívidas conforme membro selecionado
  const filteredDebts = selectedMemberId && selectedMemberId !== 'all'
    ? debts.filter(d => d.member_id === selectedMemberId)
    : debts;

  const debtsWithStatus = filteredDebts.map(debt => {
    const isFinalized = debt.end_date && new Date(debt.end_date) <= today && debt.status === 'open';
    return { ...debt, isFinalized };
  });

  const closedDebts = filteredDebts.filter(d => d.status === 'closed');

  const handleCloseDebt = async (id: string) => {
    try {
      await closeDebt.mutateAsync(id);
      toast.success('Dívida encerrada!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao encerrar dívida');
    }
  };

  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <FileText className="w-16 h-16 text-primary mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Cadastre suas Dívidas</h1>
          <p className="text-muted-foreground mb-6">Faça login para gerenciar suas dívidas</p>
          <Button onClick={() => navigate('/members')}>Ir para Membros</Button>
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
            <div className="w-10 h-10 rounded-xl gradient-debts flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Dívidas</h1>
              <p className="text-muted-foreground">Acompanhe suas dívidas e pagamentos</p>
            </div>
          </div>
          {/* Mobile Header Box */}
          <div className="sm:hidden flex flex-col items-center gap-3 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 rounded-xl p-4 border border-orange-200 dark:border-orange-800 shadow-sm w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-debts flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Dívidas</h1>
            </div>
            <p className="text-muted-foreground text-center text-sm">Acompanhe suas dívidas e pagamentos</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />Nova Dívida
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100%-1rem)] max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Dívida</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="member_id">Membro</Label>
                  <Select
                    value={watch('member_id')}
                    onValueChange={value => setValue('member_id', value, { shouldValidate: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o membro" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map(member => (
                        <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.member_id && <p className="text-xs text-destructive">{errors.member_id.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" {...register('name')} placeholder="Ex: Empréstimo Banco" />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <CategorySelector
                    type="debt"
                    value={getDebtCategoryValue(selectedType)}
                    onChange={(value) => setValue('type', parseDebtCategoryValue(value), { shouldValidate: true })}
                    placeholder="Selecione uma categoria"
                    defaultCategories={[
                      { value: 'default:boleto', label: 'Boleto' },
                      { value: 'default:emprestimo', label: 'Empréstimo' },
                      { value: 'default:financiamento', label: 'Financiamento' },
                      { value: 'default:acordo', label: 'Acordo' },
                      { value: 'default:cartao', label: 'Cartão de Crédito' },
                    ]}
                  />
                  {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Tags (Opcional)</Label>
                  <TagSelector
                    selected={selectedTags}
                    onAddTag={(tagId) => {
                      if (!selectedTags.includes(tagId)) {
                        setValue('tags', [...selectedTags, tagId]);
                      }
                    }}
                    onRemoveTag={(tagId) => {
                      setValue('tags', selectedTags.filter(id => id !== tagId));
                    }}
                    maxTags={5}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="initial_value">Valor Inicial</Label>
                    <Input
                      id="initial_value"
                      inputMode="numeric"
                      placeholder="R$ 0,00"
                      value={
                        (() => {
                          const raw = watch('initial_value');
                          if (typeof raw === 'number' && !isNaN(raw)) {
                            return raw.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                          }
                          return '';
                        })()
                      }
                      onChange={e => {
                        let digits = e.target.value.replace(/\D/g, '');
                        let number = digits ? parseFloat(digits) / 100 : 0;
                        setValue('initial_value', number || undefined);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="current_value">Valor Atual</Label>
                    <Input
                      id="current_value"
                      inputMode="numeric"
                      placeholder="R$ 0,00"
                      value={
                        (() => {
                          const raw = watch('current_value');
                          if (typeof raw === 'number' && !isNaN(raw)) {
                            return raw.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                          }
                          return '';
                        })()
                      }
                      onChange={e => {
                        let digits = e.target.value.replace(/\D/g, '');
                        let number = digits ? parseFloat(digits) / 100 : 0;
                        setValue('current_value', number || undefined);
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data de Início</Label>
                  <Input id="start_date" type="date" {...register('start_date')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">Data de Fim</Label>
                  <Input id="end_date" type="date" {...register('end_date')} />
                  {errors.end_date && <p className="text-xs text-destructive">{errors.end_date.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea id="notes" {...register('notes')} placeholder="Anotações sobre a dívida..." />
                </div>
                <Button type="submit" className="w-full">{editDebt ? 'Salvar Alterações' : 'Cadastrar Dívida'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Box de total de dívidas - padrão Entradas/Saídas */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 w-full sm:w-auto text-center sm:text-left">
              <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Dívidas</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(debtsWithStatus.reduce((acc, d) => acc + (Number(d.current_value) || 0), 0))}
                </p>
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

        {/* Card Rendas x Dívidas */}
        <div>
          {(() => {
            const totalDebts = debtsWithStatus.reduce((acc, d) => acc + (Number(d.current_value) || 0), 0);
            const totalFixedIncomes = incomeSources
              .filter(source => source.is_fixed)
              .reduce((sum, source) => sum + (source.amount || 0), 0);
            const difference = totalFixedIncomes - totalDebts;
            const isPositive = difference >= 0;

            return (
              <Alert className={cn("border-2 rounded-2xl p-3 sm:p-6 cursor-pointer hover:shadow-md transition-shadow", isPositive ? "bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800")} onClick={() => setIsIncomeBalanceOpen(!isIncomeBalanceOpen)}>
                <div className="flex items-center justify-between gap-2 sm:gap-6">
                  <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    <div className={cn("w-8 h-8 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0", isPositive ? "bg-green-100 dark:bg-green-900/50" : "bg-red-100 dark:bg-red-900/50")}>
                      {isPositive ? (
                        <TrendingUp className={cn("w-6 h-6", isPositive ? "text-green-600" : "text-red-600")} />
                      ) : (
                        <TrendingDown className={cn("w-6 h-6", isPositive ? "text-green-600" : "text-red-600")} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] sm:text-sm font-medium text-muted-foreground leading-tight">Saldo Rendas Fixas x Dívidas</p>
                      <p className={cn("text-base sm:text-2xl font-bold break-all leading-tight", isPositive ? "text-green-600 dark:text-green-300" : "text-red-600 dark:text-red-300")}>
                        {formatCurrency(Math.abs(difference))}
                      </p>
                      <p className={cn("text-[11px] mt-0.5 sm:mt-1 leading-tight", isPositive ? "text-green-700 dark:text-green-200" : "text-red-700 dark:text-red-200")}>
                        {isPositive ? "✓ Você tem saldo positivo" : "⚠ Você tem saldo negativo"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                    {isIncomeBalanceOpen && (
                      <div className="text-right pr-1 sm:pr-2 max-w-[90px] sm:max-w-none">
                        <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Rendas Fixas</p>
                        <p className="text-xs sm:text-lg font-semibold text-income break-all leading-tight">{formatCurrency(totalFixedIncomes)}</p>
                      </div>
                    )}
                    <button className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-lg transition-colors flex-shrink-0" onClick={(e) => { e.stopPropagation(); setIsIncomeBalanceOpen(!isIncomeBalanceOpen); }}>
                      {isIncomeBalanceOpen ? (
                        <Eye className={cn("w-5 h-5", isPositive ? "text-green-600" : "text-red-600")} />
                      ) : (
                        <EyeOff className={cn("w-5 h-5", isPositive ? "text-green-600" : "text-red-600")} />
                      )}
                    </button>
                  </div>
                </div>
              </Alert>
            );
          })()}
        </div>

        {/* Painel de Dívidas Abertas */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Dívidas Abertas</h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2].map(i => (
                <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
                  <div className="space-y-4">
                    <div className="h-4 w-32 bg-secondary rounded" />
                    <div className="h-8 w-24 bg-secondary rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : debtsWithStatus.filter(d => d.status === 'open').length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma dívida cadastrada</h3>
              <p className="text-muted-foreground mb-6">Cadastre suas dívidas para acompanhar seus pagamentos</p>
              <Button onClick={() => setIsAddDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Cadastrar Dívida</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {debtsWithStatus.filter(d => d.status === 'open').map((debt, index) => {
                const diff = Number(debt.current_value) - Number(debt.initial_value);
                const diffPct = Number(debt.initial_value) > 0 ? (diff / Number(debt.initial_value)) * 100 : 0;
                const tags = debtTagsMap[debt.id] || [];
                // Encontrar o último lançamento desta dívida
                const lastLaunch = allExpenses
                  .filter(e => e.description.includes(debt.name))
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                return (
                  <div key={debt.id} className={cn("glass-card rounded-2xl p-6 animate-fade-in hover:shadow-xl transition-shadow relative", debt.isFinalized && 'bg-green-100 border-green-400')} style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="inline-block mb-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                          {members.find(m => m.id === debt.member_id)?.name || 'Membro'}
                        </div>
                        <h3 className="font-semibold text-foreground">{debt.name}</h3>
                        <p className="text-sm text-muted-foreground">{getDebtCategoryLabel(debt.type, debt.custom_type)}</p>
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
                      <div className="flex items-center gap-4">
                        {debt.isFinalized && (<span className="px-2 py-1 rounded bg-green-200 text-green-800 text-xs font-semibold">Dívida finalizada</span>)}
                        {diff !== 0 && (
                          <div className={cn('text-xs font-medium px-2 py-1 rounded-full', diff >= 0 ? 'bg-expense/10 text-expense' : 'bg-income/10 text-income')}>
                            {diff >= 0 ? '+' : ''}{diffPct.toFixed(1)}%
                          </div>
                        )}
                        {/* Botões de edição e exclusão */}
                        <button type="button" className="p-0.5" title="Editar dívida" onClick={() => setEditDebt(debt)}>
                          <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                        </button>
                        <button
                          type="button"
                          className="p-0.5"
                          title="Excluir dívida"
                          onClick={() => {
                            setDebtToDelete(debt.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive hover:text-red-700 transition-colors" />
                        </button>
                        {/* Confirmação de exclusão */}
                        <Dialog open={deleteDialogOpen && debtToDelete === debt.id} onOpenChange={open => {
                          setDeleteDialogOpen(open);
                          if (!open) setDebtToDelete(null);
                        }}>
                          <DialogContent aria-describedby="delete-debt-desc">
                            <DialogHeader>
                              <DialogTitle>Excluir dívida?</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <p id="delete-debt-desc">Tem certeza que deseja excluir esta dívida? Esta ação não poderá ser desfeita.</p>
                              <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
                                <Button
                                  variant="destructive"
                                  onClick={async () => {
                                    if (debtToDelete) {
                                      try {
                                        await deleteDebt.mutateAsync(debtToDelete);
                                        toast.success('Dívida excluída com sucesso!');
                                      } catch (error: any) {
                                        toast.error(error.message || 'Erro ao excluir dívida');
                                      }
                                      setDeleteDialogOpen(false);
                                      setDebtToDelete(null);
                                    }
                                  }}
                                  disabled={deleteDebt.isPending}
                                >
                                  Excluir
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                    <div className="space-y-2 pb-12">
                                          <Button
                                            className="absolute bottom-4 right-4 gradient-expense text-expense-foreground shadow-lg"
                                            onClick={() => {
                                              setDebtToLaunch(debt);
                                              setLaunchDialogOpen(true);
                                            }}
                                          >
                                            Lançar Dívida
                                          </Button>
                            {/* Modal de lançamento de saída */}
                            <Dialog open={launchDialogOpen} onOpenChange={open => {
                              setLaunchDialogOpen(open);
                              if (!open) {
                                setDebtToLaunch(null);
                                setLaunchType(null);
                              }
                            }}>
                              <DialogContent aria-describedby="launch-debt-desc">
                                <DialogHeader>
                                  <DialogTitle>Lançar Dívida em Saídas</DialogTitle>
                                  <div className="mt-6" />
                                </DialogHeader>
                                <div className="space-y-6">
                                  <p id="launch-debt-desc" className="text-base">Ao confirmar, a dívida será lançada em "Saídas". Deseja lançar como?</p>
                                  <div>
                                    <label className="block text-sm font-medium mb-1">Tipo de lançamento</label>
                                    <Select value={launchType ?? ''} onValueChange={v => setLaunchType(v as 'realizada' | 'nao_realizada')}>
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecione o tipo" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="realizada">Realizada</SelectItem>
                                        <SelectItem value="nao_realizada">Não Realizada</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {launchType === 'realizada' && (
                                    <>
                                      <div>
                                        <label className="block text-sm font-medium mb-1">Data de realização:</label>
                                        <input
                                          type="date"
                                          className="input w-full bg-background text-foreground border border-border mb-2"
                                          value={realizeDate}
                                          max={getTodayLocalISO()}
                                          onChange={e => setRealizeDate(e.target.value)}
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium mb-1">Banco para deduzir saldo:</label>
                                        <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                                          <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Selecione o banco" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {banks.length === 0 && (
                                              <SelectItem value="" disabled>Nenhum banco encontrado</SelectItem>
                                            )}
                                            {banks.map((bank) => (
                                              <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </>
                                  )}
                                  <div className="flex gap-2 justify-end">
                                    <Button variant="outline" onClick={() => setLaunchDialogOpen(false)}>Cancelar</Button>
                                    <Button
                                      onClick={async () => {
                                        if (!debtToLaunch || !launchType) return;
                                        if (launchType === 'realizada' && !selectedBankId) {
                                          toast.error('Selecione o banco para deduzir o saldo.');
                                          return;
                                        }
                                        try {
                                          await createExpense.mutateAsync({
                                            member_id: debtToLaunch.member_id,
                                            amount: debtToLaunch.current_value,
                                            description: `Dívida: ${debtToLaunch.name}`,
                                            date: launchType === 'realizada' ? realizeDate : getTodayLocalISO(),
                                            is_recurring: false,
                                            is_realized: launchType === 'realizada',
                                            realized_date: launchType === 'realizada' ? realizeDate : undefined,
                                            bank_id: launchType === 'realizada' ? selectedBankId : undefined,
                                          });
                                          setLaunchDialogOpen(false);
                                          setDebtToLaunch(null);
                                          setLaunchType(null);
                                          setSelectedBankId('');
                                          toast.success('Dívida lançada em Saídas!');
                                        } catch (error: any) {
                                          toast.error(error.message || 'Erro ao lançar dívida em Saídas');
                                        }
                                      }}
                                      disabled={!launchType || (launchType === 'realizada' && (!realizeDate || !selectedBankId))}
                                    >
                                      Confirmar
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                      <div>
                        <p className="text-sm text-muted-foreground">Valor Atual</p>
                        <p className="text-2xl font-bold text-foreground">{formatCurrency(Number(debt.current_value))}</p>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-border">
                        <div>
                          <p className="text-muted-foreground">Valor Inicial</p>
                          <p className="font-medium">{formatCurrency(Number(debt.initial_value))}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-3 text-xs">
                        {debt.start_date && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Desde:</span> {formatDate(debt.start_date)}
                          </p>
                        )}
                        {debt.end_date && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Até:</span> {formatDate(debt.end_date)}
                          </p>
                        )}
                        {lastLaunch && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Último Lançamento:</span> {formatDate(lastLaunch.date)}
                          </p>
                        )}
                      </div>
                      {debt.start_date && debt.end_date && debt.status === 'open' && (
                        (() => {
                          const monthsLeft = calculateRemainingMonths(new Date(), debt.end_date);
                          return monthsLeft !== null && monthsLeft >= 0 ? (
                            <span className="inline-block mt-2 px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-semibold">
                              Restam {monthsLeft === 1 ? '1 mês' : `${monthsLeft} meses`}
                            </span>
                          ) : null;
                        })()
                      )}
                      {debt.isFinalized && (
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => handleCloseDebt(debt.id)}>
                          Fechar dívida
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Painel de Dívidas Encerradas */}
        {closedDebts.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold mb-4 text-green-700">Dívidas Encerradas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {closedDebts.map((debt, index) => {
                const tags = debtTagsMap[debt.id] || [];
                const lastLaunch = allExpenses
                  .filter(e => e.description.includes(debt.name))
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                return (
                  <div key={debt.id} className="glass-card rounded-2xl p-6 bg-green-100 border-green-400 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-foreground">{debt.name}</h3>
                        <p className="text-sm text-muted-foreground">{getDebtCategoryLabel(debt.type, debt.custom_type)}</p>
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
                      <span className="px-2 py-1 rounded bg-green-200 text-green-800 text-xs font-semibold">Dívida encerrada</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Valor Atual</p>
                        <p className="text-2xl font-bold text-foreground">{formatCurrency(Number(debt.current_value))}</p>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-border">
                        <div>
                          <p className="text-muted-foreground">Valor Inicial</p>
                          <p className="font-medium">{formatCurrency(Number(debt.initial_value))}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-3 text-xs">
                        {debt.start_date && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Desde:</span> {formatDate(debt.start_date)}
                          </p>
                        )}
                        {debt.end_date && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Até:</span> {formatDate(debt.end_date)}
                          </p>
                        )}
                        {lastLaunch && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Último Lançamento:</span> {formatDate(lastLaunch.date)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}