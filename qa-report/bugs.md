# Bug Log

No new bug was marked `CONFIRMED` during this audit because the required production-safety check stopped runtime testing before reproduction cycles. Findings below are separated by evidence source.

## QA-S01 — Production URLs In Checked-In Runtime Configuration

- **Severity:** P1 safety blocker for unattended QA (not necessarily an application defect)
- **App:** Customer, Admin, Delivery web, Restaurant web, Render deployment
- **Screen/endpoint:** Environment/configuration
- **Preconditions:** Use repository defaults without explicit local API overrides.
- **Steps:** Inspect Admin/Delivery/Restaurant `.env`, Customer API constants, and `render.yaml`.
- **Expected:** QA target is explicitly local/staging before any mutation tests.
- **Actual:** Multiple checked-in values point at `https://hostelbites-backend-jwmt.onrender.com`.
- **Repro rate:** 1/1 static scan.
- **Evidence:** Static matches recorded in Phase 0 search; no production request was sent in this audit.
- **Related apps:** All clients/backend.
- **Likely root cause:** Production defaults are co-located with local development configuration.
- **Suggested fix:** Provide an explicit isolated QA env/profile and have test scripts refuse non-local/non-staging origins.
- **Status:** CONFIRMED (configuration fact); dynamic impact not tested.

## QA-S02 — Old Unassigned Ready-For-Pickup Order

- **Severity:** P2 suspected stale operational data
- **App:** Restaurant, Delivery, Admin, backend DB
- **Screen/endpoint:** Restaurant Live Feed order `#482401`
- **Preconditions:** Local SQLite snapshot used by previous local smoke run.
- **Steps:** Read restaurant orders through the local backend and compare order status/assignment/createdAt.
- **Expected:** Active pickup order is assigned or escalated/clearly flagged after an operational SLA.
- **Actual:** `ReadyForPickup`, no delivery partner, created 168 minutes earlier in the current local snapshot. The authenticated Rider pending API included it; all three local riders were online and approved.
- **Repro rate:** 1 local record observed; not a repeated workflow.
- **Evidence:** Read-only Restaurant orders API, Rider pending API, and SQLite summaries in this session; order not modified.
- **Related apps:** Restaurant, Delivery, Admin, Customer.
- **Likely root cause:** Stale seeded/local test order or missing escalation/timeout workflow; not proven.
- **Suggested fix:** Confirm whether this record is test fixture; if real, add stale-pickup escalation/monitoring rather than silently leaving it active.
- **Status:** SUSPECTED (data observation only); not changed because it may not be QA-owned.

## Historical Fixes Already Present In Worktree

These were made and checked in previous interaction context, before this strict Audit-Only phase. No source edit was made for them during this audit.

- Admin Community read/delete URLs aligned to backend routes; page/API recheck returned expected empty state.
- Delivery web auth issue QA-S07 was identified in this audit; no fix was retained because this audit is `AUDIT_ONLY`.
- Backend restaurant acceptance socket emitter, Admin auth interceptor, Customer native `StyleSheet.absoluteFill`, Admin lint setup, EAS placeholder cleanup, and setup docs were previously handled and locally checked as described in earlier session notes.

## QA-S03 — Admin CMS Banners Are Not Fed To Home Carousel

- **Severity:** P2 (Admin-created campaign banners may not appear in the Customer Home carousel)
- **App:** Customer native + Admin
- **Screen/endpoint:** Customer Home promotional carousel; `/api/users/config`
- **Preconditions:** An active banner exists in Global CMS.
- **Steps:** Set an active CMS banner; launch Customer Home and wait for config load; inspect the carousel slides.
- **Expected:** Active CMS banners appear in the Home carousel with their configured CTA/redirect.
- **Actual:** Home fetches CMS banners into `promos` and computes `carouselOffers`, but renders `HighClassPromoCarousel` with only `featuredRestaurants`; the `carouselOffers` value has no other use. The carousel then chooses built-in slides plus featured restaurants.
- **Repro rate:** Static evidence 1/1; dynamic symptom not reproduced because local CMS currently returns zero banners.
- **Evidence:** `customer-mobile/app/(tabs)/index.tsx` contains the unused carousel data construction and omits `slides`; local `GET /api/users/config` returned HTTP 200 with zero banners.
- **Related apps:** Admin CMS, Customer native.
- **Likely root cause:** Missing `slides={carouselOffers}` wiring or equivalent transformation passed to the carousel.
- **Suggested fix:** In `AUDIT_AND_FIX`, pass the mapped active CMS slides and add a local test with a QA-only active banner.
- **Status:** SUSPECTED (static).

## QA-S04 — AdSlot Is A Hard-Coded Demo, Not Admin-Controlled

