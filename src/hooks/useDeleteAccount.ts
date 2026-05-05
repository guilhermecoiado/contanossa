import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useDeleteAccount() {
  const { user, currentMember, logout } = useAuth();

  const deleteAccount = useCallback(async () => {
    if (!user?.id || !currentMember?.id) {
      throw new Error('Usuário não identificado');
    }

    try {
      // PRIMEIRO: Cancelar subscription no Stripe se existir
      const stripeSubscriptionId = user.user_metadata?.stripe_subscription_id;
      if (stripeSubscriptionId) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          
          if (token) {
            // Chamar função edge para cancelar subscription
            const { error: cancelError } = await supabase.functions.invoke('cancel-stripe-subscription', {
              body: {
                subscription_id: stripeSubscriptionId,
              },
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (cancelError) {
              console.error('[deleteAccount] Erro ao cancelar subscription no Stripe:', cancelError);
              // Continua mesmo se falhar, pois a conta será deletada
            }
          }
        } catch (err) {
          console.error('[deleteAccount] Erro ao chamar cancel-stripe-subscription:', err);
          // Continua mesmo se falhar
        }
      }
      
      const memberId = currentMember.id;
      const authUserId = currentMember.auth_user_id;
      const familyId = currentMember.family_id;

      const memberIds: string[] = [];
      const authUserIds: string[] = [];

      if (familyId) {
        const { data: familyMembers, error: familyError } = await supabase
          .from('members')
          .select('id, auth_user_id')
          .eq('family_id', familyId);

        if (familyError) {
          console.error('[deleteAccount] Erro ao buscar membros da familia:', familyError);
        } else {
          for (const member of familyMembers ?? []) {
            memberIds.push(member.id);
            if (member.auth_user_id) authUserIds.push(member.auth_user_id);
          }
        }
      }

      if (memberIds.length === 0) {
        memberIds.push(memberId);
      }
      if (authUserId && !authUserIds.includes(authUserId)) {
        authUserIds.push(authUserId);
      }

      // PRIMEIRO: Deletar todos os dados relacionados ao membro (na ordem correta)
      
      // 1. Deletar entradas (incomes)
      const { error: incomesError } = await supabase
        .from('incomes')
        .delete()
        .in('member_id', memberIds);
      if (incomesError) {
        console.error('[deleteAccount] Erro ao deletar incomes:', incomesError);
      }

      // 2. Deletar saídas (expenses)
      const { error: expensesError } = await supabase
        .from('expenses')
        .delete()
        .in('member_id', memberIds);
      if (expensesError) {
        console.error('[deleteAccount] Erro ao deletar expenses:', expensesError);
      }

      // 3. Deletar despesas recorrentes
      const { error: recurringError } = await supabase
        .from('recurring_expenses')
        .delete()
        .in('member_id', memberIds);
      if (recurringError) {
        console.error('[deleteAccount] Erro ao deletar recurring_expenses:', recurringError);
      }

      // 4. Deletar investimentos
      const { error: investmentsError } = await supabase
        .from('investments')
        .delete()
        .in('member_id', memberIds);
      if (investmentsError) {
        console.error('[deleteAccount] Erro ao deletar investments:', investmentsError);
      }

      // 5. Deletar dívidas
      const { error: debtsError } = await supabase
        .from('debts')
        .delete()
        .in('member_id', memberIds);
      if (debtsError) {
        console.error('[deleteAccount] Erro ao deletar debts:', debtsError);
      }

      // 6. Deletar cartões
      const { error: cardsError } = await supabase
        .from('cards')
        .delete()
        .in('member_id', memberIds);
      if (cardsError) {
        console.error('[deleteAccount] Erro ao deletar cards:', cardsError);
      }

      // 7. Deletar bancos
      const { error: banksError } = await supabase
        .from('banks')
        .delete()
        .in('member_id', memberIds);
      if (banksError) {
        console.error('[deleteAccount] Erro ao deletar banks:', banksError);
      }

      // 8. Deletar fontes de renda
      const { error: sourcesError } = await supabase
        .from('income_sources')
        .delete()
        .in('member_id', memberIds);
      if (sourcesError) {
        console.error('[deleteAccount] Erro ao deletar income_sources:', sourcesError);
      }

      // 9. Deletar o membro da tabela members
      const { error: memberError } = await supabase
        .from('members')
        .delete()
        .in('id', memberIds);
      if (memberError) {
        console.error('[deleteAccount] Erro ao deletar member:', memberError);
        throw new Error(`Erro ao deletar membro: ${memberError.message}`);
      }

      // POR ÚLTIMO: Deletar usuário do Auth (para não perder autenticação antes)
      if (authUserIds.length > 0) {
        const uniqueAuthUserIds = Array.from(new Set(authUserIds));
        for (const id of uniqueAuthUserIds) {
          try {
            const { error: rpcError } = await (supabase as any)
              .rpc('delete_auth_user', { user_id: id });

            if (rpcError) {
              console.error('[deleteAccount] Erro na RPC ao deletar do Auth:', rpcError.message);
              // Não bloqueia aqui, pois os dados já foram deletados
            }
          } catch (err) {
            console.error('[deleteAccount] Erro ao remover do Auth:', err);
            // Não bloqueia aqui, pois os dados já foram deletados
          }
        }
      }

      // Fazer logout
      await logout();
    } catch (err) {
      console.error('[deleteAccount] Erro crítico ao deletar conta:', err);
      throw err;
    }
  }, [user, currentMember, logout]);

  return { deleteAccount };
}
