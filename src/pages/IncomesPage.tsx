import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { IncomeForm } from '@/components/forms/IncomeForm';
import { useAuth } from '@/contexts/AuthContext';
import { useIncomes } from '@/hooks/useFinances';
import { useIncomeSources, useMembers } from '@/hooks/useMembers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Plus, TrendingUp, ChevronLeft, ChevronRight, Pencil, Trash2, DollarSign } from 'lucide-react';
import { useDeleteIncome, useUpdateIncome } from '@/hooks/useIncomeActions';
import { useUpdateBankBalance } from '@/hooks/useBankActions';
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
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function IncomesPage() {
  // Estado para pop-up de realização
  const [incomeToRealize, setIncomeToRealize] = useState(null);
  const [realizeDate, setRealizeDate] = useState('');
  const updateIncome = useUpdateIncome();
  const updateBankBalance = useUpdateBankBalance();
  const [editIncome, setEditIncome] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [incomeToDelete, setIncomeToDelete] = useState(null);
  const deleteIncome = useDeleteIncome();
  const navigate = useNavigate();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const { currentMember, isAuthenticated } = useAuth();
  const { data: members = [] } = useMembers();
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>('all');
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>('all');
  const { data: incomes = [], isLoading } = useIncomes(selectedMemberId === 'all' ? undefined : selectedMemberId, currentMonth, currentYear);
  const { data: incomeSources = [] } = useIncomeSources(selectedMemberId === 'all' ? undefined : selectedMemberId);
  const [incomeTagsMap, setIncomeTagsMap] = useState<Record<string, Array<{ id: string; name: string; color: string }>>>({});
  // Paginação e filtro de ordenação
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest' | 'realized' | 'unrealized'>('recent');
  const [searchText, setSearchText] = useState('');
  const perPage = 10;
  
  // Aplicar ordenação aos dados
  const searchFilteredIncomes = incomes.filter(i => {
    const searchLower = searchText.toLowerCase();
    const matchesDescription = (i.description || '').toLowerCase().includes(searchLower);
    const matchesAmount = Number(i.amount).toFixed(2).includes(searchText);
    return matchesDescription || matchesAmount;
  });
  const statusFilteredIncomes = searchFilteredIncomes.filter(i => {
    if (sortOrder === 'realized') return i.is_realized;
    if (sortOrder === 'unrealized') return !i.is_realized;
    return true;
  });
  const sortedIncomes = [...statusFilteredIncomes].sort((a, b) => {
    if (sortOrder === 'realized' || sortOrder === 'unrealized') {
      const dateA = new Date(a.realized_date || a.date).getTime();
      const dateB = new Date(b.realized_date || b.date).getTime();
      return dateB - dateA;
    }
    const dateA = new Date(a.realized_date || a.date).getTime();
    const dateB = new Date(b.realized_date || b.date).getTime();
    return sortOrder === 'recent' ? dateB - dateA : dateA - dateB;
  });
  
  const totalPages = Math.ceil(sortedIncomes.length / perPage);
  const paginatedIncomes = sortedIncomes.slice((page - 1) * perPage, page * perPage);
  
  // Calcular total de entradas (considerar todas as entradas filtradas, não apenas a página atual)
  const totalSearchAmount = sortedIncomes.reduce((sum, inc) => sum + Number(inc.amount), 0);

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

  const getSourceName = (sourceId: string | null) => {
    if (!sourceId) return null;
    return incomeSources.find(s => s.id === sourceId)?.name;
  };

  // Só soma entradas realizadas
  const filteredIncomes = selectedSourceId && selectedSourceId !== 'all'
    ? incomes.filter(i => i.income_source_id === selectedSourceId)
    : incomes;
  const totalIncome = filteredIncomes.filter(i => i.is_realized).reduce((sum, i) => sum + Number(i.amount), 0);

  const handleFilterChange = () => {
    setPage(1);
    setSearchText('');
  };

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    setPage(1);
  };

  useEffect(() => {
    const loadIncomeTags = async () => {
      if (!incomes.length) {
        setIncomeTagsMap({});
        return;
      }

      const incomeIds = incomes.map((income) => income.id);
      const { data, error } = await supabase
        .from('income_tags')
        .select('income_id, tag:custom_tags(id, name, color)')
        .in('income_id', incomeIds);

      if (error) {
        console.error('Erro ao carregar tags das entradas:', error);
        return;
      }

      const map: Record<string, Array<{ id: string; name: string; color: string }>> = {};
      (data || []).forEach((row: any) => {
        if (!row?.income_id || !row?.tag) return;
        if (!map[row.income_id]) map[row.income_id] = [];
        map[row.income_id].push({
          id: row.tag.id,
          name: row.tag.name,
          color: row.tag.color,
        });
      });
      setIncomeTagsMap(map);
    };

    loadIncomeTags();
  }, [incomes]);

  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <TrendingUp className="w-16 h-16 text-income mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Registre suas Entradas
          </h1>
          <p className="text-muted-foreground mb-6">
            Faça login para registrar suas entradas
          </p>
          <Button onClick={() => navigate('/members')}>
            Ir para Membros
          </Button>
        </div>
      </MainLayout>
    );
  }

  // Função utilitária para buscar o primeiro nome do membro
  const getMemberFirstName = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return '';
    return member.name.split(' ')[0];
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Desktop Header */}
          <div className="hidden sm:flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl gradient-income flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                Entradas
              </h1>
              <p className="text-muted-foreground">
                Gerencie suas receitas e fontes de renda
              </p>
            </div>
          </div>
          {/* Mobile Header Box */}
          <div className="sm:hidden flex flex-col items-center gap-3 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-xl p-4 border border-green-200 dark:border-green-800 shadow-sm w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-income flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                Entradas
              </h1>
            </div>
            <p className="text-muted-foreground text-center text-sm">
              Gerencie suas receitas e fontes de renda
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

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-income text-income-foreground">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Entrada
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar Entrada</DialogTitle>
                </DialogHeader>
                <IncomeForm onSuccess={() => setIsAddDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Total Card */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 w-full sm:w-auto text-center sm:text-left">
              <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total do Mês</p>
                <p className="text-2xl font-bold text-income">{formatCurrency(totalIncome)}</p>
              </div>
            </div>
            <div className="w-full flex flex-col gap-2">
              <div className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-2 text-xs">
                <Label className="text-xs text-right">Filtrar por membro</Label>
                  <Select
                    value={selectedMemberId ?? 'all'}
                    onValueChange={value => {
                      setSelectedMemberId(value === 'all' ? undefined : value);
                      setSelectedSourceId('all'); // resetar fonte ao trocar membro
                      handleFilterChange();
                    }}
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
              <div className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-2 text-xs">
                <Label className="text-xs text-right">Fonte de Renda</Label>
                  <Select
                    value={selectedSourceId ?? 'all'}
                    onValueChange={value => {
                      setSelectedSourceId(value === 'all' ? undefined : value);
                      handleFilterChange();
                    }}
                  >
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Todas as fontes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as fontes</SelectItem>
                      {incomeSources.map(source => (
                        <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
              </div>
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
                  onChange={e => handleSearchChange(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-xs placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Incomes List */}
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
        ) : incomes.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-income/10 flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-income" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhuma entrada neste mês
            </h3>
            <p className="text-muted-foreground mb-6">
              Registre sua primeira entrada de {monthNames[currentMonth - 1]}
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="gradient-income">
              <Plus className="w-4 h-4 mr-2" />
              Registrar Entrada
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {/* Total de entradas filtradas */}
              {searchText && sortedIncomes.length > 0 && (
                <div className="glass-card rounded-xl p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Entradas encontradas: <span className="font-semibold text-foreground">{sortedIncomes.length}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-xl font-bold text-income">{formatCurrency(totalSearchAmount)}</p>
                    </div>
                  </div>
                </div>
              )}
              {paginatedIncomes.map((income, index) => {
                const sourceName = getSourceName(income.income_source_id);
                const memberFirstName = getMemberFirstName(income.member_id);
                const tags = incomeTagsMap[income.id] || [];
                return (
                  <div
                    key={income.id}
                    className="glass-card rounded-xl p-4 animate-fade-in hover:shadow-lg transition-shadow"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-income/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-income" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm sm:text-base text-foreground truncate">
                          {income.description || sourceName || 'Entrada'}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {memberFirstName && (
                            <span className="font-semibold text-income mr-2">{memberFirstName}</span>
                          )}
                          {income.is_realized
                            ? `Realizado em ${formatDate(income.realized_date || income.date)}`
                            : 'Não realizado'}
                          {sourceName && income.description && ` • ${sourceName}`}
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
                      <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-2 sm:gap-1">
                        <span className="font-bold text-income text-base sm:text-lg">
                          +{formatCurrency(Number(income.amount))}
                        </span>
                        <div className="flex items-center gap-1">
                          {!income.is_realized && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs"
                              onClick={() => {
                                setIncomeToRealize(income);
                                setRealizeDate('');
                              }}
                            >
                              Realizar
                            </Button>
                          )}
                          <button
                            className="p-2 rounded hover:bg-muted"
                            title="Editar"
                            onClick={() => {
                              setEditIncome(income);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </button>

                          <AlertDialog open={deleteDialogOpen && incomeToDelete === income.id} onOpenChange={(open) => {
                            setDeleteDialogOpen(open);
                            if (!open) setIncomeToDelete(null);
                          }}>
                            <AlertDialogTrigger asChild>
                              <button
                                className="p-2 rounded hover:bg-destructive/10"
                                title="Excluir"
                                onClick={() => {
                                  setIncomeToDelete(income.id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir entrada?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir esta entrada? Esta ação não poderá ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={async () => {
                                    await deleteIncome.mutateAsync(income.id);
                                    setDeleteDialogOpen(false);
                                    setIncomeToDelete(null);
                                  }}
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <button
                  className="px-3 py-1 rounded bg-secondary text-foreground disabled:opacity-50"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Anterior
                </button>
                <span className="text-sm mx-2">Página {page} de {totalPages}</span>
                <button
                  className="px-3 py-1 rounded bg-secondary text-foreground disabled:opacity-50"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Próxima
                </button>
              </div>
            )}
          </>
        )}

        {/* Pop-up para realizar entrada */}
        <Dialog open={!!incomeToRealize} onOpenChange={open => { if (!open) setIncomeToRealize(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Realizar Entrada</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Label htmlFor="realize-date">Data de Realização</Label>
              <Input
                id="realize-date"
                type="date"
                value={realizeDate}
                onChange={e => setRealizeDate(e.target.value)}
              />
              <Button
                className="w-full"
                disabled={!realizeDate}
                onClick={async () => {
                  if (!incomeToRealize || !realizeDate) return;
                  try {
                    await updateIncome.mutateAsync({
                      id: incomeToRealize.id,
                      is_realized: true,
                      realized_date: realizeDate,
                    });
                    if (incomeToRealize.bank_id) {
                      await updateBankBalance.mutateAsync({ bank_id: incomeToRealize.bank_id, amount: incomeToRealize.amount });
                    }
                    toast.success('Entrada realizada com sucesso!');
                    setIncomeToRealize(null);
                    setRealizeDate('');
                  } catch (error) {
                    if (window?.sonner?.error) {
                      window.sonner.error(error.message || 'Erro ao realizar entrada');
                    } else {
                      alert(error.message || 'Erro ao realizar entrada');
                    }
                  }
                }}
              >Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
        {/* Modal de edição */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Entrada</DialogTitle>
            </DialogHeader>
            {editIncome && (
              <IncomeForm
                onSuccess={() => {
                  setIsEditDialogOpen(false);
                  setEditIncome(null);
                }}
                defaultValues={editIncome}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
