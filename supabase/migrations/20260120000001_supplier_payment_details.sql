-- Add more detailed fields to supplier_payments for better tracking
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'invoice' CHECK (payment_type IN ('invoice', 'deposit', 'balance', 'credit_memo', 'refund', 'other'));

-- Create index for invoice lookups
CREATE INDEX IF NOT EXISTS idx_supplier_payments_invoice ON public.supplier_payments(invoice_number);
