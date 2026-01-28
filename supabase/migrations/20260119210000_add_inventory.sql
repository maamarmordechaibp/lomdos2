-- Add inventory tracking to books
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS quantity_in_stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 2;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS reorder_quantity INTEGER NOT NULL DEFAULT 5;

-- Create stock_orders table for orders without customers (inventory replenishment)
CREATE TABLE IF NOT EXISTS public.stock_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  cost_per_unit DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'received', 'cancelled')),
  ordered_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_orders ENABLE ROW LEVEL SECURITY;

-- Create policy for stock_orders
CREATE POLICY "Allow all access to stock_orders" ON public.stock_orders FOR ALL USING (true) WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_stock_orders_updated_at BEFORE UPDATE ON public.stock_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_stock_orders_book ON public.stock_orders(book_id);
CREATE INDEX idx_stock_orders_status ON public.stock_orders(status);
CREATE INDEX idx_books_low_stock ON public.books(quantity_in_stock) WHERE quantity_in_stock <= low_stock_threshold;
