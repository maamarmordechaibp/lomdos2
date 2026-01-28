-- Add store_logo_url and favicon_url columns to global_settings
ALTER TABLE public.global_settings 
ADD COLUMN IF NOT EXISTS store_logo_url TEXT;

ALTER TABLE public.global_settings 
ADD COLUMN IF NOT EXISTS favicon_url TEXT;

-- Create storage bucket for logos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Public read access for store assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload store assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update store assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete store assets" ON storage.objects;

-- Allow public read access to store-assets bucket
CREATE POLICY "Public read access for store assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-assets');

-- Allow authenticated users to upload to store-assets bucket
CREATE POLICY "Authenticated users can upload store assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'store-assets' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update store assets
CREATE POLICY "Authenticated users can update store assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'store-assets' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete store assets
CREATE POLICY "Authenticated users can delete store assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'store-assets' 
  AND auth.role() = 'authenticated'
);
