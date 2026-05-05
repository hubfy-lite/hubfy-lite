-- Step 1: Drop dependent objects first
DROP POLICY IF EXISTS "Sellers can create tenants" ON public.tenants;
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- Step 2: Remove default from user_roles
ALTER TABLE public.user_roles ALTER COLUMN role DROP DEFAULT;

-- Step 3: Convert column to text
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text;

-- Step 4: Update the values
UPDATE public.user_roles SET role = 'creator' WHERE role = 'seller';
UPDATE public.user_roles SET role = 'member' WHERE role = 'customer';

-- Step 5: Drop the old enum
DROP TYPE public.app_role;

-- Step 6: Create new enum with correct values
CREATE TYPE public.app_role AS ENUM ('admin', 'creator', 'member');

-- Step 7: Convert column back to enum
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::public.app_role;

-- Step 8: Set default to 'member'
ALTER TABLE public.user_roles ALTER COLUMN role SET DEFAULT 'member'::public.app_role;

-- Step 9: Recreate the has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Step 10: Recreate the policy with new role name
CREATE POLICY "Creators can create tenants" 
ON public.tenants 
FOR INSERT 
WITH CHECK ((owner_id = auth.uid()) AND has_role(auth.uid(), 'creator'::app_role));