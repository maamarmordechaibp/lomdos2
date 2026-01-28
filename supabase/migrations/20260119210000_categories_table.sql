-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Everyone can read categories
CREATE POLICY "Anyone can read categories" ON public.categories
    FOR SELECT USING (true);

-- Only admins can modify categories
CREATE POLICY "Admins can insert categories" ON public.categories
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update categories" ON public.categories
    FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete categories" ON public.categories
    FOR DELETE USING (public.is_admin());

-- Insert default Jewish bookstore categories
INSERT INTO public.categories (name, sort_order) VALUES
    ('Chumash', 1),
    ('Gemara', 2),
    ('Mishnah', 3),
    ('Halacha', 4),
    ('Siddur/Tefilah', 5),
    ('Machzor', 6),
    ('Tehillim', 7),
    ('Nach', 8),
    ('Midrash', 9),
    ('Mussar', 10),
    ('Chassidus', 11),
    ('Kabbalah', 12),
    ('Jewish History', 13),
    ('Biography', 14),
    ('Children''s Books', 15),
    ('Hebrew Learning', 16),
    ('Haggadah', 17),
    ('Megillot', 18),
    ('Seforim', 19),
    ('Fiction', 20),
    ('Cookbooks', 21),
    ('Judaica', 22),
    ('Other', 23)
ON CONFLICT (name) DO NOTHING;
