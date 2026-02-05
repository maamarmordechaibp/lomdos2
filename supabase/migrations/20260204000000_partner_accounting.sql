-- Partner Accounting and Debt Tracking
-- This migration adds tables for:
-- 1. Partner draws/distributions
-- 2. Business debts/liabilities
-- 3. Debt payments

-- Partner draws (withdrawals/distributions)
CREATE TABLE IF NOT EXISTS partner_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  draw_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business debts/liabilities
CREATE TABLE IF NOT EXISTS business_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creditor_name TEXT NOT NULL,
  description TEXT,
  original_amount DECIMAL(10,2) NOT NULL,
  current_balance DECIMAL(10,2) NOT NULL,
  due_date DATE,
  is_paid_off BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Debt payments
CREATE TABLE IF NOT EXISTS debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES business_debts(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add partner settings to global_settings if columns don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_settings' AND column_name = 'partner1_name') THEN
    ALTER TABLE global_settings ADD COLUMN partner1_name TEXT DEFAULT 'Partner 1';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_settings' AND column_name = 'partner2_name') THEN
    ALTER TABLE global_settings ADD COLUMN partner2_name TEXT DEFAULT 'Partner 2';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_settings' AND column_name = 'max_draw_percentage') THEN
    ALTER TABLE global_settings ADD COLUMN max_draw_percentage DECIMAL(5,2) DEFAULT 10.00;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_settings' AND column_name = 'profit_split_percentage') THEN
    ALTER TABLE global_settings ADD COLUMN profit_split_percentage DECIMAL(5,2) DEFAULT 50.00;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE partner_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all for authenticated users" ON partner_draws FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON business_debts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON debt_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_partner_draws_date ON partner_draws(draw_date);
CREATE INDEX IF NOT EXISTS idx_partner_draws_partner ON partner_draws(partner_name);
CREATE INDEX IF NOT EXISTS idx_business_debts_paid ON business_debts(is_paid_off);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);
