-- Drop all existing public tables from old Django project
DROP TABLE IF EXISTS public.suppliers_supplierorderitem CASCADE;
DROP TABLE IF EXISTS public.suppliers_supplierorder CASCADE;
DROP TABLE IF EXISTS public.suppliers_supplier_translation CASCADE;
DROP TABLE IF EXISTS public.suppliers_supplier CASCADE;
DROP TABLE IF EXISTS public.pricing_pricehistory CASCADE;
DROP TABLE IF EXISTS public.pricing_globalsettings CASCADE;
DROP TABLE IF EXISTS public.post_office_log CASCADE;
DROP TABLE IF EXISTS public.post_office_emailtemplate CASCADE;
DROP TABLE IF EXISTS public.post_office_email CASCADE;
DROP TABLE IF EXISTS public.post_office_attachment_emails CASCADE;
DROP TABLE IF EXISTS public.post_office_attachment CASCADE;
DROP TABLE IF EXISTS public.phone_call_logs CASCADE;
DROP TABLE IF EXISTS public.orders_orderitem CASCADE;
DROP TABLE IF EXISTS public.orders_order CASCADE;
DROP TABLE IF EXISTS public.django_session CASCADE;
DROP TABLE IF EXISTS public.django_migrations CASCADE;
DROP TABLE IF EXISTS public.django_content_type CASCADE;
DROP TABLE IF EXISTS public.django_celery_results_taskresult CASCADE;
DROP TABLE IF EXISTS public.django_celery_results_groupresult CASCADE;
DROP TABLE IF EXISTS public.django_celery_results_chordcounter CASCADE;
DROP TABLE IF EXISTS public.django_celery_beat_solarschedule CASCADE;
DROP TABLE IF EXISTS public.django_celery_beat_periodictasks CASCADE;
DROP TABLE IF EXISTS public.django_celery_beat_periodictask CASCADE;
DROP TABLE IF EXISTS public.django_celery_beat_intervalschedule CASCADE;
DROP TABLE IF EXISTS public.django_celery_beat_crontabschedule CASCADE;
DROP TABLE IF EXISTS public.django_celery_beat_clockedschedule CASCADE;
DROP TABLE IF EXISTS public.django_admin_log CASCADE;
DROP TABLE IF EXISTS public.customers_customer CASCADE;
DROP TABLE IF EXISTS public.books_publisher_translation CASCADE;
DROP TABLE IF EXISTS public.books_publisher CASCADE;
DROP TABLE IF EXISTS public.books_category_translation CASCADE;
DROP TABLE IF EXISTS public.books_category CASCADE;
DROP TABLE IF EXISTS public.books_book_translation CASCADE;
DROP TABLE IF EXISTS public.books_book_authors CASCADE;
DROP TABLE IF EXISTS public.books_book CASCADE;
DROP TABLE IF EXISTS public.books_author_translation CASCADE;
DROP TABLE IF EXISTS public.books_author CASCADE;
DROP TABLE IF EXISTS public.auth_user_user_permissions CASCADE;
DROP TABLE IF EXISTS public.auth_user_groups CASCADE;
DROP TABLE IF EXISTS public.auth_user CASCADE;
DROP TABLE IF EXISTS public.auth_permission CASCADE;
DROP TABLE IF EXISTS public.auth_group_permissions CASCADE;
DROP TABLE IF EXISTS public.auth_group CASCADE;

-- Drop new app tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS public.pending_supplier_assignments CASCADE;
DROP TABLE IF EXISTS public.returns CASCADE;
DROP TABLE IF EXISTS public.supplier_order_items CASCADE;
DROP TABLE IF EXISTS public.supplier_orders CASCADE;
DROP TABLE IF EXISTS public.customer_orders CASCADE;
DROP TABLE IF EXISTS public.global_settings CASCADE;
DROP TABLE IF EXISTS public.book_supplier_history CASCADE;
DROP TABLE IF EXISTS public.books CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

-- Drop trigger function if exists
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  notification_preference TEXT NOT NULL DEFAULT 'phone' CHECK (notification_preference IN ('phone', 'sms', 'email')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create books table
CREATE TABLE public.books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  title_hebrew TEXT,
  author TEXT,
  isbn TEXT,
  current_supplier_id UUID REFERENCES public.suppliers(id),
  default_cost DECIMAL(10,2),
  no_profit BOOLEAN NOT NULL DEFAULT false,
  custom_profit_margin DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create book_supplier_history table to track which books were ordered from which suppliers
CREATE TABLE public.book_supplier_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  last_ordered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_cost DECIMAL(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create global_settings table
CREATE TABLE public.global_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  default_profit_margin DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  signalwire_space_url TEXT,
  signalwire_project_id TEXT,
  signalwire_api_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.global_settings (default_profit_margin) VALUES (20.00);

-- Create customer_orders table (main orders from customers)
CREATE TABLE public.customer_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'received', 'ready', 'picked_up', 'cancelled')),
  deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  final_price DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create supplier_orders table (orders to suppliers)
CREATE TABLE public.supplier_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'partial', 'received', 'cancelled')),
  sent_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create supplier_order_items table (books in supplier orders)
CREATE TABLE public.supplier_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_order_id UUID NOT NULL REFERENCES public.supplier_orders(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  customer_order_id UUID REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  cost DECIMAL(10,2),
  is_received BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create returns table
CREATE TABLE public.returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  customer_order_id UUID REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('damaged', 'wrong_item', 'customer_return', 'other')),
  reason_details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed')),
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pending_supplier_assignments table (books waiting to be assigned a supplier)
CREATE TABLE public.pending_supplier_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  customer_order_id UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_supplier_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_supplier_assignments ENABLE ROW LEVEL SECURITY;

-- Create open policies for all tables (this is an internal business app)
-- In production, you'd want to add authentication and proper RLS
CREATE POLICY "Allow all access to customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to books" ON public.books FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to book_supplier_history" ON public.book_supplier_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to global_settings" ON public.global_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to customer_orders" ON public.customer_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to supplier_orders" ON public.supplier_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to supplier_order_items" ON public.supplier_order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to returns" ON public.returns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to pending_supplier_assignments" ON public.pending_supplier_assignments FOR ALL USING (true) WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_global_settings_updated_at BEFORE UPDATE ON public.global_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customer_orders_updated_at BEFORE UPDATE ON public.customer_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_supplier_orders_updated_at BEFORE UPDATE ON public.supplier_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_returns_updated_at BEFORE UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();