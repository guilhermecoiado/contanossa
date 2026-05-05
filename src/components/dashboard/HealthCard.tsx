import { cn } from '@/lib/utils';
import { formatCurrency, getHealthStatus, getHealthColor, getHealthLabel } from '@/lib/formatters';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface HealthCardProps {
  title: string;
  income: number;
  expenses: number;
  balance: number;
  variant?: 'default' | 'family' | 'deep-purple';
  installmentPct?: number;
}

function getInstallmentColor(pct: number) {
  if (pct <= 10) return { bar: 'bg-emerald-400', text: 'text-emerald-300', label: 'Excelente' };
  if (pct <= 20) return { bar: 'bg-blue-400', text: 'text-blue-300', label: 'Saudável' };
  if (pct <= 30) return { bar: 'bg-amber-400', text: 'text-amber-300', label: 'Atenção' };
  return { bar: 'bg-rose-400', text: 'text-rose-300', label: 'Arriscado' };
}

export function HealthCard({ title, income, expenses, balance, variant = 'default', installmentPct }: HealthCardProps) {
  const healthStatus = getHealthStatus(balance, income);
  const instColor = installmentPct !== undefined ? getInstallmentColor(installmentPct) : null;
  
  return (
    <div className={cn(
      "rounded-2xl p-6 text-card-foreground",
      variant === 'deep-purple'
        ? "bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 text-white"
        : variant === 'family'
          ? "gradient-family-chumbo text-primary-foreground"
          : "glass-card"
    )}>
      <div className="flex items-center justify-between mb-6">
        <h3 className={cn(
          "font-semibold text-lg",
          variant === 'deep-purple' ? "text-white" : variant === 'family' ? "text-primary-foreground" : "text-foreground"
        )}>
          {title}
        </h3>
        <div className={cn(
          "px-3 py-1 rounded-full text-xs font-medium",
          variant === 'deep-purple'
            ? "bg-white/10 text-white border border-white/20"
            : variant === 'family' 
              ? "bg-white/20 text-white" 
              : `bg-secondary ${getHealthColor(healthStatus)}`
        )}>
          {getHealthLabel(healthStatus)}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              variant === 'deep-purple' ? "bg-white/10" : variant === 'family' ? "bg-white/20" : "bg-income/10"
            )}>
              <TrendingUp className={cn(
                "w-4 h-4",
                variant === 'deep-purple' ? "text-white" : variant === 'family' ? "text-white" : "text-income"
              )} />
            </div>
            <span className={cn(
              "text-sm",
              variant === 'deep-purple' ? "text-white/80" : variant === 'family' ? "text-white/80" : "text-muted-foreground"
            )}>
              Entradas
            </span>
          </div>
          <span className={cn(
            "font-semibold",
            variant === 'deep-purple' ? "text-white" : variant === 'family' ? "text-white" : "text-income"
          )}>
            {formatCurrency(income)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              variant === 'deep-purple' ? "bg-white/10" : variant === 'family' ? "bg-white/20" : "bg-expense/10"
            )}>
              <TrendingDown className={cn(
                "w-4 h-4",
                variant === 'deep-purple' ? "text-white" : variant === 'family' ? "text-white" : "text-expense"
              )} />
            </div>
            <span className={cn(
              "text-sm",
              variant === 'deep-purple' ? "text-white/80" : variant === 'family' ? "text-white/80" : "text-muted-foreground"
            )}>
              Saídas
            </span>
          </div>
          <span className={cn(
            "font-semibold",
            variant === 'deep-purple' ? "text-white" : variant === 'family' ? "text-white" : "text-expense"
          )}>
            {formatCurrency(expenses)}
          </span>
        </div>

        <div className="pt-4 border-t border-border/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                variant === 'deep-purple' ? "bg-white/10" : variant === 'family' ? "bg-white/20" : "bg-primary/10"
              )}>
                <Wallet className={cn(
                  "w-4 h-4",
                  variant === 'deep-purple' ? "text-white" : variant === 'family' ? "text-white" : "text-primary"
                )} />
              </div>
              <span className={cn(
                "text-sm font-medium",
                variant === 'deep-purple' ? "text-white/80" : variant === 'family' ? "text-white/80" : "text-muted-foreground"
              )}>
                Saldo
              </span>
            </div>
            <span className={cn(
              "font-bold text-xl",
              variant === 'deep-purple' ? "text-white" : variant === 'family' 
                ? "text-white" 
                : balance >= 0 ? "text-income" : "text-expense"
            )}>
              {formatCurrency(balance)}
            </span>
          </div>
        </div>
      </div>

      {instColor && installmentPct !== undefined && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className={cn("text-xs", variant === 'deep-purple' || variant === 'family' ? "text-white/70" : "text-muted-foreground")}>
              Parcelas × Fixos
            </span>
            <span className={cn("text-xs font-semibold shrink-0", instColor.text)}>
              {installmentPct.toFixed(1)}% · {instColor.label}
            </span>
          </div>
          <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={cn("absolute top-0 left-0 h-full rounded-full transition-all duration-500", instColor.bar)}
              style={{ width: `${Math.min(installmentPct, 100)}%` }}
            />
            {[10, 20, 30].map(mark => (
              <div key={mark} className="absolute top-0 h-full w-px bg-white/20" style={{ left: `${mark}%` }} />
            ))}
          </div>
          <p className={cn("text-[10px] mt-1", variant === 'deep-purple' || variant === 'family' ? "text-white/50" : "text-muted-foreground")}>
            {installmentPct <= 10 ? 'Muito confortável — até 10% da renda fixa.' :
             installmentPct <= 20 ? 'Saudável — entre 10% e 20% da renda fixa.' :
             installmentPct <= 30 ? 'Aceitável, mas exige atenção — entre 20% e 30%.' :
             'Risco financeiro — acima de 30% da renda fixa comprometida.'}
          </p>
        </div>
      )}
    </div>
  );
}
