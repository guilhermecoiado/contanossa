import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Bank } from '@/types/finance';

export function useUpdateBankBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bank_id, amount }: { bank_id: string; amount: number }) => {
      // Buscar saldo atual
      const { data: bank, error: fetchError } = await supabase
        .from('banks')
        .select('balance')
        .eq('id', bank_id)
        .single();
      
      if (fetchError) {
        console.error('❌ Erro ao buscar banco:', fetchError);
        throw fetchError;
      }
      if (!bank) {
        console.error('❌ Banco não encontrado:', bank_id);
        throw new Error('Banco não encontrado');
      }
      
      // Calcular novo saldo
      const currentBalance = bank.balance || 0;
      const newBalance = currentBalance + amount;
      
      // Atualizar banco
      const { data: updated, error } = await supabase
        .from('banks')
        .update({ balance: newBalance })
        .eq('id', bank_id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Erro ao atualizar saldo bancário:', error);
        throw error;
      }
      return updated as Bank;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banks'] });
    },
  });
}
