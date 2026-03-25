-- Fix infinite recursion in user_profiles RLS policies
-- The issue is that policies on user_profiles query user_profiles to check admin status

-- Drop the problematic policies
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.user_profiles;

-- Create a security definer function to check admin status without RLS
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM public.user_profiles
    WHERE id = user_id;
    
    RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Recreate policies using the security definer function
-- This avoids the infinite recursion because SECURITY DEFINER bypasses RLS

-- Policy: Admins can read all profiles
CREATE POLICY "Admins can read all profiles" ON public.user_profiles
    FOR SELECT USING (
        public.is_admin(auth.uid())
    );

-- Policy: Admins can update profiles
CREATE POLICY "Admins can update profiles" ON public.user_profiles
    FOR UPDATE USING (
        public.is_admin(auth.uid())
    );

-- Policy: Admins can insert profiles (also allow service role for triggers)
CREATE POLICY "Admins can insert profiles" ON public.user_profiles
    FOR INSERT WITH CHECK (
        public.is_admin(auth.uid()) OR auth.uid() = id
    );

-- Policy: Admins can delete profiles
CREATE POLICY "Admins can delete profiles" ON public.user_profiles
    FOR DELETE USING (
        public.is_admin(auth.uid())
    );

-- Also ensure the service role can always insert (for the trigger)
-- Grant usage on the function
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO service_role;
