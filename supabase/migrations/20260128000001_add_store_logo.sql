-- Add store_logo_url column to global_settings
ALTER TABLE public.global_settings 
ADD COLUMN IF NOT EXISTS store_logo_url TEXT;

-- Create storage bucket for logos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to store-assets bucket
CREATE POLICY IF NOT EXISTS "Public read access for store assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-assets');

-- Allow authenticated users to upload to store-assets bucket
CREATE POLICY IF NOT EXISTS "Authenticated users can upload store assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'store-assets' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update store assets
CREATE POLICY IF NOT EXISTS "Authenticated users can update store assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'store-assets' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete store assets
CREATE POLICY IF NOT EXISTS "Authenticated users can delete store assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'store-assets' 
  AND auth.role() = 'authenticated'
);
