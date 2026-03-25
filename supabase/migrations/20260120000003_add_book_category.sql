-- Add category field to books for organizing by category in supplier orders
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS category TEXT;

-- Create index for category lookups
CREATE INDEX IF NOT EXISTS idx_books_category ON public.books(category);
