-- Create storage bucket for invoices
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to invoices bucket
CREATE POLICY "Public Access to invoices" ON storage.objects
  FOR SELECT USING (bucket_id = 'invoices');

CREATE POLICY "Authenticated users can upload invoices" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Authenticated users can update invoices" ON storage.objects
  FOR UPDATE USING (bucket_id = 'invoices');

CREATE POLICY "Authenticated users can delete invoices" ON storage.objects
  FOR DELETE USING (bucket_id = 'invoices');
