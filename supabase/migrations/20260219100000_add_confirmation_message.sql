-- Add confirmation_message to checkouts table
ALTER TABLE checkouts
  ADD COLUMN IF NOT EXISTS confirmation_message text;

COMMENT ON COLUMN checkouts.confirmation_message IS 'Custom message shown on the post-checkout success screen';
