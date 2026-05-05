-- Add default_language column to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS default_language text DEFAULT 'pt-BR';

-- Create creator_onboarding table to store onboarding progress and responses
CREATE TABLE public.creator_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Step 1 - Goal
  goal text, -- 'new_community', 'migrate', 'exploring'
  
  -- Step 2 - Revenue
  annual_revenue text, -- 'under_25k', '25k_50k', '50k_100k', '100k_250k', 'over_250k'
  
  -- Step 3 - Essential features (stored as array)
  essential_features text[],
  
  -- Step 4 - Community creation data
  community_name text,
  community_slug text,
  referral_source text,
  
  -- Status
  current_step integer DEFAULT 1,
  is_completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.creator_onboarding ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own onboarding"
ON public.creator_onboarding
FOR SELECT
USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can create own onboarding"
ON public.creator_onboarding
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own onboarding"
ON public.creator_onboarding
FOR UPDATE
USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_creator_onboarding_updated_at
BEFORE UPDATE ON public.creator_onboarding
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster lookups
CREATE INDEX idx_creator_onboarding_user_id ON public.creator_onboarding(user_id);
CREATE INDEX idx_creator_onboarding_tenant_id ON public.creator_onboarding(tenant_id);

-- Add unique constraint on community_slug when not null
CREATE UNIQUE INDEX idx_unique_community_slug 
ON public.creator_onboarding(community_slug) 
WHERE community_slug IS NOT NULL;