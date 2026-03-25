-- Create promo codes table for discount management
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL,
  -- Date range
  start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  -- Usage limits
  max_uses INTEGER, -- NULL means unlimited
  current_uses INTEGER NOT NULL DEFAULT 0,
  max_uses_per_customer INTEGER DEFAULT 1, -- How many times each customer can use it
  -- Minimum requirements
  minimum_order_amount DECIMAL(10, 2),
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Track promo code usage per customer
CREATE TABLE IF NOT EXISTS public.promo_code_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  discount_applied DECIMAL(10, 2) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

-- Create open policies for internal app
CREATE POLICY "Allow all access to promo_codes" ON public.promo_codes FOR ALL USING (true);
CREATE POLICY "Allow all access to promo_code_usage" ON public.promo_code_usage FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON public.promo_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_customer ON public.promo_code_usage(customer_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_promo ON public.promo_code_usage(promo_code_id);

-- Add trigger for updated_at
CREATE TRIGGER update_promo_codes_updated_at BEFORE UPDATE ON public.promo_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
