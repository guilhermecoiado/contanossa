import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CustomCategory {
  id: string;
  user_id: string;
  name: string;
  type: 'expense' | 'debt' | 'income';
  color?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

// Categories
export function useCustomCategories(type?: 'expense' | 'debt' | 'income') {
  return useQuery({
    queryKey: ['customCategories', type],
    queryFn: async () => {
      let query = supabase.from('custom_categories').select('*');
      
      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query.order('name');
      
      if (error) throw error;
      return (data || []) as CustomCategory[];
    },
  });
}

export function useCreateCustomCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { name: string; type: 'expense' | 'debt' | 'income'; color?: string }) => {
      const { data, error } = await supabase
        .from('custom_categories')
        .insert({
          name: variables.name,
          type: variables.type,
          color: variables.color,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CustomCategory;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customCategories', variables.type] });
      queryClient.invalidateQueries({ queryKey: ['customCategories'] });
    },
  });
}

export function useUpdateCustomCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string; name: string; color?: string }) => {
      const { data, error } = await supabase
        .from('custom_categories')
        .update({ name: variables.name, color: variables.color })
        .eq('id', variables.id)
        .select()
        .single();

      if (error) throw error;
      return data as CustomCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customCategories'] });
    },
  });
}

export function useDeleteCustomCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customCategories'] });
    },
  });
}

// Tags
export function useCustomTags() {
  return useQuery({
    queryKey: ['customTags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_tags')
        .select('*')
        .order('name');

      if (error) throw error;
      return (data || []) as CustomTag[];
    },
  });
}

export function useCreateCustomTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { name: string; color: string }) => {
      const { data, error } = await supabase
        .from('custom_tags')
        .insert({
          name: variables.name,
          color: variables.color,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CustomTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customTags'] });
    },
  });
}

export function useUpdateCustomTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string; name: string; color: string }) => {
      const { data, error } = await supabase
        .from('custom_tags')
        .update({ name: variables.name, color: variables.color })
        .eq('id', variables.id)
        .select()
        .single();

      if (error) throw error;
      return data as CustomTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customTags'] });
    },
  });
}

export function useDeleteCustomTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_tags')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customTags'] });
    },
  });
}

// Tag associations
export function useAddTagToExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { expenseId: string; tagId: string }) => {
      const { error } = await supabase
        .from('expense_tags')
        .insert({ expense_id: variables.expenseId, tag_id: variables.tagId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useRemoveTagFromExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { expenseId: string; tagId: string }) => {
      const { error } = await supabase
        .from('expense_tags')
        .delete()
        .match({ expense_id: variables.expenseId, tag_id: variables.tagId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useAddTagToDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { debtId: string; tagId: string }) => {
      const { error } = await supabase
        .from('debt_tags')
        .insert({ debt_id: variables.debtId, tag_id: variables.tagId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}

export function useRemoveTagFromDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { debtId: string; tagId: string }) => {
      const { error } = await supabase
        .from('debt_tags')
        .delete()
        .match({ debt_id: variables.debtId, tag_id: variables.tagId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}

export function useAddTagToIncome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { incomeId: string; tagId: string }) => {
      const { error } = await supabase
        .from('income_tags')
        .insert({ income_id: variables.incomeId, tag_id: variables.tagId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
    },
  });
}

export function useRemoveTagFromIncome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { incomeId: string; tagId: string }) => {
      const { error } = await supabase
        .from('income_tags')
        .delete()
        .match({ income_id: variables.incomeId, tag_id: variables.tagId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
    },
  });
}
