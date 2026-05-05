-- ============================================================
-- Migration: Email i18n + Auth Hook support
--
-- Adds new email_log_type values for auth emails
-- (signup confirmation, password reset, email change, magic link).
-- Makes tenant_id nullable so auth-level emails (no tenant context)
-- can still be logged.
-- ============================================================

-- New email types for auth hook emails
ALTER TYPE public.email_log_type ADD VALUE IF NOT EXISTS 'signup_confirmation';
ALTER TYPE public.email_log_type ADD VALUE IF NOT EXISTS 'password_reset';
ALTER TYPE public.email_log_type ADD VALUE IF NOT EXISTS 'email_change';
ALTER TYPE public.email_log_type ADD VALUE IF NOT EXISTS 'magic_link';
ALTER TYPE public.email_log_type ADD VALUE IF NOT EXISTS 'auth_invite';

-- Allow tenant_id to be null for platform-level auth emails
ALTER TABLE public.email_logs ALTER COLUMN tenant_id DROP NOT NULL;
