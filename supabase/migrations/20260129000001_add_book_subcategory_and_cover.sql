-- Add subcategory and cover_image_url columns to books table
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS subcategory TEXT,
ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.books.subcategory IS 'Subcategory within the main category (e.g., Bereishis under Chumash)';
COMMENT ON COLUMN public.books.cover_image_url IS 'URL to the book cover image stored in Supabase Storage';
