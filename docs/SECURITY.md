# Security

## Boundaries
1. **Row Level Security** is the security boundary. `can()` in `web/lib/rbac`
   gates UI only. Every table with `school_id` or `student_id` has RLS on and a
   policy (tested). Cross-tenant reads return zero rows even with an explicit
   filter (Phase 0 acceptance test, still green).
2. **The worker is server-only.** Browsers never call it. Web server actions
   send `X-Worker-Token` (shared secret) and `X-School-Id`; the worker
   rate-limits per tenant (slowapi) and uses the service role only inside
   request handlers that already received a tenant id from trusted code.
3. **Service role never reaches the browser.** `web/lib/supabase/service.ts`
   is `server-only`; the build fails if it is imported client-side.

## Headers (`web/next.config.ts`)
CSP (`default-src 'self'`, `connect-src` limited to Supabase, `frame-ancestors
'none'`, `object-src 'none'`), HSTS (prod), `X-Content-Type-Options`,
`X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP. Verified
by the Playwright suite.

## Authentication
- Supabase Auth, email + password; sessions are httpOnly cookies refreshed in
  middleware.
- **MFA (TOTP)**: any staff user can enrol from `/security`. For `principal`,
  `academic_head` and `super_admin`, restrictive RLS policies
  (`privileged_aal_ok()`) refuse approvals-ledger inserts, report updates,
  blueprint changes, erasure decisions and profile edits unless the JWT carries
  `aal = 'aal2'` — once a verified factor exists. The login page performs the
  challenge; a password-only session for an enrolled principal cannot approve.
- **Sessions/devices**: `/security` lists `auth.sessions` for the user via the
  `my_sessions` view and revokes with `revoke_my_session()`.

## Storage
All buckets private. Files are keyed `<school_id>/…`; access is by short-lived
signed URLs (300 s) minted server-side after a role check.

## Audit
`audit_events` is insert-only and hash-chained per tenant. `/audit` shows a
*Chain verified* badge from `verify_chain()`; the Phase 0 test tampers a row
through a superuser connection and confirms detection.

## Secrets
`.env.example` holds placeholders only. `web/.env.local` and `worker/.env` are
git-ignored. CI uses the Supabase CLI's public local demo JWTs, which grant
nothing outside the ephemeral CI database. Production secrets live in Vercel /
Render / Supabase dashboards (`docs/DEPLOY.md`).

## Data protection (DPDP Act 2023)
- Consent ledger per student and purpose (`consent_records`); shown to parents.
- Right of access: `/consent` (leadership) or the parent portal exports every
  record held about one child as JSON, scoped to that child (tested: another
  student's name never appears).
- Right to erasure: parent or leadership raises `erasure_requests`; leadership
  approves at AAL2; `execute_erasure()` deletes personal records and
  anonymises the student row. Item statistics (already aggregate) survive.
- Data residency: Supabase `ap-south-1`.
- No student PII in any prompt: redaction before construction, prompt hash
  only in logs, 0 spans to any model (tested over all seeded students).
