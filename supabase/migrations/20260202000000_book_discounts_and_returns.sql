-- Add fixed discount amount to books (in addition to percentage margin)
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS fixed_discount DECIMAL(10, 2) DEFAULT NULL;

-- Add discount type to track which discount type to use
-- 'percentage' uses custom_profit_margin, 'fixed' uses fixed_discount
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed'));

-- Add store_credit field to customers for tracking store credit balance
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS store_credit DECIMAL(10, 2) DEFAULT 0;

-- Add refund tracking to returns table
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS refund_type TEXT DEFAULT NULL CHECK (refund_type IN ('cash', 'card', 'store_credit'));
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2) DEFAULT NULL;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS refund_transaction_id TEXT DEFAULT NULL;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS original_payment_method TEXT DEFAULT NULL;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ DEFAULT NULL;

-- Add edit tracking to customer_payments for audit trail
ALTER TABLE public.customer_payments ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE public.customer_payments ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10, 2) DEFAULT NULL;
ALTER TABLE public.customer_payments ADD COLUMN IF NOT EXISTS edit_reason TEXT DEFAULT NULL;
ALTER TABLE public.customer_payments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.customer_payments ADD COLUMN IF NOT EXISTS edited_by UUID DEFAULT NULL;

-- Add refund payments support - negative amount for refunds
ALTER TABLE public.customer_payments ADD COLUMN IF NOT EXISTS is_refund BOOLEAN DEFAULT FALSE;
ALTER TABLE public.customer_payments ADD COLUMN IF NOT EXISTS return_id UUID REFERENCES public.returns(id) DEFAULT NULL;

-- Create index for better query performance on returns
CREATE INDEX IF NOT EXISTS idx_returns_customer_order_id ON public.returns(customer_order_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_return_id ON public.customer_payments(return_id);
