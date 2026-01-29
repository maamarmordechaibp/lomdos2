-- Create call_logs table for tracking incoming and outgoing calls
CREATE TABLE IF NOT EXISTS public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  customer_name TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'in_progress', 'completed', 'missed', 'busy', 'failed', 'no_answer')),
  duration_seconds INTEGER,
  call_sid TEXT,
  answered_by TEXT,
  recording_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_call_logs_customer_id ON public.call_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_phone_number ON public.call_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON public.call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_direction ON public.call_logs(direction);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read call logs
CREATE POLICY "Users can view call logs" ON public.call_logs
  FOR SELECT TO authenticated USING (true);

-- Create policy for authenticated users to insert call logs
CREATE POLICY "Users can insert call logs" ON public.call_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Create policy for authenticated users to update call logs
CREATE POLICY "Users can update call logs" ON public.call_logs
  FOR UPDATE TO authenticated USING (true);

-- Add store_cell_phone to global_settings for call forwarding
ALTER TABLE public.global_settings
ADD COLUMN IF NOT EXISTS store_cell_phone TEXT;

COMMENT ON COLUMN public.global_settings.store_cell_phone IS 'Cell phone number to forward incoming calls to';
COMMENT ON TABLE public.call_logs IS 'Tracks all incoming and outgoing phone calls with customer information';
