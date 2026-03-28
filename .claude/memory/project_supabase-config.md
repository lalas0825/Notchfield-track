---
name: Supabase project configuration
description: Track shares Supabase with Takeoff — project ref msmpsxalfalzinuorwlg, NOT errxmhgqksdasxccumtz (ReadyBoard)
type: project
---

Track and Takeoff share the same Supabase project: **msmpsxalfalzinuorwlg** (Notchfield Takeoff).

**Why:** User has two Supabase projects — "Notchfield Takeoff" and "ReadyBoard". We accidentally applied migrations to ReadyBoard first and had to roll back.

**How to apply:**
- MCP project-ref must always be `msmpsxalfalzinuorwlg`
- Anon key ref in JWT matches `msmpsxalfalzinuorwlg`
- Key naming conventions in this project: `organization_id` (not `org_id`), `profiles` (not `users`), `production_areas` (not `areas`)
- RLS helpers: `user_org_id()` and `user_role()` (not `get_user_org_id()`)
- PowerSync URL: `https://69c72137a112d86b20541618.powersync.journeyapps.com`
