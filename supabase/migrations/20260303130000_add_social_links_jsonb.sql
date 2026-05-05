-- Add social_links JSONB column to tenant_settings
-- Stores social media handles: {"instagram": "hubfy.io", "x": "hubfyoficial", ...}
ALTER TABLE public.tenant_settings
ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tenant_settings.social_links IS 'Social media handles/usernames as JSONB. Keys: instagram, x, facebook, youtube, tiktok, twitch, github';
