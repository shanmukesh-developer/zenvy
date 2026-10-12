# QA Progress

## Current State

- **Mode:** `AUDIT_ONLY` (default per request).
- **Cycle:** Phase 0 plus targeted loopback read-only checks; no full Workflow A cycle.
- **Last action:** Added Admin Student Verification route/navigation. Local pending queue GET returned HTTP 200 and the empty state.
- **Next action:** Broader E2E remains subject to the production-config and real-device notification safety limits.
- **Source state:** Admin verification page and navigation were added at the user's request. No verification, order, payment, notification, or user records were mutated.

## Safety Gate

Production Render URLs remain in Admin, Delivery, Restaurant, Customer API constants, and `render.yaml`. All probes in this audit explicitly called loopback; none contacted production. Local backend uses SQLite; WhatsApp provider/webhook and remote `DATABASE_URL` are unset. Customer test account contains 24 FCM tokens, so order/status broadcasts remain blocked.

## Prior Local Evidence (not part of this audit cycle)

- Local backend previously reported SQLite/connected; local API and dev previews were used with localhost API overrides.
- Read-only counts showed 14 local orders, 3 riders, and 24 FCM tokens on the seeded customer test account. This is why checkout and notification flows were avoided.
- Prior local smoke tests exercised screens and safe controls, but not a full customer→restaurant→rider→delivery lifecycle.
- Local order `#482401` was observed ReadyForPickup/unassigned and 168 minutes old; authenticated Rider queue includes it; it remains untouched.
- Delivery web's pending queue source omits rider JWT; direct no-token API returned 401 twice and valid token returned 200. No application fix was retained because mode is `AUDIT_ONLY`.

## Blocker To Resume

Before Cycle 1, re-read this file, recheck effective request origins on every client, and confirm new QA identities have no push tokens. Use only `http://127.0.0.1:8080`; do not follow production links/config defaults. Messaging remains blocked unless a stub is proven active. Delivery web UI regression is pending because its Next dev output was collided with by a production build.