- **Severity:** P2 if this is intended to be a live ad system; otherwise placeholder/design debt
- **App:** Customer native
- **Screen/endpoint:** Product detail `AdSlot`
- **Preconditions:** Open a product detail screen that renders the footer ad.
- **Steps:** Open a product; change/disable an ad in Admin CMS; revisit/reload the product screen.
- **Expected:** Ad delivery, active state, placement, and destination follow Admin configuration.
- **Actual:** `customer-mobile/components/AdSlot.tsx` resolves a fixed in-file `ADS` map after a simulated timeout; click/impression tracking is development-console only. No backend/admin ad-run API is called there.
- **Repro rate:** Static evidence 1/1; not dynamically tested.
- **Evidence:** `fetchAdCreative` is a hard-coded resolver and `trackAdEvent` only logs under `__DEV__`; Admin CMS controls carousel banners, not these ad slots.
- **Related apps:** Customer native, Admin.
- **Likely root cause:** AdSlot is a placeholder implementation independent of CMS banner configuration.
- **Suggested fix:** Define whether these are sample ads or live campaigns; for live ads, add a server-managed placement/active schedule and consume it from AdSlot.
- **Status:** SUSPECTED (static).

## QA-S05 — Home Section Jumps Use Fixed Pixel Offsets

- **Severity:** P3 (navigation may land between sections on different content/device sizes)
- **App:** Customer native
- **Screen/endpoint:** Home hero/category CTAs and category preference modal
- **Preconditions:** Different device height, dynamic text, loading state, or carousel/CMS content changes above the destination.
- **Steps:** Tap the Food/Biryani/KFC/Free Cash jump controls across multiple viewport/content configurations.
- **Expected:** Scroll lands at the intended section regardless of layout height.
- **Actual:** Several handlers call `scrollTo({ y: 485 })` or `scrollTo({ y: 700 })`; only the menu explorer uses an `onLayout` anchor.
- **Repro rate:** Static evidence 1/1; viewport reproduction blocked by no native device/emulator.
- **Evidence:** `customer-mobile/app/(tabs)/index.tsx` has fixed offsets at hero/category handlers.
- **Related apps:** Customer native.
- **Likely root cause:** Hard-coded content coordinates instead of measuring section anchors.
- **Suggested fix:** In `AUDIT_AND_FIX`, assign refs/onLayout coordinates to destination sections and scroll to measured positions; verify on at least two device sizes.
- **Status:** SUSPECTED (static).

## QA-S06 — Verification Exists, But Is Not A Direct Home Control

- **Severity:** P3 discoverability gap, not a missing verification workflow
- **App:** Customer native
- **Screen/endpoint:** Home / Campus Buddy (`/friends`) / Student Verification modal
- **Preconditions:** Student wants to verify from the main ordering Home.
- **Steps:** Open Home and look for verification status/action without entering Campus Buddy.
- **Expected:** If Home-level verification is required, a clear status/CTA is visible there.
- **Actual:** Verification modal and status callouts exist in Campus Buddy's `CampusShell`/`CampusHeader`/`YouTab`; Home links to Campus Buddy via a carousel card but has no direct verification badge/action.
- **Repro rate:** Static evidence 1/1; exact desired placement not specified.
- **Evidence:** `customer-mobile/modules/campus/components/VerificationModal.tsx`, `CampusHeader.tsx`, `CampusShell.tsx`, and `customer-mobile/app/friends.tsx`.
- **Related apps:** Customer native, campus verification API.
- **Likely root cause:** Verification is scoped to Campus Buddy rather than the main Home/profile entry points.
- **Suggested fix:** Confirm desired UX placement; surface current verified/pending status and a direct entry point if Home visibility is required.
- **Status:** SUSPECTED (requirement/placement).

## QA-S07 — Delivery Web Dashboard Omits Rider JWT On Protected Requests

- **Severity:** P1 (web Rider order discovery and status actions are unauthorized against protected APIs)
- **App:** Delivery web, backend, rider workflow
- **Screen/endpoint:** `delivery-app/src/components/Dashboard/DashboardContainer.tsx`; `/api/delivery/orders/pending` and sibling protected APIs
- **Preconditions:** Rider is signed into Delivery web; backend route uses `protect` and `rider` middleware.
- **Steps:** Inspect `fetchPendingOrders()` and its request; compare with backend auth contract. Request local `/api/delivery/orders/pending` without Authorization twice, then with a valid local Rider JWT once.
- **Expected:** Delivery web sends `Authorization: Bearer <rider JWT>` and receives the rider's pending queue.
- **Actual:** `fetchPendingOrders()` and several other web calls send no token. Local endpoint returned 401 `Not authorized, no token` twice without it; with the local Rider JWT it returned 200 and included `#482401`.
- **Repro rate:** Missing-token API response 2/2; authenticated response 1/1. UI-level pending-card display was not verified because the Delivery dev server hit a `.next` build/dev collision.
- **Evidence:** Source request lacks headers; protected route declaration in `backend/routes/deliveryPartnerRoutes.js`; direct loopback API results. No production request was made.
- **Related apps:** Delivery web, backend, Admin/Restaurant order workflow.
- **Likely root cause:** Web dashboard bypasses the token-aware API client used by the native Rider app.
- **Suggested fix:** In `AUDIT_AND_FIX`, route web Rider requests through an authenticated API client or add Bearer headers to all protected fetches, then regression-test an isolated QA Rider/order flow.
- **Status:** SUSPECTED (static UI defect with reproduced API contract).

