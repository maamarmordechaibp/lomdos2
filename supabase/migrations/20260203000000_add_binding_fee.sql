-- Add binding fee fields to customer_orders
-- When a customer wants their book bound, an additional $5 fee is added

-- Add binding fields to customer_orders table
ALTER TABLE public.customer_orders
ADD COLUMN IF NOT EXISTS wants_binding BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS binding_fee DECIMAL(10, 2) DEFAULT 5.00;

-- Add binding_fee_amount to track the fee applied
ALTER TABLE public.customer_orders
ADD COLUMN IF NOT EXISTS binding_fee_applied DECIMAL(10, 2) DEFAULT 0;

-- Comment on the columns
COMMENT ON COLUMN public.customer_orders.wants_binding IS 'Whether the customer wants the book bound';
COMMENT ON COLUMN public.customer_orders.binding_fee IS 'The fee charged for binding (default $5)';
COMMENT ON COLUMN public.customer_orders.binding_fee_applied IS 'The actual binding fee applied to this order';
