export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}
interface UpdateExpenseData {
  id: string;
  member_id?: string;
  category_id?: string;
  custom_category_id?: string;
  card_id?: string;
  bank_id?: string;
  output_mode?: string;
  amount?: number;
  description?: string;
  date?: string;
  is_recurring?: boolean;
  total_installments?: number;
  installment_number?: number;
  is_realized?: boolean;
  realized_date?: string;
  lend_card?: boolean;
  lend_to?: string | null;
  lend_card_family_public_id?: string | null;
  lend_money?: boolean;
  lend_money_to?: string | null;
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateExpenseData) => {
      const { id, ...fields } = data;
      const { data: expense, error } = await supabase
        .from('expenses')
        .update(fields)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return expense as Expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Income, Expense, ExpenseCategory, Bank, Card, Investment, RecurringExpense } from '@/types/finance';

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expense_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as ExpenseCategory[];
    },
  });
}

export function useIncomes(memberId?: string, month?: number, year?: number) {
  return useQuery({
    queryKey: ['incomes', memberId, month, year],
    queryFn: async () => {
      let query = supabase.from('incomes').select('*');
      
      if (memberId) query = query.eq('member_id', memberId);
      if (month !== undefined) query = query.eq('month', month);
      if (year !== undefined) query = query.eq('year', year);
      
      const { data, error } = await query.order('date', { ascending: false });
      
      if (error) throw error;
      return data as Income[];
    },
  });
}

export function useExpenses(memberId?: string, month?: number, year?: number) {
  return useQuery({
    queryKey: ['expenses', memberId, month, year],
    queryFn: async () => {
      let query = supabase.from('expenses').select('*');
      
      if (memberId) query = query.eq('member_id', memberId);
      if (month !== undefined) query = query.eq('month', month);
      if (year !== undefined) query = query.eq('year', year);
      
      const { data, error } = await query.order('date', { ascending: false });
      
      if (error) throw error;
      return data as Expense[];
    },
  });
}

export function useRecurringExpenses(memberId?: string) {
  return useQuery({
    queryKey: ['recurring_expenses', memberId],
    queryFn: async () => {
      let query = supabase.from('recurring_expenses').select('*').eq('is_active', true);
      
      if (memberId) query = query.eq('member_id', memberId);
      
      const { data, error } = await query.order('start_date', { ascending: false });
      
      if (error) throw error;
      return data as RecurringExpense[];
    },
  });
}

export function useBanks(memberId?: string) {
  return useQuery({
    queryKey: ['banks', memberId],
    queryFn: async () => {
      let query = supabase.from('banks').select('*');
      
      if (memberId) query = query.eq('member_id', memberId);
      
      const { data, error } = await query.order('name');
      
      if (error) throw error;
      return data as Bank[];
    },
  });
}

export function useCards(memberId?: string) {
  return useQuery({
    queryKey: ['cards', memberId],
    queryFn: async () => {
      let query = supabase.from('cards').select('*');
      
      if (memberId) query = query.eq('member_id', memberId);
      
      const { data, error } = await query.order('name');
      
      if (error) throw error;
      return data as Card[];
    },
  });
}

export function useInvestments(memberId?: string) {
  return useQuery({
    queryKey: ['investments', memberId],
    queryFn: async () => {
      let query = supabase.from('investments').select('*');
      
      if (memberId) query = query.eq('member_id', memberId);
      
      const { data, error } = await query.order('name');
      
      if (error) throw error;
      return data as Investment[];
    },
  });
}

interface CreateIncomeData {
  member_id: string;
  income_source_id?: string | null;
  amount: number;
  description?: string | null;
  date: string;
  bank_id?: string | null;
  is_realized?: boolean;
  realized_date?: string;
}

