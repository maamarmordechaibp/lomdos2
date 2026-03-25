-- Add store_name to global_settings
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS store_name TEXT NOT NULL DEFAULT 'New Square Bookstore';
