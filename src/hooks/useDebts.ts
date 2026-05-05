export function useUpdateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Debt> & { id: string }) => {
      const { data: updated, error } = await supabase
        .from('debts')
        .update({
          name: data.name,
          type: data.type,
          custom_type: data.custom_type,
          initial_value: data.initial_value,
          current_value: data.current_value,
          start_date: data.start_date,
          end_date: data.end_date,
          notes: data.notes,
          member_id: data.member_id,
        })
        .eq('id', data.id)
        .select()
        .single();
      if (error) throw error;
      return updated as Debt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}
export function useDeleteDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('debts')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseConnection';
import { Debt } from '@/types/finance';

export function useDebts(memberId?: string) {
  return useQuery({
    queryKey: ['debts', memberId],
    queryFn: async () => {
      let query = supabase.from('debts').select('*');
      if (memberId) query = query.eq('member_id', memberId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data as Debt[];
    },
  });
}

export function useCreateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Debt, 'id' | 'created_at' | 'updated_at' | 'status'> & { member_id: string }) => {
      // Garante que start_date é obrigatório
      if (!data.start_date) {
        throw new Error('O campo start_date é obrigatório');
      }
      const { data: debt, error } = await supabase
        .from('debts')
        .insert({ ...data, start_date: data.start_date })
        .select()
        .single();
      if (error) throw error;
      return debt as Debt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}

export function useCloseDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('debts')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Debt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}
