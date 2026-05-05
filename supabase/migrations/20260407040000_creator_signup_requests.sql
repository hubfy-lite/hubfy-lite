-- Rate-limiting table for creator-signup-start edge function.
-- Same pattern as portal_auth_requests but without tenant_id.
CREATE TABLE IF NOT EXISTS public.creator_signup_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_creator_signup_ip
  ON public.creator_signup_requests (ip_address, created_at);

CREATE INDEX idx_creator_signup_email
  ON public.creator_signup_requests (email, created_at);

-- Allow edge functions (service_role) full access; block anon/authenticated.
ALTER TABLE public.creator_signup_requests ENABLE ROW LEVEL SECURITY;
