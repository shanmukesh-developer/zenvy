# Zenvy Monorepo — Continuous Improvements Log

| Date (IST) | Portal / Component | Type | Description |
|---|---|---|---|
| 2026-09-16 | Delivery App | Refactor | Luxury obsidian & champagne gold redesign matching customer mobile design language |
| 2026-09-16 | Delivery App | Security/UX | Eradicated AI dev artifacts (auto-fill test rider button, backend URL leak, host modal) |
| 2026-09-16 | Delivery App | Verification | Clean release APK compiled (`app-release.apk`) and validated on Android emulator |
| 2026-09-16 | Customer Mobile | Audit & Fix | Full error sweep of core customer flows (browse -> order -> pay -> track) |
| 2026-09-16 | Customer Mobile | Security/UX | Removed leaked dev payment simulator button & hardened receipt upload in `checkout.tsx` |
| 2026-09-16 | Customer Mobile | Error Handling | Added live radar loading skeleton and telemetry offline error screen with retry in `tracking/[id].tsx` |
| 2026-09-16 | Customer Mobile | Error Handling | Added resilient error card with 1-tap retry sync in `(tabs)/orders.tsx` |
| 2026-09-16 | Customer Mobile | UX/Branding | Elevated `ServerWakeupOverlay.tsx` copy from dev leak to premium campus dispatch branding |
| 2026-09-16 | Customer Mobile | UX/Reliability | Upgraded `restaurant/[id].tsx` from bare text to dedicated luxury offline screen with back navigation |
| 2026-09-16 | Customer Mobile | Verification | Validated entire mobile codebase with `tsc --noEmit` (0 compile errors) |
| 2026-09-16 | Admin Dashboard | Reliability | Eradicated localhost fallbacks across 21 pages/components to target deployed Render backend |
| 2026-09-16 | Admin Dashboard | Build & Prerender | Verified Next.js Turbopack build (24 routes prerendered, 0 build errors) |
| 2026-09-16 | Restaurant Portal | Reliability | Updated API & Socket fallbacks to deployed Render cloud backend |
| 2026-09-16 | Restaurant Portal | Build & Prerender | Verified Next.js Turbopack build (all routes prerendered, 0 build errors) |
| 2026-09-16 | Delivery App | Reliability | Eliminated localhost fallback in `src/constants/api.ts` to ensure remote connectivity |
| 2026-09-16 | Delivery App (Web) | Build & Prerender | Verified Next.js 14 production build (6 static pages, 0 errors) |
| 2026-09-16 | Customer Mobile | UX Polish | Dynamic user votes counter in campus community photo wall (`community.tsx`) |
| 2026-09-16 | Customer Mobile | Professionalism | Cleaned UPI container naming & styles in bulk apartment grocery flow (`mega-basket.tsx`) |
| 2026-09-16 | Customer Mobile | UX & Rewards | Added luxury unauthenticated state, active coupons drawer, and 1-tap clipboard code copy in `rewards.tsx` |
| 2026-09-16 | Customer Mobile | Bug Fix & UX | Replaced deprecated Clipboard API with `@react-native-clipboard/clipboard` and added graceful 404 recovery in `products/[id].tsx` |
| 2026-09-16 | Customer Mobile | UX Polish | Dynamically adjusted spend telemetry & top ordered items for vegetarian users in `(tabs)/profile.tsx` |
| 2026-09-16 | Delivery App | Feature/UX | Added prominent `🔔 I HAVE ARRIVED AT HOSTEL GATE` action in `FleetOrderCard.tsx` |
| 2026-09-16 | Restaurant Portal | Design Polish | Fixed dark mode receipt modal background on screen while preserving thermal print styling in `OrderDetailModal.tsx` |
| 2026-09-16 | Admin Dashboard | Feature/UX | Upgraded `LiveRiderMap.tsx` with live telemetry HUD, custom SVG/CSS divIcons, and campus landmark hubs |
| 2026-09-16 | Customer Mobile | UX & Support | Added campus helpline drawer, pull-to-refresh, unauthenticated state, and empty state CTA in `support.tsx` |
| 2026-09-16 | Admin Dashboard | Feature/UX | Added quick resolution reply templates and direct phone click-to-call in `tickets/page.tsx` |
| 2026-09-16 | Restaurant Portal | Professionalism | Replaced AI sci-fi copy (Asset, Deploy New Asset, Processing Uplink) with culinary terms in `RestaurantForms.tsx` |
| 2026-09-16 | Delivery App | Professionalism | Eradicated hardcoded mock rider names (`Vikram Singh`), fake number plates, and static phones in `FleetProfileView.tsx` |
| 2026-09-16 | Delivery App | UX Polish | Added luxury cycle reset empty state in `FleetLeaderboard.tsx` |
| 2026-09-16 | Customer Mobile | Navigation/UX | Added safe `router.canGoBack()` fallback navigation in campus friends circle (`friends.tsx`) |
| 2026-09-16 | Customer Mobile | UX & Error Handling | Humanized raw network & auth failure exceptions into actionable error guidance in `login.tsx` |
| 2026-09-16 | Customer Mobile | UX & Error Handling | Sanitized OTP dispatch & registration error states against raw exception leakage in `register.tsx` |
| 2026-09-16 | Customer Mobile | UX & Loading | Added `RestaurantCardSkeleton` shimmer grid & luxury 1-tap filter reset empty state in `(tabs)/index.tsx` |
| 2026-09-16 | Customer Mobile | UX & Transparency | Added multi-kitchen order awareness banner and per-restaurant dispatch fee breakdown in `(tabs)/basket.tsx` |
| 2026-09-16 | Admin Dashboard | Professionalism | Replaced sci-fi copy (Tactical Income Tracing, Trace ID, Origin Partner) with financial accounting terms in `finance/page.tsx` |
| 2026-09-16 | Admin Dashboard | Professionalism | Replaced AI jargon (Scarcity Asset, Initialize Node, Terminal) with product terminology in `vault/page.tsx` |
| 2026-09-16 | Restaurant Portal | UX & Error Handling | Replaced raw browser alert with toast notification and sci-fi copy (Deploy Asset) with culinary phrasing in `dashboard/page.tsx` |
| 2026-09-16 | Customer Mobile | UX & Bug Fix | Preserved unread status highlight on open and cleared bell icon badge on unmount in `notifications.tsx` |
| 2026-09-16 | Customer Mobile | Professionalism | Replaced raw phone number text with professional 1-tap WhatsApp booking copy in `onboarding.tsx` and `CampusServicesMapModal.tsx` |
| 2026-09-16 | Customer Mobile | UX & Resilience | Sanitized order placement error handling and eliminated sci-fi jargon (mission slot, logistics fee, free bypass) in `checkout.tsx` |
| 2026-09-16 | Customer Mobile | UX & Empty States | Enhanced PG Stays, Co-Ride feed, and commute empty states with 1-tap action CTAs in `(tabs)/others.tsx` |


