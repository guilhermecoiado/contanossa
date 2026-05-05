import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseConnection';
import { Investment } from '@/types/finance';

interface UpdateInvestmentData {
  id: string;
  name?: string;
  type?: string;
  symbol?: string | null;
  quantity?: number | null;
  purchase_price?: number | null;
  consortium_credit_value?: number | null;
  consortium_monthly_value?: number | null;
  consortium_term_months?: number | null;
  consortium_is_contemplated?: boolean | null;
  consortium_contemplated_value?: number | null;
  consortium_will_sell?: boolean | null;
  consortium_sale_value?: number | null;
  cdb_bank_name?: string | null;
  cdb_indexer?: string | null;
  cdb_rate_percent?: number | null;
  initial_value?: number;
  current_value?: number;
  start_date?: string;
  notes?: string;
}

export function useUpdateInvestment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateInvestmentData) => {
      const { id, ...fields } = data;
      const { data: investment, error } = await supabase
        .from('investments')
        .update(fields)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return investment as Investment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
    },
  });
}
