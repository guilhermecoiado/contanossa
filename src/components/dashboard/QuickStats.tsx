import { cn } from '@/lib/utils';
// import { formatCurrency } from '@/lib/formatters';
import { TrendingUp, TrendingDown, PiggyBank, CreditCard, Eye, ChevronDown } from 'lucide-react';
import { useDebts } from '@/hooks/useDebts';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMembers } from '@/hooks/useMembers';
import { useExpenses } from '@/hooks/useFinances';
import { formatCurrency } from '@/lib/formatters';
import { Debt, Expense, Investment } from '@/types/finance';
import { useAuth } from '@/contexts/AuthContext';
import { isEssentialPlan } from '@/lib/plans';

interface QuickStatsProps {
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  pendingInstallments: number;
  investments: Investment[];
}

function getConsortiumInstallmentProgress(startDate?: string | null, termMonths?: number | null) {
  if (!startDate || !termMonths || termMonths <= 0) {
    return { currentInstallment: 0, remainingInstallments: 0 };
  }

  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    return { currentInstallment: 0, remainingInstallments: 0 };
  }

  const now = new Date();
  let elapsedMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) elapsedMonths -= 1;

  const currentInstallment = Math.min(termMonths, Math.max(1, elapsedMonths + 1));
  const remainingInstallments = Math.max(termMonths - currentInstallment, 0);

  return { currentInstallment, remainingInstallments };
}

