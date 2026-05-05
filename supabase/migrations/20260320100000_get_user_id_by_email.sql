-- Lookup auth.users by email — used by add-team-member and add-customer
-- edge functions to replace the fragile listUsers({ perPage: 1000 }) pattern.

CREATE OR REPLACE FUNCTION get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;
