-- Create custom_categories table
CREATE TABLE custom_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'debt', 'income')),
  color TEXT, -- opcional, para futura expansão visual
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name, type)
);

-- Create custom_tags table
CREATE TABLE custom_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6', -- cor padrão azul
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Create junction tables for many-to-many relationships
CREATE TABLE expense_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES custom_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(expense_id, tag_id)
);

CREATE TABLE debt_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES custom_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(debt_id, tag_id)
);

CREATE TABLE income_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  income_id UUID NOT NULL REFERENCES incomes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES custom_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(income_id, tag_id)
);

-- Add RLS policies for custom_categories
ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories"
  ON custom_categories
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own categories"
  ON custom_categories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON custom_categories
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON custom_categories
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add RLS policies for custom_tags
ALTER TABLE custom_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tags"
  ON custom_tags
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tags"
  ON custom_tags
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags"
  ON custom_tags
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags"
  ON custom_tags
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add RLS policies for junction tables (simplified - users can manage tags on their own records)
ALTER TABLE expense_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage tags on own expenses"
  ON expense_tags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM expenses WHERE id = expense_id AND member_id IN (SELECT get_my_family_member_ids())
    )
  );

CREATE POLICY "Users can manage tags on own debts"
  ON debt_tags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM debts WHERE id = debt_id AND member_id IN (SELECT get_my_family_member_ids())
    )
  );

CREATE POLICY "Users can manage tags on own incomes"
  ON income_tags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM incomes WHERE id = income_id AND member_id IN (SELECT get_my_family_member_ids())
    )
  );

-- Allow custom categories on expenses/recurring expenses
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS custom_category_id UUID REFERENCES custom_categories(id) ON DELETE SET NULL;

ALTER TABLE public.recurring_expenses
  ADD COLUMN IF NOT EXISTS custom_category_id UUID REFERENCES custom_categories(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX idx_custom_categories_user_id ON custom_categories(user_id);
CREATE INDEX idx_custom_categories_user_type ON custom_categories(user_id, type);
CREATE INDEX idx_custom_tags_user_id ON custom_tags(user_id);
CREATE INDEX idx_expense_tags_expense_id ON expense_tags(expense_id);
CREATE INDEX idx_debt_tags_debt_id ON debt_tags(debt_id);
CREATE INDEX idx_income_tags_income_id ON income_tags(income_id);
