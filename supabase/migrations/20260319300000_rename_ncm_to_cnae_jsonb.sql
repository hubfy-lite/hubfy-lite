-- Migration: rename ncm → cnae and convert to JSONB
-- Stores all CNAEs from CNPJA API: { main: { id, text }, side: [{ id, text }, ...] }

-- 1. Add new cnae JSONB column
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS cnae JSONB;

-- 2. Migrate existing ncm/main_activity data into JSONB structure
UPDATE public.sellers
SET cnae = jsonb_build_object(
  'main', jsonb_build_object('id', ncm::text, 'text', COALESCE(main_activity, '')),
  'side', '[]'::jsonb
)
WHERE ncm IS NOT NULL;

-- 3. Drop old ncm column
ALTER TABLE public.sellers DROP COLUMN IF EXISTS ncm;

-- 4. Add comment
COMMENT ON COLUMN public.sellers.cnae IS 'CNAE data from CNPJA API: { main: { id, text }, side: [{ id, text }, ...] }';
COMMENT ON COLUMN public.sellers.main_activity IS 'Selected main business activity description (from CNPJA or manual selection)';
