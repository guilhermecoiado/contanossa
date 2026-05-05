import { Member } from '@/types/finance';
import { formatCurrency, getHealthStatus, getHealthLabel } from '@/lib/formatters';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, ShieldCheck, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface MemberHealthCardProps {
  member: Member;
  income: number;
  expenses: number;
  balance: number;
  installmentPct?: number;
  footer?: ReactNode;
}

function getInstallmentColor(pct: number) {
  if (pct <= 10) return { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', label: 'Excelente' };
  if (pct <= 20) return { bar: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400', label: 'Saudável' };
  if (pct <= 30) return { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', label: 'Atenção' };
  return { bar: 'bg-rose-600', text: 'text-rose-700 dark:text-rose-400', label: 'Arriscado' };
}

function getHealthBadgeClass(status: string) {
  if (status === 'excellent') return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-400 dark:border-emerald-500/30';
  if (status === 'good') return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-400 dark:border-blue-500/30';
  if (status === 'warning') return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-400 dark:border-amber-500/30';
  return 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-400 dark:border-rose-500/30';
}

function getProgressBarColor(status: string) {
  if (status === 'excellent') return 'bg-blue-500 dark:bg-blue-400';
  if (status === 'good') return 'bg-blue-500 dark:bg-blue-400';
  if (status === 'warning') return 'bg-amber-500 dark:bg-amber-400';
  return 'bg-rose-600 dark:bg-rose-500';
}

function InstallmentIcon({ status }: { status: string }) {
  const cls = "h-4 w-4 shrink-0";
  if (status === 'excellent') return <ShieldCheck className={cn(cls, "text-emerald-700 dark:text-emerald-400")} />;
  if (status === 'good') return <CheckCircle2 className={cn(cls, "text-blue-700 dark:text-blue-400")} />;
  if (status === 'warning') return <AlertTriangle className={cn(cls, "text-amber-700 dark:text-amber-400")} />;
  return <AlertOctagon className={cn(cls, "text-rose-700 dark:text-rose-400")} />;
}

export function MemberHealthCard({ member, income, expenses, balance, installmentPct, footer }: MemberHealthCardProps) {
  const healthStatus = getHealthStatus(balance, income);
  const percentage = income > 0 ? Math.min((expenses / income) * 100, 100) : 0;
  const instColor = installmentPct !== undefined ? getInstallmentColor(installmentPct) : null;

  return (
    <div className="glass-card rounded-2xl p-5 animate-fade-in hover:shadow-xl transition-shadow">
      {/* Header: avatar + name + badge + menu */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 ring-2 ring-primary/20 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
              {member.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <h4 className="font-semibold text-foreground leading-tight">{member.name}</h4>
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full w-fit", getHealthBadgeClass(healthStatus))}>
              {getHealthLabel(healthStatus)}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-secondary rounded-full overflow-hidden mb-4">
        <div
          className={cn("absolute top-0 left-0 h-full rounded-full transition-all duration-500", getProgressBarColor(healthStatus))}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Entradas / Saídas grid */}
      <div className="grid grid-cols-2 divide-x divide-border mb-3">
        <div className="pr-4 flex flex-col items-center">
          <p className="text-xs text-muted-foreground mb-1">Entradas</p>
          <div className="flex items-center gap-1.5">
            <ArrowUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">{formatCurrency(income)}</span>
          </div>
        </div>
        <div className="pl-4 flex flex-col items-center">
          <p className="text-xs text-muted-foreground mb-1">Saídas</p>
          <div className="flex items-center gap-1.5">
            <ArrowDown className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="text-rose-600 dark:text-rose-400 font-semibold text-sm">{formatCurrency(expenses)}</span>
          </div>
        </div>
      </div>

      {/* Saldo box */}
      <div className="flex items-center justify-between bg-secondary/60 rounded-xl px-4 py-2.5 mb-3">
        <span className="text-sm text-foreground">Saldo</span>
        <span className={cn("font-bold", balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
          {balance < 0 ? `–${formatCurrency(Math.abs(balance))}` : formatCurrency(balance)}
        </span>
      </div>

      {/* Parcelas × Fixos */}
      {instColor && installmentPct !== undefined && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Parcelas × Fixos</span>
            <span className={cn("text-xs font-semibold", instColor.text)}>
              {installmentPct.toFixed(1)}% · {instColor.label}
            </span>
          </div>
          <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn("absolute top-0 left-0 h-full rounded-full transition-all duration-500", instColor.bar)}
              style={{ width: `${Math.min(installmentPct, 100)}%` }}
            />
            {[10, 20, 30].map(mark => (
              <div key={mark} className="absolute top-0 h-full w-px bg-background/60" style={{ left: `${mark}%` }} />
            ))}
          </div>
          {/* Icon + description */}
          <div className="flex items-start gap-2 mt-2">
            <div className={cn("rounded-full p-1 shrink-0",
              installmentPct <= 10 ? "bg-emerald-500/15" :
              installmentPct <= 20 ? "bg-blue-500/15" :
              installmentPct <= 30 ? "bg-amber-500/15" : "bg-rose-500/15"
            )}>
              <InstallmentIcon status={instColor.label === 'Excelente' ? 'excellent' : instColor.label === 'Saudável' ? 'good' : instColor.label === 'Atenção' ? 'warning' : 'danger'} />
            </div>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              {installmentPct <= 10 ? 'Muito confortável — até 10% da renda fixa.' :
               installmentPct <= 20 ? 'Saudável — entre 10% e 20% da renda fixa.' :
               installmentPct <= 30 ? 'Aceitável, mas exige atenção — 20% a 30%.' :
               'Risco financeiro — acima de 30% da renda fixa comprometida.'}
            </p>
          </div>
        </div>
      )}

      {footer && (
        <div className="mt-3 pt-3 border-t border-border">
          {footer}
        </div>
      )}
    </div>
  );
}
