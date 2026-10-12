# Zenvy Rider (delivery partner app)

Expo (SDK 57) app for Zenvy delivery riders. Talks only to the one Zenvy backend
(`https://hostelbites-backend-jwmt.onrender.com/api`, rider routes under `/api/delivery/*`).

## What a rider sees
- **Home**: big ONLINE / OFFLINE duty switch, today's earnings / orders / cash in hand, active deliveries,
  incoming order card with a 30 s countdown (Accept / Skip), more available orders.
- **Delivery**: one screen per order with step progress Pickup → Picked → Drop → PIN → Done,
  Navigate (Google Maps two-wheeler) and Call buttons, item checklist at the store, huge COD amount,
  big PIN pad, "Can't do this order" and help in the ⋮ menu.
- **Earnings**: today / last 7 days, day-by-day bars, per-order list.
- **History**, **Profile** (vehicle, emergency contact, documents status, password, 112), **Help** (tickets, call, WhatsApp),
  **Voice** settings.

## Voice announcements (PhonePe soundbox style)
`src/voice/` — chime (vibration + system notification sound) then a spoken phrase via `expo-speech`.
Telugu by default, falling back to Hindi then English when the phone has no Telugu voice.
Announcements are queued (never overlap), de-duplicated per order/event, and stale ones are dropped.
Customer phone numbers / addresses are never spoken.

## Code map
```
App.tsx                 root switch: Splash → Login → Pending approval → Shell
src/config.ts           API URL, storage keys, intervals
src/theme.ts            colours, type scale, spacing, insets
src/types.ts            domain types
src/services/           apiClient, deliveryApi, orderModel, offlineQueue, session, socket, location, notifications, links, format
src/state/RiderStore.tsx  all rider state + actions (duty, orders, earnings, queue, socket, GPS, push, voice cues)
src/state/hooks.ts      app-active, network, interval, dismissed offers
src/voice/              phrases (te/hi/en), announcer (queue + dedupe + fallback), useVoice
src/ui/                 kit (Btn, Card, Row, Badge, Banner, …), Sheet, PinPad, Toast
src/screens/            Auth, Shell, Home, Delivery, Earnings, History, Profile, Support, VoiceSettings, parts
```

## Checks
```bash
npx tsc --noEmit
npx expo export --platform android
```