export function QuickStats({ totalIncome, totalExpenses, totalSavings, pendingInstallments, investments }: QuickStatsProps) {
  const [isInstallmentsDialogOpen, setIsInstallmentsDialogOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const { data: members = [] } = useMembers();
  const { currentPlan } = useAuth();
  const isEssential = isEssentialPlan(currentPlan);
  // Busca todas as despesas parceladas não realizadas
  const { data: allExpenses = [] } = useExpenses();
  
  // Agrupa parcelas por descrição base (removendo sufixo de parcela)
  const groupInstallmentsByDescription = (installments: Expense[]) => {
    const grouped: Record<string, Expense[]> = {};
    installments.forEach((e) => {
      const desc = e.description.replace(/\s*\(\d+\/\d+\)$/, '');
      if (!grouped[desc]) {
        grouped[desc] = [];
      }
      grouped[desc].push(e);
    });
    
    // Ordena cada grupo por número de parcela
    Object.keys(grouped).forEach((desc) => {
      grouped[desc].sort((a, b) => (a.installment_number || 0) - (b.installment_number || 0));
    });
    
    return Object.entries(grouped).map(([desc, items]) => ({ desc, items }));
  };
  
  // Agrupa parcelas pendentes por membro
  const groupedByMember = members.map(member => {
    const memberInstallments = allExpenses.filter(e =>
      e.member_id === member.id &&
      e.total_installments && e.total_installments > 1 &&
      !e.is_realized
    );
    return { member, installments: memberInstallments };
  }).filter(g => g.installments.length > 0);

  // Dívidas por membro
  const { data: allDebts = [] } = useDebts();
  const debtsByMember = members.map(member => ({
    member,
    debts: allDebts.filter(d => d.member_id === member.id && d.status === 'open')
  })).filter(g => g.debts.length > 0);

  const consortiumByMember = members.map((member) => ({
    member,
    consortiums: investments.filter((inv) => inv.member_id === member.id && inv.type === 'consortium'),
  })).filter((g) => g.consortiums.length > 0);

  const installmentsAndDebtsCount =
    groupedByMember.reduce((sum, g) => sum + g.installments.length, 0) +
    debtsByMember.reduce((sum, g) => sum + g.debts.length, 0) +
    consortiumByMember.reduce((sum, g) => sum + g.consortiums.length, 0);

  void pendingInstallments;
  const stats = [
    {
      label: 'Total Entradas',
      value: formatCurrency(totalIncome),
      icon: TrendingUp,
      color: 'text-income',
      bg: 'bg-income/10 dark:bg-income/20',
    },
    {
      label: 'Total Saídas',
      value: formatCurrency(totalExpenses),
      icon: TrendingDown,
      color: 'text-expense',
      bg: 'bg-expense/10 dark:bg-expense/20',
    },
    {
      label: 'Investimentos',
      value: formatCurrency(totalSavings),
      icon: PiggyBank,
      color: 'text-primary',
      bg: 'bg-primary/10 dark:bg-primary/20',
    },
    {
      label: 'Parcelas e Dívidas',
      mobileLabel: 'Parcelas',
      value: installmentsAndDebtsCount.toString(),
      icon: CreditCard,
      color: 'text-warning',
      bg: 'bg-warning/10 dark:bg-yellow-900/60',
      action: (
        <Dialog open={isInstallmentsDialogOpen} onOpenChange={setIsInstallmentsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-2" aria-label="Visualizar Parcelas e Dívidas">
              <Eye className="w-5 h-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Parcelas e Dívidas</DialogTitle>
            </DialogHeader>
            {/* Aviso removido */}
            {groupedByMember.length === 0 && debtsByMember.length === 0 && consortiumByMember.length === 0 ? (
              <div className="text-muted-foreground text-center py-8">Nenhuma parcela ou dívida encontrada.</div>
            ) : (
              <div className="space-y-8">
                {/* Parcelas */}
                {groupedByMember.map(({ member, installments }) => {
                  const groupedInstallments = groupInstallmentsByDescription(installments);
                  return (
                    <div key={member.id + '-installments'}>
                      <div className="font-semibold mb-2 text-primary">{member.name} <span className="text-xs text-muted-foreground">(Parcelas)</span></div>
                      <div className="space-y-2">
                        {groupedInstallments.map(({ desc, items }, groupIndex) => {
                          const groupId = `${member.id}-${desc}-${groupIndex}`;
                          const isExpanded = expandedGroups[groupId] || false;
                          const firstItem = items[0];
                          const totalInstallments = firstItem.total_installments;
                          const totalGrupo = items.reduce((sum, e) => sum + (e.amount || 0), 0);
                          return (
                            <div key={groupId} className="border rounded-lg">
                              <button
                                onClick={() => setExpandedGroups(prev => ({
                                  ...prev,
                                  [groupId]: !prev[groupId]
                                }))}
                                className="w-full flex items-center gap-2 px-3 py-2 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                              >
                                <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                                <span className="flex-1 text-left text-sm">{desc}</span>
                                <span className="text-xs text-muted-foreground">{items.length}/{totalInstallments}</span>
                              </button>
                              <div className="px-3 py-1 text-xs text-primary font-semibold">Total: {formatCurrency(totalGrupo)}</div>
                              {isExpanded && (
                                <>
                                  <div className="space-y-2 p-2 md:hidden">
                                    {items.map((e) => {
                                      const itemDesc = e.description.replace(/\s*\(\d+\/\d+\)$/, '');
                                      const qtdParcelas = `${e.installment_number}/${e.total_installments}`;
                                      const parcelaDate = new Date(e.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                      return (
                                        <div key={e.id} className="rounded-lg border bg-card p-3 space-y-1 text-xs">
                                          <p className="font-medium text-foreground">{itemDesc}</p>
                                          <p className="text-muted-foreground">Valor: <span className="text-foreground">{formatCurrency(e.amount)}</span></p>
                                          <p className="text-muted-foreground">Parcela: <span className="text-foreground">{qtdParcelas}</span></p>
                                          <p className="text-muted-foreground">Data: <span className="text-foreground">{parcelaDate}</span></p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="hidden md:block overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                      <thead>
                                        <tr className="bg-secondary/20">
                                          <th className="px-3 py-2 text-left text-xs">Descrição</th>
                                          <th className="px-3 py-2 text-left text-xs">Valor</th>
                                          <th className="px-3 py-2 text-left text-xs">Parcela</th>
                                          <th className="px-3 py-2 text-left text-xs">Data</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {items.map((e) => {
                                          const itemDesc = e.description.replace(/\s*\(\d+\/\d+\)$/, '');
                                          const qtdParcelas = `${e.installment_number}/${e.total_installments}`;
                                          const parcelaDate = new Date(e.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                          return (
                                            <tr key={e.id} className="border-b text-xs">
                                              <td className="px-3 py-2">{itemDesc}</td>
                                              <td className="px-3 py-2">{formatCurrency(e.amount)}</td>
                                              <td className="px-3 py-2">{qtdParcelas}</td>
                                              <td className="px-3 py-2">{parcelaDate}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {/* Dívidas */}
                {debtsByMember.map(({ member, debts }) => {
                  const totalDebts = debts.reduce((sum, d) => sum + (d.current_value || 0), 0);
                  return (
                    <div key={member.id + '-debts'}>
                      <div className="font-semibold mb-2 text-primary">{member.name} <span className="text-xs text-muted-foreground">(Dívidas)</span></div>
                      {/* Total removido conforme solicitado */}
                      <div className="space-y-2 md:hidden">
                        {debts.map((d: Debt) => {
                          // Calcula meses entre início e fim (inclusive)
                          let total = '-';
                          let endDate = d.end_date || d.data_fim;
                          if (d.start_date && endDate && d.current_value) {
                            const start = new Date(d.start_date);
                            const end = new Date(endDate);
                            let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
                            if (months < 1) months = 1;
                            total = formatCurrency(months * Number(d.current_value));
                          }
                          return (
                            <div key={d.id} className="rounded-lg border bg-card p-3 space-y-1 text-xs">
                              <p className="font-medium text-foreground">{d.name}</p>
                              <p className="text-muted-foreground">Valor atual: <span className="text-foreground">{formatCurrency(d.current_value)}</span></p>
                              <p className="text-muted-foreground">Valor inicial: <span className="text-foreground">{formatCurrency(d.initial_value)}</span></p>
                              <p className="text-muted-foreground">Tipo: <span className="text-foreground">{d.type === 'other' ? d.custom_type : d.type}</span></p>
                              <p className="text-muted-foreground">Início: <span className="text-foreground">{d.start_date ? new Date(d.start_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</span></p>
                              <p className="text-primary font-semibold">Total: <span className="text-foreground">{total}</span></p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full text-xs border rounded-lg">
                          <thead>
                            <tr className="bg-secondary text-foreground">
                              <th className="px-2 py-1 text-left">Descrição</th>
                              <th className="px-2 py-1 text-left">Valor Atual</th>
                              <th className="px-2 py-1 text-left">Data de Início</th>
                              <th className="px-2 py-1 text-left">Data de Fim</th>
                              <th className="px-2 py-1 text-left">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {debts.map((d: Debt) => {
                              // Calcula meses entre início e fim (inclusive)
                              let total = '-';
                              let endDate = d.end_date || d.data_fim;
                              if (d.start_date && endDate && d.current_value) {
                                const start = new Date(d.start_date);
                                const end = new Date(endDate);
                                let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
                                if (months < 1) months = 1;
                                total = formatCurrency(months * Number(d.current_value));
                              }
                              return (
                                <tr key={d.id} className="border-b">
                                  <td className="px-2 py-1">{d.name}</td>
                                  <td className="px-2 py-1">{formatCurrency(d.current_value)}</td>
                                  <td className="px-2 py-1">{d.start_date ? new Date(d.start_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</td>
                                  <td className="px-2 py-1">{d.end_date ? new Date(d.end_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</td>
                                  <td className="px-2 py-1">{total}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}

                {/* Consórcios (Carta de Crédito) */}
                {consortiumByMember.map(({ member, consortiums }) => {
                  const totalConsorcios = consortiums.reduce((sum, c) => sum + Number(c.consortium_monthly_value || 0), 0);
                  return (
                    <div key={member.id + '-consortiums'}>
                      <div className="font-semibold mb-2 text-primary">{member.name} <span className="text-xs text-muted-foreground">(Consórcios)</span></div>
                      {/* Total removido conforme solicitado */}
                      <div className="space-y-2 md:hidden">
                        {consortiums.map((consortium) => {
                          const termMonths = Number(consortium.consortium_term_months || 0);
                          const { currentInstallment, remainingInstallments } = getConsortiumInstallmentProgress(consortium.start_date, termMonths);
                          const parcela = Number(consortium.consortium_monthly_value || 0);
                          const totalRestante = formatCurrency(parcela * remainingInstallments);
                          return (
                            <div key={consortium.id} className="rounded-lg border bg-card p-3 space-y-1 text-xs">
                              <p className="font-medium text-foreground">{consortium.name}</p>
                              <p className="text-muted-foreground">Parcela: <span className="text-foreground">{formatCurrency(parcela)}</span></p>
                              <p className="text-muted-foreground">Atual: <span className="text-foreground">{currentInstallment}/{termMonths}</span></p>
                              <p className="text-muted-foreground">Restantes: <span className="text-foreground">{remainingInstallments}</span></p>
                              <p className="text-primary font-semibold">Total: <span className="text-foreground">{totalRestante}</span></p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full text-xs border rounded-lg">
                          <thead>
                            <tr className="bg-secondary text-foreground">
                              <th className="px-2 py-1 text-left">Descrição</th>
                              <th className="px-2 py-1 text-left">Valor da Parcela</th>
                              <th className="px-2 py-1 text-left">Parcela Atual</th>
                              <th className="px-2 py-1 text-left">Parcelas Restantes</th>
                              <th className="px-2 py-1 text-left">Total Restante</th>
                            </tr>
                          </thead>
                          <tbody>
                            {consortiums.map((consortium) => {
                              const termMonths = Number(consortium.consortium_term_months || 0);
                              const { currentInstallment, remainingInstallments } = getConsortiumInstallmentProgress(consortium.start_date, termMonths);
                              const parcela = Number(consortium.consortium_monthly_value || 0);
                              const totalRestante = formatCurrency(parcela * remainingInstallments);
                              return (
                                <tr key={consortium.id} className="border-b">
                                  <td className="px-2 py-1">{consortium.name}</td>
                                  <td className="px-2 py-1">{formatCurrency(parcela)}</td>
                                  <td className="px-2 py-1">{currentInstallment}/{termMonths}</td>
                                  <td className="px-2 py-1">{remainingInstallments}</td>
                                  <td className="px-2 py-1">{totalRestante}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>
      ),
    },
  ];
  return (
    <div className={isEssential ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "grid grid-cols-2 lg:grid-cols-4 gap-4"}>
      {stats
        .filter((stat, index) => {
          // Hide Investimentos (index 2) and Parcelas e Dívidas (index 3) for essential plan
          if (isEssential && (index === 2 || index === 3)) return false;
          return true;
        })
        .map((stat, index) => (
        <div 
          key={stat.label}
          className="glass-card rounded-xl p-4 animate-fade-in"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0", stat.bg)}>
              <stat.icon className={cn("w-4 h-4 sm:w-5 sm:h-5", stat.color)} />
            </div>
            <div className="w-full">
              <p className="text-xs text-muted-foreground">
                {stat.mobileLabel ? (
                  <>
                    <span className="sm:hidden">{stat.mobileLabel}</span>
                    <span className="hidden sm:inline">{stat.label}</span>
                  </>
                ) : (
                  stat.label
                )}
              </p>
              <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                <p className={cn("font-bold text-lg", stat.color)}>{stat.value}</p>
                {stat.action}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