export function useCreateIncome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateIncomeData) => {
      const dateObj = new Date(data.date);
      
      // Garantir que valores explícitos sejam NULL, não undefined
      const insertData: any = {
        member_id: data.member_id,
        income_source_id: data.income_source_id === '' ? null : (data.income_source_id || null),
        amount: data.amount,
        description: data.description && data.description !== '' ? data.description : null,
        date: data.date,
        month: dateObj.getMonth() + 1,
        year: dateObj.getFullYear(),
        bank_id: data.bank_id === '' ? null : (data.bank_id || null),
        is_realized: data.is_realized ?? true,
        realized_date: data.realized_date || null,
      };
      
      const { data: income, error } = await supabase
        .from('incomes')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao inserir income:', error);
        throw new Error(`Erro ao registrar entrada: ${error.message}`);
      }

      return income as Income;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
    },
  });
}

interface CreateExpenseData {
  member_id: string;
  category_id?: string;
  custom_category_id?: string;
  card_id?: string;
  bank_id?: string;
  recurring_id?: string | null;
  amount: number;
  description: string;
  date: string;
  is_recurring?: boolean;
  total_installments?: number;
  lend_card?: boolean;
  lend_to?: string | null;
  lend_card_family_public_id?: string | null;
  lend_money?: boolean;
  lend_money_to?: string | null;
  first_installment_date?: string | null;
  last_installment_date?: string | null;
  is_realized?: boolean;
  realized_date?: string;
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateExpenseData) => {
      const dateObj = new Date(data.date);
      const month = dateObj.getMonth() + 1;
      const year = dateObj.getFullYear();

      if (data.is_recurring && data.total_installments && data.total_installments > 1) {
        // Cria o registro de recorrência
        const { data: recurring, error: recurringError } = await supabase
          .from('recurring_expenses')
          .insert({
            member_id: data.member_id,
            category_id: data.category_id,
            custom_category_id: data.custom_category_id ?? null,
            card_id: data.card_id,
            bank_id: data.bank_id ?? null,
            amount: data.amount,
            description: data.description,
            start_date: data.date,
            total_installments: data.total_installments,
            lend_card: data.lend_card ?? false,
            lend_to: data.lend_card ? data.lend_to : null,
            lend_card_family_public_id: data.lend_card_family_public_id ?? null,
            lend_money: data.lend_money ?? false,
            lend_money_to: data.lend_money ? data.lend_money_to : null,
          })
          .select()
          .single();

        if (recurringError) throw recurringError;

        // Lógica limpa: X parcelas, uma por mês, sempre no dia do fechamento
        const expenses = [];
        const baseDate = new Date(data.date);
        let closingDay = null;
        if (data.card_id) {
          // Buscar o cartão para pegar o closing_day
          const { data: cardData, error: cardError } = await supabase
            .from('cards')
            .select('closing_day')
            .eq('id', data.card_id)
            .single();
          if (cardError) throw cardError;
          closingDay = cardData?.closing_day;
        }
        // Calcular data da 1ª parcela
        let firstParcelDate = new Date(baseDate);
        if (closingDay !== null) {
          if (baseDate.getDate() <= closingDay) {
            // Antes do fechamento: 1ª parcela no fechamento deste mês
            firstParcelDate.setDate(closingDay);
          } else {
            // Depois do fechamento: 1ª parcela no fechamento do mês seguinte
            firstParcelDate.setMonth(firstParcelDate.getMonth() + 1);
            firstParcelDate.setDate(closingDay);
          }
        }
        // Criar as parcelas
        for (let i = 0; i < data.total_installments; i++) {
          const parcelaDate = new Date(firstParcelDate);
          parcelaDate.setMonth(firstParcelDate.getMonth() + i);
          // Corrige para meses com menos dias
          if (parcelaDate.getDate() !== closingDay) {
            parcelaDate.setDate(0);
          }
          let desc = data.description.replace(/\s*\(\d+\/\d+\)$/, '');
          desc = `${desc} (${i + 1}/${data.total_installments})`;
          expenses.push({
            member_id: data.member_id,
            category_id: data.category_id,
            custom_category_id: data.custom_category_id ?? null,
            card_id: data.card_id,
            bank_id: data.bank_id ?? null,
            amount: data.amount,
            description: desc,
            date: parcelaDate.toISOString().split('T')[0],
            month: parcelaDate.getMonth() + 1,
            year: parcelaDate.getFullYear(),
            is_recurring: true,
            recurring_id: recurring.id,
            installment_number: i + 1,
            total_installments: data.total_installments,
            is_realized: true,
            lend_card: data.lend_card,
            lend_to: data.lend_to,
            lend_card_family_public_id: data.lend_card_family_public_id ?? null,
            lend_money: data.lend_money ?? false,
            lend_money_to: data.lend_money ? data.lend_money_to : null,
            first_installment_date: i === 0 ? data.first_installment_date || parcelaDate.toISOString().split('T')[0] : null,
            last_installment_date: i === data.total_installments - 1 ? data.last_installment_date || parcelaDate.toISOString().split('T')[0] : null,
          });
        }
        // Remove duplicadas antes de inserir (garantia extra)
        for (const exp of expenses) {
          const { data: existing, error: existingError } = await supabase
            .from('expenses')
            .select('id')
            .eq('recurring_id', exp.recurring_id)
            .eq('installment_number', exp.installment_number)
            .eq('month', exp.month)
            .eq('year', exp.year);
          if (existingError) throw existingError;
          if (!existing || existing.length === 0) {
            const { error } = await supabase.from('expenses').insert(exp);
            if (error) throw error;
          }
        }
        return recurring;
      } else {
        // Create single expense
        const insertPayload: any = {
          member_id: data.member_id,
          category_id: data.category_id,
          custom_category_id: data.custom_category_id ?? null,
          card_id: data.card_id,
          bank_id: data.bank_id ?? null,
          amount: data.amount,
          description: data.description,
          date: data.date,
          month,
          year,
          is_recurring: false,
          lend_card: data.lend_card,
          lend_to: data.lend_to,
          lend_card_family_public_id: data.lend_card_family_public_id ?? null,
          lend_money: data.lend_money ?? false,
          lend_money_to: data.lend_money ? data.lend_money_to : null,
          first_installment_date: data.first_installment_date ?? null,
          last_installment_date: data.last_installment_date ?? null,
          installment_number: data.installment_number ?? null,
          total_installments: data.total_installments ?? null,
          is_realized: data.is_realized ?? false,
          realized_date: data.realized_date ?? null,
        };

        if (data.recurring_id) {
          insertPayload.recurring_id = data.recurring_id;
        }

        let { data: expense, error } = await supabase
          .from('expenses')
          .insert(insertPayload)
          .select()
          .single();

        // Backward compatibility for environments where recurring_id is still missing.
        if (error && data.recurring_id && /recurring_id/i.test(String(error.message || ''))) {
          delete insertPayload.recurring_id;
          const retry = await supabase
            .from('expenses')
            .insert(insertPayload)
            .select()
            .single();
          expense = retry.data;
          error = retry.error;
        }

        if (error) throw error;
        return expense as Expense;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses'] });
    },
  });
}

interface CreateBankData {
  member_id: string;
  name: string;
  account_type?: string;
  balance?: number;
}

export function useCreateBank() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBankData) => {
      const { data: bank, error } = await supabase
        .from('banks')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return bank as Bank;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banks'] });
    },
  });
}

interface CreateCardData {
  member_id: string;
  name: string;
  card_type?: string;
  credit_limit?: number;
  closing_day?: number;
  due_day?: number;
}

export function useCreateCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCardData) => {
      const { data: card, error } = await supabase
        .from('cards')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return card as Card;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });
}

interface CreateInvestmentData {
  member_id: string;
  name: string;
  type: string;
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
  current_value?: number;
  initial_value?: number;
  start_date?: string;
  notes?: string;
}

export function useCreateInvestment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInvestmentData) => {
      const { data: investment, error } = await supabase
        .from('investments')
        .insert(data)
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
