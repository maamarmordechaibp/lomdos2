-- Migration: Multi-book orders, customer balances, supplier payments, and financials
-- This migration restructures customer orders to support multiple books per order

-- Step 1: Create customer_order_items table to store individual items
CREATE TABLE IF NOT EXISTS public.customer_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2), -- Final price per unit
  unit_cost DECIMAL(10,2), -- Cost from supplier
  from_stock BOOLEAN NOT NULL DEFAULT false, -- Whether fulfilled from inventory
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'received', 'ready', 'picked_up', 'cancelled')),
  supplier_order_id UUID REFERENCES public.supplier_orders(id) ON DELETE SET NULL,
  received_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 2: Add new columns to customer_orders for order-level tracking
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS is_bill BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2);
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS balance_due DECIMAL(10,2) DEFAULT 0;

-- Step 3: Create customer_payments table for tracking payments
CREATE TABLE IF NOT EXISTS public.customer_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'check', 'credit', 'other')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 4: Add balance tracking to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS outstanding_balance DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Step 5: Create supplier_payments table
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  supplier_order_id UUID REFERENCES public.supplier_orders(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'check' CHECK (payment_method IN ('cash', 'check', 'credit', 'wire', 'other')),
  receipt_url TEXT, -- URL to uploaded receipt/invoice
  notes TEXT,
  paid_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 6: Add payment tracking to supplier_orders
ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10,2);
ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;

-- Step 7: Add outstanding balance to suppliers
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS outstanding_balance DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Step 8: Create expenses table for store expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('rent', 'utilities', 'supplies', 'payroll', 'marketing', 'shipping', 'other')),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  receipt_url TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_tax_deductible BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.customer_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all access to customer_order_items" ON public.customer_order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to customer_payments" ON public.customer_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to supplier_payments" ON public.supplier_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

-- Create triggers for updated_at
CREATE TRIGGER update_customer_order_items_updated_at BEFORE UPDATE ON public.customer_order_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key from customer_order_items to customer_orders
ALTER TABLE public.customer_order_items ADD CONSTRAINT customer_order_items_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES public.customer_orders(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX idx_customer_order_items_order ON public.customer_order_items(order_id);
CREATE INDEX idx_customer_order_items_book ON public.customer_order_items(book_id);
CREATE INDEX idx_customer_order_items_status ON public.customer_order_items(status);
CREATE INDEX idx_customer_payments_customer ON public.customer_payments(customer_id);
CREATE INDEX idx_customer_payments_order ON public.customer_payments(order_id);
CREATE INDEX idx_supplier_payments_supplier ON public.supplier_payments(supplier_id);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX idx_expenses_category ON public.expenses(category);
CREATE INDEX idx_customers_balance ON public.customers(outstanding_balance) WHERE outstanding_balance > 0;
CREATE INDEX idx_suppliers_balance ON public.suppliers(outstanding_balance) WHERE outstanding_balance > 0;

-- Create a view for financial reporting
CREATE OR REPLACE VIEW public.financial_summary AS
SELECT 
  DATE_TRUNC('month', created_at) as month,
  'revenue' as type,
  SUM(COALESCE(final_price, 0)) as amount
FROM public.customer_orders
WHERE status = 'picked_up'
GROUP BY DATE_TRUNC('month', created_at)
UNION ALL
SELECT 
  DATE_TRUNC('month', created_at) as month,
  'cost' as type,
  SUM(COALESCE(actual_cost, 0)) as amount
FROM public.customer_orders
WHERE status = 'picked_up'
GROUP BY DATE_TRUNC('month', created_at)
UNION ALL
SELECT 
  DATE_TRUNC('month', expense_date) as month,
  'expense' as type,
  SUM(amount) as amount
FROM public.expenses
GROUP BY DATE_TRUNC('month', expense_date);
