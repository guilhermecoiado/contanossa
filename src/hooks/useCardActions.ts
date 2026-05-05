import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/types/finance';

export function useUpdateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Card> & { id: string }) => {
      const { data: updated, error } = await supabase
        .from('cards')
        .update(data)
        .eq('id', data.id)
        .select()
        .single();
      if (error) throw error;
      return updated as Card;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });
}

export function useDeleteCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });
}
