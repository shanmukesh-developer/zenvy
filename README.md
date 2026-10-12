# Zenvy

Zenvy is a campus-first delivery and services app. Students order food, groceries and services from campus restaurants, stores and local stalls. Orders are delivered by Zenvy riders, or by the vendor directly for local stalls. Payment is Cash on Delivery or the Zenvy Wallet.

The repo is a monorepo: **one backend** and **five apps** that all talk to it.

| Folder | What it is | Stack |
| --- | --- | --- |
| `backend/` | The only API + realtime server (orders, catalogue, auth/OTP, wallet, campus social, admin) | Node, Express, Sequelize, socket.io, PostgreSQL |
| `customer-mobile/` | Zenvy customer app (browse, basket, checkout, live tracking, campus features) | Expo / React Native |
| `admin-dashboard/` | Admin web console (stores, menus, orders, riders, announcements) | Next.js |
| `delivery-boy-app/` | Zenvy Rider app (rider pool, pickup/drop, delivery PIN) | Expo / React Native |
| `restaurant-mobile/` | Zenvy Partner app for restaurants (live order alerts, accept/ready, menu stock, store on/off) | Expo / React Native |
| `vendor-app/` | Zenvy Vendor app for local stalls (`LOCAL_VENDOR`). These orders are placed in Zenvy, paid COD to the vendor and delivered by the vendor, with no rider pool and no delivery PIN | Expo / React Native |

All apps use the production backend at `https://hostelbites-backend-jwmt.onrender.com` by default. Override it with the env vars below for local work. Never run write tests against production.

## Local development

Requirements: Node 20+, npm, and (for device builds) Android Studio / an Android device. PostgreSQL is optional locally.

### Backend

```bash
cd backend
npm install --legacy-peer-deps
cp .env.example .env      # then fill in values
npm run dev               # nodemon server.js
```

With no `DATABASE_URL`, the backend falls back to a local SQLite file (`backend/local_dev.sqlite`, git-ignored). With a Postgres `DATABASE_URL`, schema changes are applied on startup by `config/db.js`. New columns must be nullable and added idempotently there.

Optional seed for a fresh local DB: `npm run seed:full` (runs `scripts/unified_seed.js`).

### Admin dashboard

```bash
cd admin-dashboard
npm install --legacy-peer-deps
# .env.local -> NEXT_PUBLIC_API_URL / NEXT_PUBLIC_SOCKET_URL
npm run dev               # http://localhost:3004
```

### Mobile apps (customer-mobile, delivery-boy-app, restaurant-mobile, vendor-app)

```bash
cd customer-mobile        # or any of the other three
npm install --legacy-peer-deps
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:<backend-port> npx expo start
```

Without `EXPO_PUBLIC_API_URL` the apps talk to production.

## Environment variables (names only)

Secrets live in the Render dashboard (backend) and in local `.env` files, which are git-ignored. Only `backend/.env.example` is committed.

**Backend**

- Core: `PORT`, `NODE_ENV`, `JWT_SECRET`, `DATABASE_URL`, `DB_SYNC_ALTER`, `RENDER`, `RENDER_EXTERNAL_URL`, `PUBLIC_API_URL`
- CORS / web: `CORS_ORIGIN`, `ALLOWED_ORIGINS`, `FRONTEND_URL`
- Firebase (push + phone auth): `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_SERVICE_ACCOUNT_BASE64`
- OTP / messaging: `OTP_SECRET`, `OTP_DAILY_CAP`, `FAST2SMS_API_KEY`, `BREVO_API_KEY`, `MAIL_FROM`, `COLLEGE_EMAIL_DOMAINS`, `WHATSAPP_PROVIDER`, `WHATSAPP_WEBHOOK_URL`, `PG_DESK_WHATSAPP`
- Admin bootstrap: `ADMIN_PHONE`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `SEED_KEY`
- Order / rider tuning: `PENDING_ORDER_TIMEOUT_MINUTES`, `UNCLAIMED_ORDER_TIMEOUT_MINUTES`, `MEGA_BASKET_TIMEOUT_MINUTES`, `RIDER_MAX_ACTIVE_ORDERS`, `RIDER_OFFLINE_GRACE_MINUTES`, `RIDER_FRESH_MINUTES`
- Rate limits / misc: `RATE_LIMIT_USER_MAX`, `RATE_LIMIT_IP_MAX`, `GOOGLE_MAPS_API_KEY`, `AFTER_DARK_ALWAYS_OPEN`

**Admin dashboard:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`

**Mobile apps:** `EXPO_PUBLIC_API_URL`

## Deploy

The backend and admin dashboard deploy on **Render from the `main` branch** using the `render.yaml` Blueprint (Postgres database + `hostelbites-backend` + `hostelbites-admin`). Pushing to `main` redeploys.

- Each service's root directory is its folder (`backend`, `admin-dashboard`). Do not deploy the repo root.
- All secrets are set as Render environment variables, never in the repo.
- Anything the server needs must be required from `server.js` (or `scripts/` it calls), because Render runs only `npm start`.

The mobile apps are not Render services. They ship as APKs (see below).

## Building APKs

Local release build (Android SDK required):

```bash
cd <app-folder>
npx expo prebuild --platform android   # only if android/ is missing or stale
cd android && ./gradlew assembleRelease
# output: android/app/build/outputs/apk/release/app-release.apk
```

Cloud build with EAS (customer app has `eas.json`; run `npx eas-cli@latest init` once per app before its first build):

```bash
cd customer-mobile
npm run build:preview      # internal APK
npm run build:prod         # Play Store app bundle
```

APKs, build folders, `.env*` files, SQLite databases, uploads, logs and scratch files are git-ignored. Do not commit them.
