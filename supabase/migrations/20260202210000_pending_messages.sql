-- Create pending_messages table to store messages for customers who didn't answer calls
-- When a customer calls back, they can hear their pending message
CREATE TABLE IF NOT EXISTS public.pending_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL, -- Store phone in case customer_id is null
  message TEXT NOT NULL,
  notification_type TEXT, -- 'order_ready', 'order_received', 'custom', 'payment_reminder'
  customer_order_id UUID REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  call_sid TEXT, -- Original call SID for tracking
  -- Status tracking
  is_played BOOLEAN NOT NULL DEFAULT false,
  played_at TIMESTAMP WITH TIME ZONE,
  -- Expiry (messages older than X days are auto-deleted)
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_messages ENABLE ROW LEVEL SECURITY;

-- Create open policy for internal app
CREATE POLICY "Allow all access to pending_messages" ON public.pending_messages FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_messages_phone ON public.pending_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_pending_messages_customer ON public.pending_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_pending_messages_not_played ON public.pending_messages(phone_number) WHERE is_played = false;
CREATE INDEX IF NOT EXISTS idx_pending_messages_expires ON public.pending_messages(expires_at);

-- Comment on the table
COMMENT ON TABLE public.pending_messages IS 'Stores messages for customers who did not answer outbound calls. When they call back, they can hear their message.';
COMMENT ON COLUMN public.pending_messages.is_played IS 'Set to true once the customer has heard the message';
COMMENT ON COLUMN public.pending_messages.expires_at IS 'Messages automatically expire after 7 days';
