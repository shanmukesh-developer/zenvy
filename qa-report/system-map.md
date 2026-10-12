# Zenvy System Map

**Audit mode:** `AUDIT_ONLY` (default). No source files were edited during this QA request.  
**Phase 0 status:** Static discovery started; dynamic audit stopped at the production-configuration safety gate.

## Applications

| App | Stack | Entry/navigation | Local command/port |
|---|---|---|---|
| Customer native | Expo SDK 57, React Native 0.86, Expo Router | `customer-mobile/app/`; tabs Home, Others, Orders, Basket, Profile; nested login/register, checkout, restaurant/product, tracking, friends/community, rewards, support | `npx expo start`; Android export `npx expo export --platform android`; prior preview used 19006 |
| Delivery partner native | Expo SDK 57, React Native 0.86 | `delivery-boy-app/App.tsx`; rider login/dashboard and services under `src/` | `npx expo start`; Android export `npx expo export --platform android` |
| Restaurant native | Expo SDK 57, React Native 0.86 | `restaurant-mobile/src/screens/`; login/dashboard | `npx expo start`; Android export `npx expo export --platform android` |
| Admin website | Next.js 16.2, React | `admin-dashboard/src/app/`; dashboard plus fleet, restaurants, orders, vault, finance, tickets, users, student verification, coupons, bikepool, community, wall, PG, analytics, audit, blocks, CMS, notifications | `npm run dev`, port 3004; build `npm run build`; lint `npm run lint` |
| Delivery web portal | Next.js 14.2, React | `delivery-app/src/app/`; rider login and dashboard | `npm run dev`, port 3001; build `npm run build` |
| Restaurant web portal | Next.js 16.2, React | `restaurant-portal/src/app/`; login/dashboard | `npm run dev`, port 3002; build `npm run build` |
| Backend | Node.js, Express 5, Socket.IO, Sequelize | `backend/server.js`, controllers, route modules | `npm start`; local default port 8080; `npm run lint` |

## Backend And Data

- Sequelize models are initialized in `backend/config/db.js`.
- Local development uses `backend/local_dev.sqlite` when `DATABASE_URL` is unset; production is configured for Render PostgreSQL.
- The local backend health check observed in prior local QA returned online/connected/SQLite. That observation predates this audit's production-config gate.
- Major model families include users, restaurants/menu items, orders/delivery partners, wallets/coupons, support/community/birthdays, bike pools, PG/room bookings, mega-baskets, friendships/chat, campus services, and campus modules.
- No schema/data writes were made during this audit request.

## API Mounts And Roles

Backend route roots mounted in `backend/server.js` include:

`/api/users`, `/api/restaurants` (also singular `/api/restaurant`), `/api/orders`, `/api/delivery`, `/api/search`, `/api/bikepool`, `/api/pg`, `/api/mega-basket`, `/api/wall`, `/api/services`, `/api/blocks`, `/api/vault`, `/api/admin`, `/api/rewards`, `/api/community`, `/api/birthdays`, `/api/tickets`, `/api/test`, `/api/system`, `/api/config`, `/api/features`, `/api/chat`, `/api/friends`, `/api/rooms`, `/api/daily-content`, `/api/campus`.

Static route discovery found 231 route declarations in 25 files under `backend/routes/`; individual method/path declarations are in those modules. Major contracts:

- Authentication: `/api/users/login`, `/api/users/register`, `/api/delivery/login`, `/api/restaurants/login`.
- Orders: `POST /api/orders`; customer orders/history; admin order listing/update; restaurant accept/ready; rider pending/active/history/accept/status.
- Rider APIs are protected by JWT plus rider-role middleware.
- Admin routes use JWT plus admin-role middleware except the explicitly separate broadcast-push route.
- Restaurant menu/order management uses JWT plus vendor ownership checks.
- User JWTs are carried in Bearer headers and/or secure cookies; Socket.IO authenticates JWTs in handshake auth/header/cookie.

## Order State Machine (from code)

Implemented statuses include `Pending`, `Accepted`, `Preparing`, `ReadyForPickup`, `Picking`, `PickedUp`, `ArrivedAtGate`, `Delivered`, and `Cancelled`. Restaurant readiness and rider pickup/delivery have separate endpoints. Rider acceptance atomically claims unassigned eligible orders. Delivery completion validates PIN when a PIN exists.

## Integrations

- Firebase Admin for push and phone verification; Firebase client in apps.
- Socket.IO for cross-app order/rider/admin events.
- WhatsApp bridge supports console mode by default and webhook mode when configured.
- Expo notifications, Google sign-in, location, maps, media/upload, and external image/audio assets are referenced in app code.

## Production-Safety Gate

Static inspection found production URLs in `admin-dashboard/.env`, `delivery-app/.env`, `restaurant-portal/.env`, `customer-mobile/constants/api.ts`, and `render.yaml`. The dev servers observed in prior work were explicitly launched with localhost overrides, but this audit follows the stricter user rule: stop runtime testing when any checked-in app config points at production. Do not run workflow mutations until those environments are isolated or the user explicitly supplies a staging setup.

## Existing Test/QA Surface

- Root: `e2e_full_ecosystem.js`, `e2e_test.js`, toggle scripts, diagnostics.
- Backend: package `test` script is a placeholder failure; numerous standalone test/check scripts exist.
- Expo Android exports and frontend builds/typechecks were run in prior local QA work; they are not a substitute for this audit's blocked end-to-end cycles.
