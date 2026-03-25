-- Add Sola payment processing settings
-- NOTE: Only the iFields key is stored here (it's PUBLIC and safe for frontend)
-- The API key must be set as a Supabase Edge Function secret (SOLA_API_KEY)
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS sola_ifields_key TEXT;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS sola_software_name TEXT DEFAULT 'Shelf Sorcerer';
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS sola_software_version TEXT DEFAULT '1.0.0';

-- Remove API key column if it exists (for security - should be in secrets)
ALTER TABLE public.global_settings DROP COLUMN IF EXISTS sola_api_key;
