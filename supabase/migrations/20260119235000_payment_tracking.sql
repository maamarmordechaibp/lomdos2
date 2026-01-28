-- Add payment tracking fields to customer_orders
ALTER TABLE public.customer_orders
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid' 
  CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'pay_at_pickup')),
ADD COLUMN IF NOT EXISTS payment_method TEXT 
  CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card', 'check', 'mixed')),
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS balance_due DECIMAL(10,2) GENERATED ALWAYS AS (COALESCE(total_amount, final_price, 0) - amount_paid) STORED,
ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP WITH TIME ZONE;

-- Create customer_payments table for payment history
CREATE TABLE IF NOT EXISTS public.customer_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'check', 'other')),
  payment_type TEXT NOT NULL DEFAULT 'full' CHECK (payment_type IN ('deposit', 'partial', 'full', 'balance')),
  transaction_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;

-- Create open policy (use IF NOT EXISTS pattern with DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customer_payments' AND policyname = 'Allow all access to customer_payments'
  ) THEN
    CREATE POLICY "Allow all access to customer_payments"
      ON public.customer_payments FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add outstanding balance to customers if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'outstanding_balance'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN outstanding_balance DECIMAL(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add outstanding balance to suppliers if not exists  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suppliers' AND column_name = 'outstanding_balance'
  ) THEN
    ALTER TABLE public.suppliers ADD COLUMN outstanding_balance DECIMAL(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add is_paid and amount_paid to supplier_orders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'supplier_orders' AND column_name = 'is_paid'
  ) THEN
    ALTER TABLE public.supplier_orders ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'supplier_orders' AND column_name = 'total_cost'
  ) THEN
    ALTER TABLE public.supplier_orders ADD COLUMN total_cost DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'supplier_orders' AND column_name = 'amount_paid'
  ) THEN
    ALTER TABLE public.supplier_orders ADD COLUMN amount_paid DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;
