import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSyncBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      // 1. Buscar todos os bancos do membro
      const { data: banks, error: banksError } = await supabase
        .from('banks')
        .select('balance')
        .eq('member_id', memberId);

      if (banksError) throw banksError;

      // 2. Somar os saldos dos bancos
      const bankTotalBalance = (banks || []).reduce((sum, bank) => sum + (bank.balance || 0), 0);

      // 3. Buscar incomes e expenses realizados do membro (MÊS/ANO ATUAL) para calcular o saldo do dashboard - SEM recorrentes
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      const { data: incomes, error: incomesError } = await supabase
        .from('incomes')
        .select('amount')
        .eq('member_id', memberId)
        .eq('is_realized', true)
        .eq('month', currentMonth)
        .eq('year', currentYear);

      if (incomesError) throw incomesError;

      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('amount')
        .eq('member_id', memberId)
        .eq('is_realized', true)
        .eq('month', currentMonth)
        .eq('year', currentYear);

      if (expensesError) throw expensesError;

      // 4. Buscar despesas recorrentes ativas que começaram neste mês/ano ou antes
      const { data: recurringExpenses, error: recurringError } = await supabase
        .from('recurring_expenses')
        .select('amount, start_date')
        .eq('member_id', memberId)
        .eq('is_active', true);

      if (recurringError) throw recurringError;

      // Filtrar recorrências que já começaram no mês/ano atual ou antes
      const recurringTotal = (recurringExpenses || [])
        .filter(r => {
          const startDate = new Date(r.start_date as any);
          const startMonth = startDate.getMonth() + 1;
          const startYear = startDate.getFullYear();
          return (startYear < currentYear) || (startYear === currentYear && startMonth <= currentMonth);
        })
        .reduce((sum, r) => sum + (parseFloat(r.amount as any) || 0), 0);

      const totalIncome = (incomes || []).reduce((sum, inc) => sum + (parseFloat(inc.amount as any) || 0), 0);
      const totalExpenses = (expenses || []).reduce((sum, exp) => sum + (parseFloat(exp.amount as any) || 0), 0);
      const dashboardBalance = totalIncome - (totalExpenses + recurringTotal);


      // 4. Calcular a diferença
      const difference = bankTotalBalance - dashboardBalance;

      // Se a diferença for 0, não precisa fazer nada
      if (Math.abs(difference) < 0.01) {
        return { difference: 0, message: 'Saldos já estão sincronizados' };
      }

      const today = currentDate.toISOString().split('T')[0];

      // 5. Se diferença > 0: criar uma ENTRADA (saldo do banco > saldo do dashboard)
      // Se diferença < 0: criar uma DESPESA (saldo do banco < saldo do dashboard)

      if (difference > 0) {
        // Criar entrada realizada
        const { error: incomeError } = await supabase
          .from('incomes')
          .insert({
            member_id: memberId,
            income_source_id: null,
            amount: difference,
            description: 'Ajuste de saldo',
            date: today,
            month: currentMonth,
            year: currentYear,
            bank_id: null,
            is_realized: true,
            realized_date: today,
          });

        if (incomeError) throw incomeError;
      } else {
        // Criar despesa realizada
        const { error: expenseError } = await supabase
          .from('expenses')
          .insert({
            member_id: memberId,
            category_id: null,
            card_id: null,
            bank_id: null,
            amount: Math.abs(difference),
            description: 'Ajuste de saldo',
            date: today,
            month: currentMonth,
            year: currentYear,
            is_realized: true,
            realized_date: today,
          });

        if (expenseError) throw expenseError;
      }

      return { difference, message: 'Saldo sincronizado com sucesso' };
    },
    onSuccess: () => {
      // Invalida o cache dos membros, bancos, incomes e expenses para refrescar os dados
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['banks'] });
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

