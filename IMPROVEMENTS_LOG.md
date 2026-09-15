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
