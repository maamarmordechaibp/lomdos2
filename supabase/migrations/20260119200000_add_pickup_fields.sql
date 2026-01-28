-- Add amount_paid to customer_orders to track payments at pickup
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP WITH TIME ZONE;
