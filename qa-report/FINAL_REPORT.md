# Zenvy QA Report — Audit-Only Local Pass

## Execution Summary

- **Mode:** `AUDIT_ONLY`.
- **Full end-to-end cycles:** 0; no QA user/order was created.
- **Source changes:** 0 in this request.
- **Runtime mutation operations:** 0.
- **Loopback read-only API checks:** Targeted health, CMS, order, and Rider-auth probes; exact request count was not instrumented.
- **Admin routes previously crawled:** 19; full button audit not complete.
- **Coverage percentage:** Could not be accurately calculated.
- **Duration:** Not reported; not measured.

## Safety Decision

Production Render URLs remain in checked-in app configuration (`admin-dashboard/.env`, `delivery-app/.env`, `restaurant-portal/.env`, `customer-mobile/constants/api.ts`, and `render.yaml`). All API probes during this pass explicitly used loopback; none contacted production. No workflow mutation, test account creation, checkout, or notification send was performed because the checked-in production defaults and real-device FCM tokens remain a safety concern.

## System Map

See [system-map.md](system-map.md). The repo contains Customer/Restaurant/Rider Expo native apps, Admin/Delivery/Restaurant Next.js web apps, and an Express/Socket.IO/Sequelize backend. Local development is configured for SQLite; Render config points to PostgreSQL.

## Bug Summary

| ID | App | Feature | Severity | Status |
|---|---|---|---|---|
| QA-S01 | All clients | Production URLs in checked-in config | P1 QA safety blocker | Confirmed configuration fact; no production requests made |
| QA-S02 | Restaurant/Delivery/Admin | Old unassigned `ReadyForPickup` order `#482401` in local data | P2 suspected stale data | Not changed; test-fixture ownership unknown |
| QA-S03 | Customer/Admin | Active CMS banners not passed to Home carousel | P2 suspected static wiring | Not dynamically verified; local CMS has zero active banners |
| QA-S04 | Customer | Product AdSlot is hard-coded demo with no admin run control | P2 suspected/placeholder | Static finding only |
| QA-S05 | Customer | Some Home section jumps use hard-coded pixel offsets | P3 suspected | No native viewport regression |
| QA-S06 | Customer | Student Verification only directly exposed in Campus Buddy, not Home | P3 discoverability/requirement | Verification flow exists; desired Home placement unspecified |
| QA-S07 | Delivery web | Protected Rider requests omit JWT | P1 | Suspected UI defect; API auth contract reproduced |
| QA-S08 | Admin | Student verification page absent | P2 | Fixed; queue route returned 200/empty locally |
| QA-S09 | Admin | Service booking review page absent despite admin list API | P2 | Suspected static gap |
| QA-S10 | Admin | Mega Basket only appears in combined read-only feed | P2 | Suspected scope-dependent gap |
| QA-S11 | Backend/Admin | Global push broadcast route precedes auth middleware | P1 | Suspected static security risk; not invoked |

No complete end-to-end workflow was run. QA-S07 is supported by static client code and direct loopback API results; a browser-level pending-card regression remains unverified because the Delivery dev server hit a build/dev `.next` collision. Details and evidence are in [bugs.md](bugs.md) and [coverage.md](coverage.md).

The Admin Student Verification page was subsequently added at `/student-verification/`, linked in the sidebar, and read-tested against the local backend. There were zero pending requests, so approval and rejection actions remain untested.

## Cross-App/Data Consistency

A local-only read observed one `ReadyForPickup` order without a rider assignment, aged 168 minutes. The authenticated Rider queue includes it; requests without a token return 401. The order was not updated.

## Security

Static route inspection shows JWT and role middleware on Admin, Rider, and vendor routes, but the broadcast-push route appears before the Admin router's auth middleware and can send to saved tokens. It was not called. No current-user role/IDOR probes were run.

## Blocked Features

- Full Customer→Restaurant→Admin→Rider→Delivered workflow: blocked by production endpoint configuration and real-device FCM tokens in the prior local test database.
- Push, SMS, email, WhatsApp delivery: blocked; service credentials/integrations are configured and were not stubbed for this audit.
- Native device UI, location permissions, offline recovery, lifecycle/app-kill, responsive device sizes: blocked; no Android emulator/device was available.
- Mutation, concurrency, payment, IDOR, data-integrity, and exhaustive button coverage: not run; no QA_ identities/stubs were provisioned.
- Broadcast push route authorization: not dynamically tested because Firebase credentials and real user tokens are configured.

## Next Action

Create/use an isolated QA profile where every app points only to a local or staging backend and outbound messaging/payment is stubbed. Rerun Phase 0, then execute the risk-ordered workflows and record each operation and cleanup in the working files.
