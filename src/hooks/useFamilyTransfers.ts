import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type FamilyTransferStatus =
  | 'pending_confirmation'
  | 'confirmed_waiting_payment'
  | 'payment_received'
  | 'rejected';

export interface FamilyTransferRecipient {
  member_id: string;
  member_name: string;
  family_public_id: string;
}

export interface FamilyTransfer {
  id: string;
  creditor_member_id: string;
  debtor_member_id: string;
  creditor_name?: string | null;
  debtor_name?: string | null;
  creditor_expense_id: string | null;
  debtor_expense_id: string | null;
  creditor_income_id: string | null;
  creditor_bank_id?: string | null;
  description: string;
  amount: number;
  requested_date: string;
  payment_date: string | null;
  payment_bank_id: string | null;
  status: FamilyTransferStatus;
  confirmed_at: string | null;
  rejected_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  creditor?: { id: string; name: string } | null;
  debtor?: { id: string; name: string } | null;
}

export async function resolveFamilyTransferRecipient(
  familyPublicId: string,
): Promise<FamilyTransferRecipient | null> {
  const normalizedId = familyPublicId.trim().toUpperCase();
  if (!normalizedId) return null;

  const { data, error } = await (supabase as any).rpc('resolve_member_by_family_public_id', {
    p_family_public_id: normalizedId,
  });

  if (error) {
    console.error('[resolveFamilyTransferRecipient] RPC error:', error);
    throw error;
  }

  const recipient = Array.isArray(data) ? data[0] : null;
  console.log('[resolveFamilyTransferRecipient] Resolved:', { normalizedId, recipient });
  return recipient ?? null;
}

export function useFamilyTransfers(memberId?: string) {
  return useQuery({
    queryKey: ['family_transfer_requests', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('family_transfer_requests')
        .select(`
          *,
          creditor:members!family_transfer_requests_creditor_member_id_fkey(id,name),
          debtor:members!family_transfer_requests_debtor_member_id_fkey(id,name)
        `)
        .or(`creditor_member_id.eq.${memberId},debtor_member_id.eq.${memberId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useFamilyTransfers] Query error:', error);
        throw error;
      }
      
      console.log('[useFamilyTransfers] Retrieved transfers:', data);
      return (data || []) as FamilyTransfer[];
    },
  });
}

interface CreateFamilyTransferRequestData {
  creditor_member_id: string;
  debtor_member_id: string;
  creditor_name?: string;
  debtor_name?: string;
  creditor_expense_id: string;
  creditor_bank_id?: string;
  description: string;
  amount: number;
  requested_date: string;
}

export function useCreateFamilyTransferRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateFamilyTransferRequestData) => {
      console.log('[useCreateFamilyTransferRequest] Inserting:', data);
      
      const { data: created, error } = await (supabase as any)
        .from('family_transfer_requests')
        .insert({
          ...data,
          status: 'pending_confirmation',
        })
        .select()
        .single();

      if (error) {
        console.error('[useCreateFamilyTransferRequest] Insert error:', error);
        throw error;
      }
      
      console.log('[useCreateFamilyTransferRequest] Created:', created);
      return created as FamilyTransfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family_transfer_requests'] });
    },
  });
}

interface UpdateFamilyTransferStatusData {
  transferId: string;
  status: FamilyTransferStatus;
}

export function useUpdateFamilyTransferStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transferId, status }: UpdateFamilyTransferStatusData) => {
      const patch: Record<string, any> = { status };

      if (status === 'confirmed_waiting_payment') {
        patch.confirmed_at = new Date().toISOString();
      }
      if (status === 'rejected') {
        patch.rejected_at = new Date().toISOString();
      }
      if (status === 'pending_confirmation') {
        patch.confirmed_at = null;
        patch.rejected_at = null;
      }

      const { data, error } = await (supabase as any)
        .from('family_transfer_requests')
        .update(patch)
        .eq('id', transferId)
        .select()
        .single();

      if (error) throw error;
      return data as FamilyTransfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family_transfer_requests'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
    },
  });
}

interface RegisterFamilyTransferPaymentData {
  transfer: FamilyTransfer;
  paymentDate: string;
  paymentBankId: string;
}

export function useRegisterFamilyTransferPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transfer, paymentDate, paymentBankId }: RegisterFamilyTransferPaymentData) => {
      console.log('[useRegisterFamilyTransferPayment] Calling RPC with:', {
        transferId: transfer.id,
        debtorId: transfer.debtor_member_id,
        creditorId: transfer.creditor_member_id,
        amount: transfer.amount,
        paymentDate,
        paymentBankId,
      });

      const { data, error } = await (supabase as any).rpc('register_family_transfer_payment', {
        p_transfer_id: transfer.id,
        p_debtor_member_id: transfer.debtor_member_id,
        p_creditor_member_id: transfer.creditor_member_id,
        p_amount: transfer.amount,
        p_description: transfer.description,
        p_payment_date: paymentDate,
        p_payment_bank_id: paymentBankId,
      });

      if (error) {
        console.error('[useRegisterFamilyTransferPayment] RPC error:', error);
        throw error;
      }

      console.log('[useRegisterFamilyTransferPayment] Success:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family_transfer_requests'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      queryClient.invalidateQueries({ queryKey: ['family-health'] });
    },
  });
}

export function useDeleteFamilyTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transferId: string) => {
      console.log('[useDeleteFamilyTransfer] Deleting transfer:', transferId);

      const { error } = await (supabase as any)
        .from('family_transfer_requests')
        .delete()
        .eq('id', transferId);

      if (error) {
        console.error('[useDeleteFamilyTransfer] Delete error:', error);
        throw error;
      }

      console.log('[useDeleteFamilyTransfer] Deleted successfully');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family_transfer_requests'] });
    },
  });
}
