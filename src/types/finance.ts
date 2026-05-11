export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  username: string;
  password_hash: string | null;
  avatar_url: string | null;
  auth_user_id: string | null;
  family_id: string | null;
  family_public_id: string | null;
  account_setup_assistant_dismissed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncomeSource {
  id: string;
  member_id: string;
  name: string;
  amount: number | null;
  is_fixed: boolean;
  entry_day: number | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Bank {
  id: string;
  member_id: string;
  name: string;
  account_type: string | null;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  member_id: string;
  name: string;
  card_type: string;
  credit_limit: number | null;
  closing_day: number | null;
  due_day: number | null;
  used_limit: number | null; // Calculado automaticamente pelo trigger
  available_limit: number | null; // Calculado automaticamente pelo trigger
  used_limit_manual_offset: number | null; // Ajuste manual do usuário sobre o limite utilizado
  available_limit_manual_offset: number | null; // Ajuste manual do usuário sobre o limite disponível
  is_blocked: boolean; // Cartão bloqueado para novas transações
  created_at: string;
  updated_at: string;
}

export interface Investment {
  id: string;
  member_id: string;
  name: string;
  type: string;
  symbol: string | null;
  quantity: number | null;
  purchase_price: number | null;
  consortium_credit_value: number | null;
  consortium_monthly_value: number | null;
  consortium_term_months: number | null;
  consortium_is_contemplated: boolean | null;
  consortium_contemplated_value: number | null;
  consortium_will_sell: boolean | null;
  consortium_sale_value: number | null;
  cdb_bank_name: string | null;
  cdb_indexer: string | null;
  cdb_rate_percent: number | null;
  current_value: number;
  initial_value: number;
  start_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Income {
  id: string;
  member_id: string;
  income_source_id: string | null;
  bank_id?: string | null;
  amount: number;
  description: string | null;
  date: string;
  month: number;
  year: number;
  is_realized: boolean;
  realized_date?: string;
  created_at: string;
}

export interface Expense {
  id: string;
  member_id: string;
  category_id: string | null;
  custom_category_id?: string | null;
  card_id: string | null;
  bank_id: string | null;
  output_mode: string | null;
  amount: number;
  description: string;
  date: string;
  month: number;
  year: number;
  is_recurring: boolean;
  recurring_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
  is_realized: boolean;
  realized_date?: string;
  created_at: string;
  lend_card?: boolean;
  lend_to?: string | null;
  lend_card_family_public_id?: string | null;
  lend_money?: boolean;
  lend_money_to?: string | null;
}

export interface RecurringExpense {
  id: string;
  member_id: string;
  category_id: string | null;
  custom_category_id?: string | null;
  card_id: string | null;
  bank_id?: string | null;
  amount: number;
  description: string;
  start_date: string;
  total_installments: number;
  current_installment: number;
  is_active: boolean;
  lend_card?: boolean;
  lend_to?: string | null;
  lend_card_family_public_id?: string | null;
  lend_money?: boolean;
  lend_money_to?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberFinancialHealth {
  member: Member;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  incomeSources: IncomeSource[];
}

export interface FamilyHealth {
  totalIncome: number;
  totalExpenses: number;
  totalBalance: number;
  totalSavings: number;
  members: MemberFinancialHealth[];
}

export interface Debt {
  id: string;
  member_id: string;
  name: string;
  type: string;
  custom_type?: string | null;
  initial_value: number;
  current_value: number;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
}
