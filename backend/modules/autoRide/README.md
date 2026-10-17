# Zenvy Auto-Ride

Shared-auto seat booking and full-auto hire inside the customer app's Co-Ride section, plus the separate **Zenvy Auto Driver** app (`auto-driver-app/`, package `com.srm.zenvyautodriver`) and the admin page `/auto-ride`.

Everything is **off** until an admin switches it on.

## Pieces

| Part | Where |
|---|---|
| Backend module | `backend/modules/autoRide/` (models, migrations, routes, jobs, services, tests) |
| Customer API | `/api/auto-ride/*` (normal customer login) |
| Driver API | `/api/auto-ride/driver/*` (own login, JWT role `auto_driver`) |
| Admin API | `/api/admin/auto-ride/*` (admin only, every write audited) |
| Lifecycle job | `autoRide.lifecycle`, every 30 s (`backend/jobs/index.js`) |
| Customer screens | `customer-mobile/modules/autoRide/`, `customer-mobile/app/auto-ride/`, one "🛺 AUTO" sub-tab in Co-Ride |
| Driver app | `auto-driver-app/` (see its README for Firebase, keystore and build steps) |
| Admin page | `admin-dashboard/src/app/auto-ride/` |

## Database

There are no manual migrations. On boot the backend creates the `Auto*` tables (`sync()`) and `runAutoRideMigrations` adds the named and partial unique indexes. The boot log shows `[AUTORIDE_MIGRATION] N index checks ok`.

The tables are `AutoDrivers`, `AutoVehicles`, `AutoRoutes`, `AutoPickupPoints`, `AutoTrips`, `AutoBookings`, `AutoSeats`, `AutoPrivateRequests`, `AutoQueueCounters`, `AutoIncidents` and `AutoTripEvents`.

## Switches and settings

These are GlobalConfig rows, edited in admin → Auto-Ride → Settings:

| Key | Default | Meaning |
|---|---|---|
| `AUTO_RIDE_ENABLED` | off | Customers can browse and book; drivers can publish |
| `AUTO_RIDE_WALLET_ENABLED` | off | Wallet payment. Cash to the driver at boarding is always on. |
| `AUTO_RIDE_SETTINGS` | see below | Limits |

The `AUTO_RIDE_SETTINGS` limits:
- `platformMaxCapacity`: 8
- `holdMinutes`: 5
- `privateRespondMinutes`: 10
- `maxSeatsPerBooking`: 4, and never more than the platform max
- `maxAdvanceDays`: 7
- `reminderMinutes`: 15
- `noShowGraceMinutes`: 30
- `autoCompleteHours`: 6
- Refund: 100% before the driver confirms departure, 0% after

Optional environment variables:
- `AUTO_RIDE_DEV_ENABLE=1`: local only; it is ignored when `NODE_ENV=production` or `RENDER` is set.
- `AUTO_DRIVER_SESSION_TTL` (default 30d) and `AUTO_DRIVER_AUTH_MAX` (default 30 per 15 min).
- `AUTO_RIDE_HOLDS_PER_10MIN` (default 20) and `AUTO_RIDE_PRIVATE_PER_HOUR` (default 6).

Driver sign-up needs SMS OTP, so `FAST2SMS_API_KEY` must be set on Render.

## Before switching on (pilot)

1. **Legal:** confirm the permit type for per-seat shared trips, the passenger insurance cover, and driver documents (licence with transport badge, police verification). Capacity is set per vehicle from its RC; the owner confirmed 8 is permitted locally.
2. **Admin → Routes & Pickup Points:** add routes (seat and full-auto fare bounds, operating periods, minimum seats to depart) and pickup points (name, landmark, lat/lon to 6 decimals for "Open in Maps").
3. **Drivers install Zenvy Auto Driver, sign up, and upload documents and vehicles.**
4. **Admin → Drivers:** verify each driver. **Admin → Vehicles:** approve each vehicle. Approved capacity must not exceed the RC, and the seat layout is checked in the editor.
5. **Admin → Settings:** turn on `AUTO_RIDE_ENABLED`. Students on the latest customer app then see "🛺 AUTO" in Co-Ride.

## How it stays correct under load

- **Seat writes:** every seat-changing write goes through `withTripLock`. That is an in-process queue, then an IMMEDIATE transaction on SQLite or `SELECT … FOR UPDATE` on the trip row in Postgres. Seat counters are recomputed from the seat rows, not incremented.
- **Unique indexes:**
  - one live row per seat
  - unique queue numbers per pickup point, route, day and period
  - one active trip per vehicle and per driver
  - one live booking per user per trip
  - idempotency keys
- **Holds:** they expire after `holdMinutes`. They are released lazily inside the lock and also by the job.
- **Full-auto bookings:** they can only be accepted while no live seats exist, and they can never override existing seats.
- **Payments and PINs:** the boarding PIN is never sent to drivers. Wallet refunds happen exactly once.

## Tests

```
cd backend
npm run test:autoride
```

This runs 69 `node:test` cases on a temporary SQLite database. They cover the owner's 25 acceptance scenarios plus race and invariant tests (20 parallel holds for the last seat, 20 parallel publishes, private vs shared races, every transition × action), role isolation, the kill switch, privacy and rate limits.

## Known limits (v1)

- No live GPS or device location. "Nearby" lists the admin's pickup points.
- Ratings are not collected yet, so none are shown.
- Rate-limit buckets live in memory per process.
- The wallet has no ledger table, and there is no Postgres test lane.
