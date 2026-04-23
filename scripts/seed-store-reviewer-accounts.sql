-- Seed: Apple App Store + Google Play reviewer accounts
-- ======================================================
-- Apple's App Review and Google's Play Console both ask for a demo account
-- they can use to evaluate the app. This script provisions two supervisor
-- accounts (one per store) scoped to Jantile's DEMO PROJECT, so reviewers
-- see a populated app without touching real-tenant data.
--
-- -------------------------------------------------------------------------
-- PREREQUISITE — create the auth users first
-- -------------------------------------------------------------------------
-- Supabase dashboard → Authentication → Users → "Add user"
-- Create each of these with any strong password. Check
-- "Auto confirm user" so reviewers can log in without email verification.
--
--   apple-reviewer@notchfield.com
--   google-reviewer@notchfield.com
--
-- Save both passwords somewhere you can paste into the submission forms
-- (Apple App Store Connect "Sign-in information", Google Play Console
-- "Launch checklist → Content → App access").
--
-- -------------------------------------------------------------------------
-- Run this (Supabase SQL Editor → paste → Run)
-- -------------------------------------------------------------------------
-- Idempotent: safe to re-run after manual edits or after rotating the
-- reviewer password.

DO $$
DECLARE
  jantile_org_id   uuid := 'e40ea3ab-ecec-4822-b670-643addf863f0';
  demo_project_id  uuid := 'f56c1bfc-0c17-4055-b881-c951db8612ee';
  r_email          text;
  r_display_name   text;
  r_id             uuid;
  r_emails         text[] := ARRAY[
    'apple-reviewer@notchfield.com',
    'google-reviewer@notchfield.com'
  ];
BEGIN
  FOREACH r_email IN ARRAY r_emails LOOP
    r_display_name := CASE
      WHEN r_email LIKE 'apple-%'  THEN 'Apple Reviewer'
      WHEN r_email LIKE 'google-%' THEN 'Google Reviewer'
      ELSE 'Store Reviewer'
    END;

    -- Resolve the auth user (MUST exist from the dashboard step above).
    SELECT id INTO r_id FROM auth.users WHERE email = r_email;

    IF r_id IS NULL THEN
      RAISE WARNING
        'Skipping % — create this auth user in Supabase → Authentication → Users first.',
        r_email;
      CONTINUE;
    END IF;

    -- Profile: supervisor role in Jantile org. Supervisor role (vs. foreman
    -- or worker) is chosen so the reviewer can switch between projects
    -- and exercise the full feature set — Apple explicitly tests this in
    -- the "demonstrate core functionality" phase.
    INSERT INTO profiles (id, organization_id, full_name, role, locale, is_active)
    VALUES (
      r_id,
      jantile_org_id,
      r_display_name,
      'supervisor',
      'en',
      true
    )
    ON CONFLICT (id) DO UPDATE
      SET organization_id = EXCLUDED.organization_id,
          role            = EXCLUDED.role,
          full_name       = EXCLUDED.full_name,
          is_active       = true,
          updated_at      = now();

    -- Project assignment — scoped to DEMO PROJECT only. Even with
    -- supervisor role, the app will only show projects from
    -- project_assignments per Sprint 40C's scoping.
    INSERT INTO project_assignments (
      organization_id, user_id, project_id, assigned_role, is_active, notes
    )
    VALUES (
      jantile_org_id,
      r_id,
      demo_project_id,
      'supervisor',
      true,
      'Seeded for ' || r_display_name || ' — store submission demo account.'
    )
    ON CONFLICT (user_id, project_id) DO UPDATE
      SET assigned_role = EXCLUDED.assigned_role,
          is_active     = true,
          updated_at    = now();

    RAISE NOTICE 'Seeded % (id=%)', r_email, r_id;
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- Verify
-- -------------------------------------------------------------------------
-- After running the DO block, this SELECT should show 2 rows with
-- role='supervisor', organization='Jantile Inc', project='DEMO PROJECT'.

SELECT
  u.email,
  p.full_name,
  p.role,
  o.name AS organization,
  proj.name AS assigned_project,
  pa.assigned_role,
  pa.is_active
FROM auth.users u
JOIN profiles p            ON p.id = u.id
JOIN organizations o       ON o.id = p.organization_id
LEFT JOIN project_assignments pa ON pa.user_id = u.id
LEFT JOIN projects proj    ON proj.id = pa.project_id
WHERE u.email IN (
  'apple-reviewer@notchfield.com',
  'google-reviewer@notchfield.com'
)
ORDER BY u.email;
