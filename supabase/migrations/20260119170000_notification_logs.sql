-- Create notification_logs table to track all customer notifications
CREATE TABLE public.notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_order_id UUID REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('order_ready', 'order_received', 'custom')),
  notification_method TEXT NOT NULL CHECK (notification_method IN ('phone', 'sms', 'email')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
  response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Create open policy
CREATE POLICY "Allow all access to notification_logs" ON public.notification_logs FOR ALL USING (true) WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_notification_logs_customer ON public.notification_logs(customer_id);
CREATE INDEX idx_notification_logs_order ON public.notification_logs(customer_order_id);
CREATE INDEX idx_notification_logs_created ON public.notification_logs(created_at DESC);
