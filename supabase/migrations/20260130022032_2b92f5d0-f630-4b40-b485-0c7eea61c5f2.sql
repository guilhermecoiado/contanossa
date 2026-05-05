-- Enum para tipos de transação
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');

-- Enum para frequência de recorrência
CREATE TYPE public.recurrence_frequency AS ENUM ('monthly', 'weekly', 'yearly');

-- Tabela de membros da família
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de fontes de renda
CREATE TABLE public.income_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12,2),
  is_fixed BOOLEAN NOT NULL DEFAULT true,
  entry_day INTEGER CHECK (entry_day >= 1 AND entry_day <= 31),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Categorias de gastos padrão
CREATE TABLE public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir categorias padrão
INSERT INTO public.expense_categories (name, icon, color, is_default) VALUES
  ('Saúde', 'heart-pulse', '#ef4444', true),
  ('Entretenimento', 'gamepad-2', '#8b5cf6', true),
  ('Viagem', 'plane', '#06b6d4', true),
  ('Compras', 'shopping-bag', '#f59e0b', true),
  ('Combustível', 'fuel', '#84cc16', true),
  ('Alimentação', 'utensils', '#ec4899', true),
  ('Moradia', 'home', '#3b82f6', true),
  ('Transporte', 'car', '#6366f1', true),
  ('Educação', 'graduation-cap', '#14b8a6', true),
  ('Outros', 'more-horizontal', '#6b7280', true);

-- Tabela de bancos
CREATE TABLE public.banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type TEXT,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de cartões
CREATE TABLE public.cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  card_type TEXT NOT NULL DEFAULT 'credit',
  credit_limit DECIMAL(12,2),
  closing_day INTEGER CHECK (closing_day >= 1 AND closing_day <= 31),
  due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de investimentos/poupança
CREATE TABLE public.investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  current_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  initial_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  start_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de entradas (receitas)
CREATE TABLE public.incomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  income_source_id UUID REFERENCES public.income_sources(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de despesas
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT NOT NULL,
  date DATE NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_id UUID,
  installment_number INTEGER,
  total_installments INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de recorrências (para gerar automaticamente)
CREATE TABLE public.recurring_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT NOT NULL,
  start_date DATE NOT NULL,
  total_installments INTEGER NOT NULL,
  current_installment INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_income_sources_updated_at BEFORE UPDATE ON public.income_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_banks_updated_at BEFORE UPDATE ON public.banks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON public.cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON public.investments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_recurring_expenses_updated_at BEFORE UPDATE ON public.recurring_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS em todas as tabelas
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Permitir acesso público (app sem auth supabase, auth próprio)
CREATE POLICY "Allow all operations on members" ON public.members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on income_sources" ON public.income_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow read on expense_categories" ON public.expense_categories FOR SELECT USING (true);
CREATE POLICY "Allow all operations on banks" ON public.banks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on cards" ON public.cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on investments" ON public.investments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on incomes" ON public.incomes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on recurring_expenses" ON public.recurring_expenses FOR ALL USING (true) WITH CHECK (true);