import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Expense } from '@/types/finance';

// Busca todas as despesas de um cartão
export function useCardExpenses(cardId?: string) {
  return useQuery({
    queryKey: ['card_expenses', cardId],
    queryFn: async () => {
      if (!cardId) return [];
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('card_id', cardId);
      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!cardId,
  });
}