## QA-S08 — Admin Student Verification Screen Missing

- **Severity:** P2 (admin workflow had API support but no UI)
- **App:** Admin website / Campus verification
- **Screen/endpoint:** Admin navigation and `/api/campus/verify/requests`
- **Preconditions:** Admin needs to review a student email or ID-card submission.
- **Steps:** Inspect Admin routes and the existing backend review API.
- **Expected:** Admin has a queue to inspect verification details and approve/reject submissions.
- **Actual:** No Admin screen or navigation entry existed; protected backend list/review endpoints were present.
- **Repro rate:** Static absence 1/1; new page locally verified at `/student-verification/`.
- **Evidence:** New page's protected pending-request GET returned HTTP 200 and an empty request list; page rendered the empty state.
- **Related apps:** Customer Campus Buddy, backend campus module.
- **Likely root cause:** Backend verification workflow was implemented without an Admin UI surface.
- **Suggested fix:** None; Admin queue and navigation are now added.
- **Status:** FIXED / VERIFIED (read-only empty queue; approve/reject not exercised).

## QA-S09 — Admin Service Bookings Panel Missing

- **Severity:** P2 (Admin cannot review campus service requests from the portal)
- **App:** Admin website / Services backend
- **Screen/endpoint:** No Admin screen; `GET /api/services/admin/all`
- **Preconditions:** A student has booked a campus service (repair, laundry, ride, printout, etc.).
- **Steps:** Inspect Admin routes/pages and compare with the backend admin service route.
- **Expected:** Admin can review/filter service bookings and understand status, requester, service type, location, and amounts.
- **Actual:** Backend exposes an admin-only list endpoint with status/serviceType/hostelBlock filters and newest-first results, but no Admin page calls it.
- **Repro rate:** Static comparison 1/1; not dynamically tested.
- **Evidence:** `backend/routes/serviceRoutes.js` has `/admin/all`; no matching path/reference exists in `admin-dashboard/src/**`.
- **Related apps:** Customer services booking, Admin, backend.
- **Likely root cause:** Services workflow backend shipped without an Admin review surface.
- **Suggested fix:** Add a read/filter Admin Service Bookings page first; keep mutations limited to explicitly defined state transitions.
- **Status:** SUSPECTED (static).

## QA-S10 — Mega Basket Is Only Read-Visible In Admin

- **Severity:** P2 if operators are expected to manage basket lifecycle in Admin
- **App:** Admin website / Mega Basket
- **Screen/endpoint:** Dashboard/Live Orders and `GET /api/mega-basket/admin/all`
- **Preconditions:** Active or historical Mega Basket records exist.
- **Steps:** Inspect Dashboard/Live Orders and Admin Mega Basket backend routes.
- **Expected:** Admin can inspect basket details and use any required moderation/support controls.
- **Actual:** Baskets are merged into the Dashboard/Live Orders feed; backend exposes only an admin list route, not a dedicated page or Admin basket action routes.
- **Repro rate:** Static comparison 1/1; no basket data was modified.
- **Evidence:** Admin `src/app/page.tsx` reads `/api/mega-basket/admin/all`; `backend/routes/megaBasketRoutes.js` only declares the Admin GET route.
- **Related apps:** Customer Mega Basket, Rider basket flow, Admin.
- **Likely root cause:** Admin visibility was added to dashboard aggregation without a complete support/management module.
- **Suggested fix:** Define required Admin basket actions, then add a dedicated queue/detail screen and server-side role-checked endpoints only for those actions.
- **Status:** SUSPECTED (scope-dependent static gap).

## QA-S11 — Global Push Broadcast Route Is Not Auth-Gated

- **Severity:** P1 security/abuse risk
- **App:** Backend / Admin notifications
- **Screen/endpoint:** `POST /api/admin/broadcast-push`
- **Preconditions:** Backend has Firebase credentials and active user push tokens.
- **Steps:** Static inspect `backend/routes/adminRoutes.js` middleware ordering and `broadcastPushNotification` handler.
- **Expected:** Broadcast endpoint requires valid Admin authentication and role before contacting FCM or emitting a global socket event.
- **Actual:** Route is registered before `router.use(protect)` and `router.use(admin)`; handler sends to stored user tokens/topic and emits `global_announcement` without checking role itself.
- **Repro rate:** Static evidence 1/1. No unauthenticated request was sent because it could message real devices.
- **Evidence:** `backend/routes/adminRoutes.js` registers `/broadcast-push` above the protected middleware; `backend/controllers/adminController.js` handler gathers tokens, sends multicast/topic pushes, and emits a global event.
- **Related apps:** Admin, Customer, Delivery, Restaurant, backend.
- **Likely root cause:** The broadcast route was intentionally or accidentally exempted from the Admin router guard without an equivalent handler-level auth check.
- **Suggested fix:** Require `protect` and `admin` on the route or enforce the same checks inside the handler, then verify unauthorized requests return 401/403 using a sandbox with push stubbed.
- **Status:** SUSPECTED (static security finding; runtime probe intentionally blocked).
