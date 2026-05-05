import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Member, IncomeSource } from '@/types/finance';

function mapEmailDuplicateError(error: any): any {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '').toLowerCase();
  const details = String(error?.details ?? '').toLowerCase();
  const hint = String(error?.hint ?? '').toLowerCase();

  if (code === '23505' && (message.includes('email') || details.includes('email') || hint.includes('email'))) {
    return new Error('Este email ja esta cadastrado. Use outro email.');
  }

  return error;
}

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Member[];
    },
  });
}

export function useMember(id: string) {
  return useQuery({
    queryKey: ['member', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Member;
    },
    enabled: !!id,
  });
}

export interface CreateMemberData {
  name: string;
  email: string;
  phone?: string | null;
  incomeSources: {
    name: string;
    amount?: number | null;
    is_fixed: boolean;
    entry_day?: number | null;
  }[];
}

export interface UpdateMemberData {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  incomeSources: {
    id?: string;
    name: string;
    amount?: number | null;
    is_fixed: boolean;
    entry_day?: number | null;
  }[];
  existingSourceIds: string[];
}

export function useCreateMember() {
  const queryClient = useQueryClient();
  const { currentMember } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateMemberData) => {
      const { data: member, error: memberError } = await supabase
        .from('members')
        .insert({
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          family_id: currentMember.family_id,
        })
        .select()
        .single();

      if (memberError) throw mapEmailDuplicateError(memberError);

      if (data.incomeSources.length > 0) {
        const incomeSourcesToInsert = data.incomeSources.map(source => ({
          member_id: member.id,
          name: source.name,
          amount: source.amount || null,
          is_fixed: source.is_fixed,
          entry_day: source.entry_day || null,
        }));

        const { error: sourceError } = await supabase
          .from('income_sources')
          .insert(incomeSourcesToInsert);

        if (sourceError) throw sourceError;
      }

      return member as Member;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['income_sources'] });
    },
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateMemberData) => {
      // Atualizar informações do membro
      const { error: memberError } = await supabase
        .from('members')
        .update({
          name: data.name,
          email: data.email,
          phone: data.phone || null,
        })
        .eq('id', data.id);

      if (memberError) {
        console.error('[useUpdateMember] Erro ao atualizar membro:', memberError);
        throw mapEmailDuplicateError(memberError);
      }

      // Obter IDs das fontes que foram removidas
      const newSourceIds = data.incomeSources
        .filter(s => s.id)
        .map(s => s.id!);
      
      const sourcesToDelete = data.existingSourceIds.filter(id => !newSourceIds.includes(id));

      // Deletar fontes removidas
      if (sourcesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('income_sources')
          .delete()
          .in('id', sourcesToDelete);

        if (deleteError) {
          console.error('[useUpdateMember] Erro ao deletar fontes:', deleteError);
          throw deleteError;
        }
      }

      // Atualizar ou criar fontes de renda
      for (const source of data.incomeSources) {
        if (source.id) {
          // Atualizar fonte existente
          const { error: updateError } = await supabase
            .from('income_sources')
            .update({
              name: source.name,
              amount: source.amount || null,
              is_fixed: source.is_fixed,
              entry_day: source.entry_day || null,
            })
            .eq('id', source.id);

          if (updateError) {
            console.error('[useUpdateMember] Erro ao atualizar fonte:', updateError);
            throw updateError;
          }
        } else {
          // Criar nova fonte
          const { error: insertError } = await supabase
            .from('income_sources')
            .insert({
              member_id: data.id,
              name: source.name,
              amount: source.amount || null,
              is_fixed: source.is_fixed,
              entry_day: source.entry_day || null,
            });

          if (insertError) {
            console.error('[useUpdateMember] Erro ao criar fonte:', insertError);
            throw insertError;
          }
        }
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['income_sources'] });
    },
    onError: (error) => {
      console.error('[useUpdateMember] Erro na mutacao:', error);
    },
  });
}

export function useIncomeSources(memberId?: string) {
  return useQuery({
    queryKey: ['income_sources', memberId],
    queryFn: async () => {
      let query = supabase.from('income_sources').select('*');
      
      if (memberId) {
        query = query.eq('member_id', memberId);
      }
      
      const { data, error } = await query.order('name');
      
      if (error) throw error;
      return data as IncomeSource[];
    },
  });
}

export function useDeleteIncomeSources() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceIds: string[]) => {
      const { error } = await supabase
        .from('income_sources')
        .delete()
        .in('id', sourceIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income_sources'] });
    },
  });
}

export function useDeleteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      // Buscar o membro para obter auth_user_id e email
      const { data: member, error: memberFetchError } = await supabase
        .from('members')
        .select('auth_user_id, email')
        .eq('id', memberId)
        .single();

      if (memberFetchError) throw memberFetchError;

      // Se o membro tem acesso ao painel (auth_user_id), deletar o usuário do Auth
      if (member?.auth_user_id) {
        try {
          // Deletar via RPC
          const { error: rpcError } = await supabase
            .rpc('delete_auth_user', { user_id: member.auth_user_id });

          if (rpcError) {
            console.error('[useDeleteMember] Erro na RPC ao deletar:', rpcError.message);
            throw new Error(`Falha ao remover usuário do Auth: ${rpcError.message}`);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[useDeleteMember] Erro ao remover usuário do Auth:', message);
          throw new Error(`Erro ao deletar: ${message}`);
        }
      }

      // Deletar todas as fontes de renda do membro
      const { error: sourcesError } = await supabase
        .from('income_sources')
        .delete()
        .eq('member_id', memberId);

      if (sourcesError) throw sourcesError;

      // Deletar o membro
      const { error: memberError } = await supabase
        .from('members')
        .delete()
        .eq('id', memberId);

      if (memberError) throw memberError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['income_sources'] });
    },
  });
}

export function useRemovePanelAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      // Buscar o membro para obter auth_user_id
      const { data: member, error: memberFetchError } = await supabase
        .from('members')
        .select('auth_user_id')
        .eq('id', memberId)
        .single();

      if (memberFetchError) throw memberFetchError;

      // Se o membro tem auth_user_id, deletar do Auth
      if (member?.auth_user_id) {
        try {
          const { error: rpcError } = await supabase
            .rpc('delete_auth_user', { user_id: member.auth_user_id });

          if (rpcError) {
            console.error('[useRemovePanelAccess] Erro na RPC ao deletar:', rpcError.message);
            throw new Error(`Falha ao remover usuário do Auth: ${rpcError.message}`);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[useRemovePanelAccess] Erro ao deletar usuário do Auth:', message);
          throw new Error(`Erro ao deletar acesso do painel: ${message}`);
        }
      }

      // Remover o auth_user_id do membro (apenas desabilita acesso, não deleta o membro)
      const { error: updateError } = await supabase
        .from('members')
        .update({ auth_user_id: null })
        .eq('id', memberId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });
}

