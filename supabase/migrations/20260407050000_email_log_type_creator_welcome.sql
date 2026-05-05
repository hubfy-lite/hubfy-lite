-- Add creator_welcome to email_log_type enum
ALTER TYPE public.email_log_type ADD VALUE IF NOT EXISTS 'creator_welcome';
