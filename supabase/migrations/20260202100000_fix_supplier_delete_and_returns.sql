-- Fix supplier deletion - allow deleting suppliers by setting books' current_supplier_id to null
-- First drop the existing constraint
ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_current_supplier_id_fkey;

-- Re-add with ON DELETE SET NULL
ALTER TABLE public.books 
ADD CONSTRAINT books_current_supplier_id_fkey 
FOREIGN KEY (current_supplier_id) 
REFERENCES public.suppliers(id) 
ON DELETE SET NULL;

-- Also fix book_supplier_history to set null instead of cascade
ALTER TABLE public.book_supplier_history DROP CONSTRAINT IF EXISTS book_supplier_history_supplier_id_fkey;
ALTER TABLE public.book_supplier_history 
ADD CONSTRAINT book_supplier_history_supplier_id_fkey 
FOREIGN KEY (supplier_id) 
REFERENCES public.suppliers(id) 
ON DELETE SET NULL;

-- Make supplier_id nullable in book_supplier_history
ALTER TABLE public.book_supplier_history ALTER COLUMN supplier_id DROP NOT NULL;

-- Add supplier return tracking to returns table
-- When a book is returned and needs to go back to supplier
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS return_to_supplier BOOLEAN DEFAULT FALSE;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS supplier_return_reason TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS supplier_return_status TEXT DEFAULT NULL CHECK (supplier_return_status IN ('pending', 'included_in_order', 'sent', 'completed'));

-- Create a table to track books that need to be returned to suppliers
-- These will be included in the next supplier order
CREATE TABLE IF NOT EXISTS public.supplier_return_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  reason_details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'included_in_order', 'sent', 'completed')),
  supplier_order_id UUID REFERENCES public.supplier_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_return_items ENABLE ROW LEVEL SECURITY;

-- Create open policy for internal app
CREATE POLICY "Allow all access to supplier_return_items" ON public.supplier_return_items FOR ALL USING (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_supplier_return_items_supplier_id ON public.supplier_return_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_return_items_status ON public.supplier_return_items(status);
