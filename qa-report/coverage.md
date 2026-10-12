# QA Coverage

Status values: `PASS`, `FAIL`, `BLOCKED`, `NOT_STARTED`. No full workflow cycle or mutations were run. Limited probes explicitly targeted loopback/local SQLite; production defaults remain in config, so broader testing is still blocked by the requested safety rule.

## Phase 0

| Area | Status | Evidence/limit |
|---|---|---|
| Application inventory | PASS (static) | Six app surfaces plus backend identified; see `system-map.md`. |
| Route/module inventory | PASS (partial static) | Backend mount roots and 231 route declarations in 25 route files located. |
| Database/auth/state map | PASS (static) | SQLite/PostgreSQL selection, JWT roles, order statuses identified. |
| Production endpoint scan | FAIL safety gate | Checked-in env/config contains Render production URLs; stop rule applies. |
| Local backend health | PASS (read-only) | `127.0.0.1:8080/api/health` returned online/SQLite/connected. |
| Local CMS banner config | PASS (read-only) | `/api/users/config` returned 200 and zero active banners; campaign display not dynamically testable. |
| Local order pickup inspection | PASS (read-only) | One unassigned `ReadyForPickup` order, 168 minutes old; authenticated Rider queue includes it. |
| Delivery web Rider auth contract | FAIL (suspected UI defect) | Missing-token pending API returned 401 twice; valid Rider JWT returned 200 and included the order. UI pending-card regression remains blocked after dev/build collision. |
| Admin Service Bookings coverage | SUSPECTED MISSING | Protected backend `/api/services/admin/all` exists; no Admin UI reference found. |
| Admin Mega Basket coverage | PARTIAL | Dashboard/Live Orders reads `/api/mega-basket/admin/all`; no dedicated Admin page or mutation routes found. |
| Broadcast endpoint authorization | BLOCKED / SUSPECTED RISK | Static route ordering places broadcast before Admin auth; no unauthenticated request sent because it can push to real tokens. |

## Current Audit Runtime Coverage

| Surface | Status | Notes |
|---|---|---|
| Customer native login/profile/checkout | BLOCKED | No native device/emulator verified for this audit; checkout must not call production. |
| Customer browse/cart/tabs | BLOCKED | Must run only after API config is isolated; previous local browser smoke is historical evidence, not this audit cycle. |
| Customer Home hero/animations | PASS (static) | HighClassPromoCarousel, miniature animations, staggered sections, and carousel auto-rotation exist in code; runtime/device animation not checked in this audit. |
| Customer CMS promo banners | BLOCKED / SUSPECTED | Local config has zero active banners; static wiring shows computed `carouselOffers` is not passed into the carousel. |
| Customer ad slot control | BLOCKED / SUSPECTED | AdSlot uses hard-coded sample creatives; no API/admin run controls are connected there. |
| Student verification | PASS (static, Campus Buddy only) | Verification modal, email OTP/ID-card paths and status banner exist under Campus Buddy; no direct Home verification control found. |
| Admin student verification | PASS (local read-only) | New sidebar route loaded; GET pending queue returned 200 and an empty state. Approve/reject was not invoked. |
| Home section scrolling | SUSPECTED (static) | Some section jumps use fixed y offsets; native viewport/layout regression not tested. |
| Delivery native screens/status transitions | BLOCKED | Native UI/device not available; local test workflow requires an isolated backend/config. |
| Delivery web protected requests | SUSPECTED FAIL | `DashboardContainer` omits auth headers on protected calls; backend contract reproduced by direct loopback requests; no source fix retained in Audit-Only. |
| Restaurant native app | BLOCKED | Device/emulator and local app API override not established for this audit. |
| Restaurant web orders/menu/actions | BLOCKED | Would require mutable operations against a safe local/staging data set. |
| Admin routes and read-only controls | PARTIAL PASS | Prior 19-route local crawl plus new Student Verification route; not a complete button inventory. |
| AuthN/AuthZ and IDOR | BLOCKED | No isolated QA identities/database transaction available under the production-config stop rule. |
| Order totals/payments/state machine | BLOCKED | No checkout, payment, or state mutation executed. |
| Push/SMS/WhatsApp/email | BLOCKED | Firebase credentials are configured; no external messaging was exercised. |
| DB integrity/concurrency/offline | BLOCKED | No SQL mutation, concurrent request, or network interruption test executed. |
| Responsive/native UI | BLOCKED | No Android device/emulator available; Expo web preview is not native-runtime verification. |

## Prior Local Smoke Evidence (from earlier conversation; not counted as this audit's cycles)

- Admin: 19 routes loaded; after an earlier Community URL fix, no API failures were observed in the routes checked.
- Restaurant: local login/menu/orders worked; one menu availability toggle was restored to its original value.
- Delivery: local Rider login/dashboard and authenticated sockets were observed; test rider was restored online.
- Customer: browser preview Home/Others/Orders/Basket/Profile navigation and cart interaction were observed; test basket later showed empty.
- Admin production build/lint, backend lint, native TypeScript checks, and Android bundle exports passed in prior local QA.
- Static review in this audit found the above Customer Home gaps; no app source was changed.
- Local order count was 14 after prior smoke; one unassigned `ReadyForPickup` record `#482401` was observed, created about 168 minutes earlier at that point. No order was changed.

## Counts

- Full audit workflow cycles: 0; no `QA_` user/order records created.
- Current-audit read-only API checks: targeted loopback health, CMS, restaurant-order, rider-queue/auth, and order-state probes; exact request count was not instrumented.
- Current-audit DB mutation operations: 0.
- Admin routes previously crawled: 19; this is not a full button inventory.
- Coverage percentage: could not be accurately calculated; no complete feature/button inventory was run.
