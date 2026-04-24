-- Fix: auto_seed_permissions() trigger couldn't find seed_default_permissions()
-- =============================================================================
-- Symptom: creating any auth user (dashboard or auth admin API) fails with
--   "Failed to create user: Database error creating new user"
-- Postgres logs show:
--   ERROR: function seed_default_permissions(uuid) does not exist
--
-- Root cause: the chain of triggers is
--   auth.users INSERT
--     → on_auth_user_created → handle_new_user()
--        → INSERT into public.organizations
--           → trg_seed_permissions → auto_seed_permissions()
--              → PERFORM seed_default_permissions(NEW.id)
--
-- handle_new_user() is SECURITY DEFINER but auto_seed_permissions() was
-- NOT. When the outer trigger runs under the auth admin role (not the
-- owner), the inner PERFORM resolves against the auth admin's
-- search_path, which does NOT include `public`. seed_default_permissions
-- exists in public, so it appears "not found" and the transaction aborts.
--
-- Fix: give auto_seed_permissions() SECURITY DEFINER + an explicit
-- search_path, and schema-qualify the call. Idempotent — CREATE OR
-- REPLACE so re-running is safe.
--
-- Verified: test org INSERT now seeds 74 role_permissions rows cleanly;
-- dashboard "Add user" completes without the database error.

CREATE OR REPLACE FUNCTION public.auto_seed_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  PERFORM public.seed_default_permissions(NEW.id);
  RETURN NEW;
END;
$function$;
