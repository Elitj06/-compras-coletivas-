# Implementation record

## Scope

- Added server-side order validation/pricing boundary; browser price, discount, name and category are no longer used by `POST /pedidos`.
- Added bounded JSON parser, cookie transport helpers and persisted CSRF hashes for newly issued buyer/admin sessions, plus an additive fail-closed migration.
- The SPA now uses same-origin credentials and double-submit CSRF headers; it no longer reads or persists authorization tokens.
- All authenticated POST/PUT/DELETE routes in `api/db.js` pass a central origin/fetch-metadata/CSRF scope gate. Deleting one order requires explicit `X-Session-Scope`.
- Administrative login now fails closed when a valid Vercel forwarded IP or 32-character HMAC key is unavailable, and applies persistent IP/global buckets.
- Unsafe upload was disabled with a stable `503 UPLOAD_TEMPORARILY_DISABLED`; no XLSX claim remains in the API contract. `xlsx` was removed and lockfile-only audit now reports zero high/critical vulnerabilities after updating nodemailer and ws resolution.
- Worktree files excluded: `SYNC-RESULT.md`, `SYNC-TASK.md`, `scripts/sync_july2026.py`.

## Remaining release gates

This is implementation-only. Production preflight, disposable PostgreSQL migration, conversion of every remaining administrative mutation and upload route to the CSRF guard, dependency remediation, independent verification, commit, deploy and live smoke are still required before release.

## Local evidence

- `npm test`: 20 passed, 0 failed, 1 PostgreSQL integration suite skipped because no disposable database was supplied.
- `node --check api/db.js`, `server/lib/http-security.js` and `server/services/order-pricing-service.js`: passed.
- `npm audit --package-lock-only --omit=dev --audit-level=high`: 0 vulnerabilities.
- `git diff --check`: scoped implementation has no reported issue; the repository-wide command remains non-zero solely because the pre-existing excluded `SYNC-RESULT.md` contains trailing whitespace.

## Risks / limits

The migration and API database behavior have not been exercised against a disposable PostgreSQL database because no discardable connection was supplied. This remains a mandatory release gate, along with production read-only preflight, independent verification, backup, commit, push, deployment and live smoke. Existing untracked/modified sync artifacts were preserved and excluded.

## Final implementation status by acceptance area

| Area | Status | Evidence / limitation |
|---|---|---|
| Server-calculated buyer checkout | Implemented locally | Catalog-derived cent calculation and strict payload tests pass; PostgreSQL transaction/concurrency behavior is untested without a disposable database. |
| Cookie session and CSRF transport | Implemented locally | `__Host-cc-*` cookies, persisted CSRF hashes for newly issued sessions, scope/origin guards and cookie serializer tests are present. Full route integration needs PostgreSQL verification. |
| Buyer/admin SPA token removal | Implemented locally | No bearer header or browser token persistence remains in application code; session restoration uses same-origin cookies. |
| Admin login limit | Implemented locally | Fail-closed trusted-header/HMAC guard and persistent buckets were added; atomic concurrent decision and exact retry time require database integration testing. |
| Upload | Safely disabled | Stable 503 response and regression test; secure parser intentionally out of scope. |
| Dependency audit | Implemented locally | `xlsx` removed; nodemailer/ws lock resolution updated; lockfile audit reports 0 vulnerabilities. Installed `node_modules` has not been regenerated, so it must be refreshed in the release environment. |
| SQL migration/preflight | Written, unexecuted | `sql/08_security_hardening.sql` is idempotent/fail-closed in design; a disposable PostgreSQL URL was unavailable. |
| Production release | Not attempted | No backup, commit, push, Vercel deploy or live smoke was authorized in this implementation phase. |

## Repair cycle 1

- Corrected cookie issuance order for successful admin login and preserved the administrative CSRF hash returned from the session lookup.
- Removed buyer/PIN-change tokens before serializing JSON, issued the replacement buyer cookie pair for PIN change, and made the order delete scope strict and authoritative.
- Discount policy mutations now take the shared advisory lock and no longer call the legacy snapshot-repricing function; replacement selection now locks the prior order row.
- Re-ran `node --check api/db.js`, `npm test` (20 pass) and lockfile audit (0 vulnerabilities).

### Still not demonstrably complete

The verifier-required route/database tests, exact atomic two-bucket admin rate decision with computed `Retry-After`, canonical IP parser, all administrative item repricing paths, and disposable PostgreSQL concurrency tests have not been implemented/proven. These remain release blockers and must not be represented as complete.

## Repair cycle 2

- Administrative item addition now accepts only code/quantity and resolves name, category, price and active policy in the server transaction under the shared policy lock. Quantity edits retain stored snapshots while taking the same lock.
- Administrative limiting now validates environment-specific trusted IP sources, rejects invalid IPv4/IPv6 shapes, consumes both buckets in one database transaction and derives `Retry-After` from the latest persisted block time.
- Added security response headers/CORS credentials and made expired buyer logout always expire the buyer cookie pair.
- Final local gates: `npm test` 20 passed, lockfile audit 0 vulnerabilities, syntax check passed, `vercel build` completed successfully.

### Final external blocker

No disposable PostgreSQL connection was provided. Therefore migration preflight/idempotency, real route cookie/CSRF behavior, two-connection policy/replacement concurrency and persistent rate-limit concurrency remain unverified. Production backup, deployment and smoke were not attempted.
