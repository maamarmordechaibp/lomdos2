-- Migration: Create phone_call_logs table for SignalWire call tracking
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS phone_call_logs (
    id BIGSERIAL PRIMARY KEY,
    call_sid VARCHAR(64) UNIQUE NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_name VARCHAR(255),
    book_title VARCHAR(500),
    order_id INTEGER,
    message TEXT,
    status VARCHAR(50) DEFAULT 'initiated',
    duration_seconds INTEGER,
    answered_by VARCHAR(50),
    error_code VARCHAR(20),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_phone_call_logs_call_sid ON phone_call_logs(call_sid);
CREATE INDEX IF NOT EXISTS idx_phone_call_logs_order_id ON phone_call_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_phone_call_logs_status ON phone_call_logs(status);
CREATE INDEX IF NOT EXISTS idx_phone_call_logs_created_at ON phone_call_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE phone_call_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "Service role has full access" ON phone_call_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant access to service role
GRANT ALL ON phone_call_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE phone_call_logs_id_seq TO service_role;

-- Comment on table
COMMENT ON TABLE phone_call_logs IS 'Tracks phone calls made to customers via SignalWire';
COMMENT ON COLUMN phone_call_logs.call_sid IS 'SignalWire call session ID';
COMMENT ON COLUMN phone_call_logs.status IS 'Call status: initiated, ringing, in-progress, completed, failed, busy, no-answer';
