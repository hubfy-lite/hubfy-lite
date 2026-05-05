-- Remove unused social media columns from sellers
ALTER TABLE sellers
  DROP COLUMN IF EXISTS business_facebook,
  DROP COLUMN IF EXISTS business_twitter;
