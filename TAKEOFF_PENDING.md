# Takeoff — Pending Work to Unblock Track

> **STATUS (2026-04-19, Takeoff commit `be6ac01`):** All 4 items
> resolved on Takeoff side. Track patched the response parser (commit
> below) to match Takeoff's camelCase contract. **Ready to test PTP +
> Toolbox distribute end-to-end on prod.**

---

## Resolution summary

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Distribute endpoint 401 | ✅ Fixed | Dual-auth helper accepts Bearer JWT or cookies |
| 2 | Sprint 50D toolbox renderer + i18n | ✅ Done | Endpoint branches by `doc_type`; 19 toolboxPdf keys × 6 locales |
| 3 | Codify 2 Track MCP migrations | ✅ Done | `supabase/migrations/20260419205326_rls_accept_supervisor_role.sql` + `20260419212021_crew_assignments_fk_to_workers.sql`, idempotent |
| 4 | Toolbox library seed | ✅ Done | 30 curated tile/marble topics (Sprint 51) |

---

## What changed on Track

### Response parser contract update
Takeoff returns camelCase; Track's parser was reading snake_case. Fixed
in `src/features/safety/ptp/services/distributeService.ts`:

```ts
// Takeoff response (commit be6ac01):
{
  success: true,
  emailsSent: 2,
  emailsFailed: 0,
  emailRecipients: 2,
  distributedAt: "2026-04-19T...",
  pdfSha256: "abc123..."
}
```

Track reads `emailsSent ?? emails_sent` (with snake_case fallback for
defensive compatibility). `pdfSha256` lands in
`safety_documents.content.distribution.pdf_sha256` per Track's spec.

---

## Email provider caveat (explicit)

Takeoff noted email delivery is still being sorted — Juan is deciding
between Zoho SMTP / Zoho ZeptoMail / Resend. Until it's wired, the
distribute response will likely show:

```
{ success: true, emailsSent: 0, emailsFailed: N, ... }
```

Meaning: **auth works, PDF generates, SHA-256 stamps, document freezes
(status='completed', distribution.distributed_at set), audit log
writes** — just the email leg fails silently.

Track treats this as success from a document-integrity standpoint. The
UI shows "Distributed" once the response comes back with `success:
true`, regardless of `emailsSent`. The foreman will see the doc as
sent, but GCs won't get emails until Juan finishes the provider.

If `emailsFailed > 0` in production, we should show a banner on the
document detail view: *"Distributed locally but delivery provider
failed. Contact your PM."* — not urgent, can ship in a follow-up.

---

## Testing plan (next Track session)

1. `npx expo start --dev-client --clear`
2. Reload device
3. Open PTP from Home → complete wizard → Send & Submit
4. Expected logs:
   ```
   [distribute] POST https://notchfield.com/api/pm/safety-documents/[id]/distribute
   → 200 OK
   { success: true, emailsSent: 0|N, emailsFailed: 0|N, pdfSha256: "..." }
   ```
5. Expected UI: green success alert with count
6. Re-open the PTP — it should show the "Distributed" detail view with
   SHA-256 hash visible

Same for Toolbox: Home → Weekly Safety card → 3-step wizard → Send.

If anything fails, metro log will show the new diagnostic from
`callDistribute()` (commit `d637eb4`):
```
[distribute] endpoint rejected — POST ...
  status: <HTTP>
  body:   <response snippet>
```

---

## Follow-ups (not blocking)

- **Email provider config** — Juan's call (Zoho vs Resend). No Track
  change needed either way; endpoint contract stays the same.
- **Sprint 53 hygiene** — Takeoff will codify the other 134 Supabase
  migrations. Doesn't affect Track.
- **Tombstone UI for `emailsFailed > 0`** — small banner on doc detail.
  ~1 hour when email provider lands and we can test failure modes.

---

*Track-side work: commit below ships the response parser fix.
Repo: https://github.com/lalas0825/Notchfield-track*
