import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Income } from '@/types/finance';

export function useUpdateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Income> & { id: string }) => {
      const { id, created_at, ...updateData } = data as any;

      const cleanData: Record<string, unknown> = {};
      const allowedColumns = [
        'member_id',
        'income_source_id',
        'bank_id',
        'amount',
        'description',
        'date',
        'month',
        'year',
        'is_realized',
        'realized_date',
      ] as const;

      for (const column of allowedColumns) {
        if (Object.prototype.hasOwnProperty.call(updateData, column)) {
          cleanData[column] = updateData[column];
        }
      }
      
      const { data: updated, error } = await supabase
        .from('incomes')
        .update(cleanData)
        .eq('id', id)
        .select();
      
      if (error) {
        console.error('Erro Supabase ao atualizar income:', error);
        throw new Error(error.message || 'Erro ao atualizar entrada');
      }
      
      if (!updated || updated.length === 0) {
        throw new Error('Nenhum registro foi atualizado');
      }
      
      return updated[0] as Income;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
    },
  });
}

export function useDeleteIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Excluir a entrada
      const { error } = await supabase
        .from('incomes')
        .delete()
        .eq('id', id);
      if (error) throw error;

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      queryClient.invalidateQueries({ queryKey: ['banks'] });
    },
  });
}
