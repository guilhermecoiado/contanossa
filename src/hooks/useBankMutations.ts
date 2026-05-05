import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Bank } from '@/types/finance';

export function useUpdateBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bankId, data }: { bankId: string; data: Partial<Bank> }) => {
      const { data: updated, error } = await supabase
        .from('banks')
        .update(data)
        .eq('id', bankId)
        .select()
        .single();
      if (error) throw error;
      return updated as Bank;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banks'] });
    },
  });
}

export function useDeleteBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bankId: string) => {
      const { error } = await supabase
        .from('banks')
        .delete()
        .eq('id', bankId);
      if (error) throw error;
      return bankId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banks'] });
    },
  });
}
