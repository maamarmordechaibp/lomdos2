-- INSTRUCTIONS FOR SETTING UP THE INITIAL ADMIN USER
-- =====================================================
-- 
-- The authentication system requires creating the first user through Supabase Dashboard
-- or Supabase CLI since there's no registration page.
--
-- Option 1: Using Supabase Dashboard
-- ----------------------------------
-- 1. Go to your Supabase project dashboard
-- 2. Navigate to Authentication > Users
-- 3. Click "Add User" > "Create New User"
-- 4. Enter:
--    - Email: 3762437@gmail.com
--    - Password: skver01d
--    - Check "Auto Confirm User"
-- 5. After the user is created, run this SQL in the SQL Editor:

-- First, ensure the user_profiles table exists (run the migration first)
-- Then update the role to admin for the initial user:

UPDATE public.user_profiles 
SET role = 'admin', name = 'Admin'
WHERE email = '3762437@gmail.com';

-- Option 2: Using Supabase CLI or SQL Editor with service role
-- ------------------------------------------------------------
-- If you have direct database access with service role, you can run:

-- INSERT INTO auth.users (
--   instance_id,
--   id,
--   aud,
--   role,
--   email,
--   encrypted_password,
--   email_confirmed_at,
--   raw_user_meta_data,
--   created_at,
--   updated_at
-- ) VALUES (
--   '00000000-0000-0000-0000-000000000000',
--   gen_random_uuid(),
--   'authenticated',
--   'authenticated',
--   '3762437@gmail.com',
--   crypt('skver01d', gen_salt('bf')),
--   NOW(),
--   '{"role": "admin", "name": "Admin"}'::jsonb,
--   NOW(),
--   NOW()
-- );

-- IMPORTANT NOTES:
-- ================
-- 1. Run the user_profiles migration FIRST (20260119200000_user_profiles.sql)
-- 2. Deploy the edge functions (create-user and delete-user)
-- 3. Create the initial admin user through the dashboard
-- 4. Run the UPDATE statement above to set the admin role
--
-- After setup:
-- - Admin (3762437@gmail.com) has full access to everything
-- - Regular users can only access the POS (New Order) page
-- - Admin can create/delete users from the Users management page
