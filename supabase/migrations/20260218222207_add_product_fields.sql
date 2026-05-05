-- Add missing product attributes
-- thumb_url, price, pay_what_you_want, buy_now_url, test_mode

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS thumb_url TEXT,
  ADD COLUMN IF NOT EXISTS price INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pay_what_you_want BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS buy_now_url TEXT,
  ADD COLUMN IF NOT EXISTS test_mode BOOLEAN NOT NULL DEFAULT false;

-- Index for filtering test vs live products
CREATE INDEX IF NOT EXISTS idx_products_test_mode ON public.products(test_mode);

COMMENT ON COLUMN public.products.thumb_url IS 'URL to thumbnail image (100x100px)';
COMMENT ON COLUMN public.products.price IS 'Price in cents (positive integer)';
COMMENT ON COLUMN public.products.pay_what_you_want IS 'If true, customer can set their own price at checkout';
COMMENT ON COLUMN public.products.buy_now_url IS 'URL to purchase this product via hosted checkout';
COMMENT ON COLUMN public.products.test_mode IS 'Whether this product was created in test mode';
