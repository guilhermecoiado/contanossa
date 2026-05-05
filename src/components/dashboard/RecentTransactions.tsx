import { Income, Expense, ExpenseCategory } from '@/types/finance';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface RecentTransactionsProps {
  incomes: Income[];
  expenses: Expense[];
  categories: ExpenseCategory[];
}

type Transaction = {
  id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  date: string;
  category?: string;
  is_realized?: boolean;
};

import React from 'react';

export function RecentTransactions({ incomes, expenses, categories }: RecentTransactionsProps) {
  const [page, setPage] = React.useState(1);
  const perPage = 10;
  const allTransactions: Transaction[] = [
    ...incomes.map(i => ({
      id: i.id,
      type: 'income' as const,
      description: i.description || 'Entrada',
      amount: i.amount,
      date: i.date,
      is_realized: i.is_realized,
    })),
    ...expenses.map(e => ({
      id: e.id,
      type: 'expense' as const,
      description: e.description,
      amount: e.amount,
      date: e.date,
      category: categories.find(c => c.id === e.category_id)?.name,
      is_realized: e.is_realized,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalPages = Math.ceil(allTransactions.length / perPage);
  const paginated = allTransactions.slice((page - 1) * perPage, page * perPage);

  if (allTransactions.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <h3 className="font-semibold text-lg mb-4">Transações Recentes</h3>
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhuma transação registrada ainda.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <h3 className="font-semibold text-lg mb-4">Transações Recentes</h3>
      <div className="space-y-3">
        {paginated.map((transaction, index) => (
          <div
            key={transaction.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg transition-colors animate-fade-in",
              (transaction.type === 'income' && transaction.is_realized === false) || (transaction.type === 'expense' && transaction.is_realized === false)
                ? "bg-yellow-100 border border-yellow-400 dark:bg-yellow-900/40 dark:border-yellow-700"
                : "hover:bg-secondary/50"
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              transaction.type === 'income' ? "bg-income/10" : "bg-expense/10"
            )}>
              {transaction.type === 'income' ? (
                <TrendingUp className="w-5 h-5 text-income" />
              ) : (
                <TrendingDown className="w-5 h-5 text-expense" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {transaction.description}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(transaction.date)}
                {transaction.category && ` • ${transaction.category}`}
              </p>
              {(transaction.type === 'income' && transaction.is_realized === false) && (
                <div className="flex items-center gap-1 mt-1 text-xs text-warning font-semibold">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Entrada Pendente
                </div>
              )}
              {(transaction.type === 'expense' && transaction.is_realized === false) && (
                <div className="flex items-center gap-1 mt-1 text-xs text-warning font-semibold">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Saída Pendente
                </div>
              )}
            </div>
            
            <span className={cn(
              "font-semibold",
              transaction.type === 'income' ? "text-income" : "text-expense"
            )}>
              {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
            </span>
          </div>
        ))}
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
    </div>
  );
}
