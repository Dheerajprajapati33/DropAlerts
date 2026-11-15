# FallAlert Backend API Documentation

## 1. Overview
**Stack:** Node.js 20+, Express, MongoDB/Mongoose, JWT, bcrypt, Firebase Admin FCM, Google ID-token verification.
**Scope:** Android only.
**Base URLs:** Both `http://<host>:<port>/api/v1` and `http://<host>:<port>/api` are supported identically (e.g., `http://10.0.2.2:5000/api` for Android emulator).

### Architecture
- **Paired Alerts:** `Android sensors → on-device fall-detection algorithm → POST /falls/report or POST /alerts → MongoDB → find active paired devices → Firebase FCM → paired Android notification + sound`
- **100m Bystander Mesh (No Pairing Needed):** `App start → POST /nearby/location (GeoJSON 2dsphere) → POST /nearby/broadcast → $nearSphere <= 100m → Firebase FCM (type: NEARBY_SOS)`

## 2. API Inventory
All endpoints except `/health`, `/auth/register`, `/auth/login`, `/auth/google`, `/auth/forgot-password`, `/auth/reset-password`, `/notifications/token` (`optionalAuth`), and `/nearby/*` (`optionalAuth`) require header `Authorization: Bearer <JWT>`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/auth/register` | Create account (`name`, `email`, `password`, optional `phone`) |
| POST | `/auth/login` | Login via `identifier` (email or phone) or `email` + `password` |
| POST | `/auth/google` | Verify Google ID token, sign in |
| POST | `/auth/forgot-password` | Generate 6-digit password reset OTP |
| POST | `/auth/reset-password` | Reset password with OTP |
| POST | `/auth/logout` | Logout current session |
| GET | `/auth/me` | Get current user profile |
| PUT / PATCH | `/auth/me` | Update profile (`name`, `email`, `phone`, `avatar`, `emergencyContacts`) |
| DELETE | `/auth/me` | Permanently delete account and associated data |
| POST | `/devices` | Register/update current Android device & FCM token |
| GET | `/devices/self` | Get or auto-provision current device record (using `x-device-id`) |
| GET | `/devices` | List connected/paired devices (excludes current `x-device-id` unless `?includeSelf=true`) |
| POST | `/devices/pair-code` | Generate 6-digit pairing code + QR payload (`qrPayload`) |
| POST | `/devices/pair` | Redeem 6-digit `pairingCode` or `qrPayload` to link two devices via `Pairing` |
| GET | `/devices/:id` | Device details (own or actively paired) |
| PATCH | `/devices/:id` | Update own device details |
| DELETE | `/devices/:id` | Unpair remote device or delete own secondary device |
| POST | `/devices/:id/ping` | Ping device connectivity and update heartbeat |
| PATCH | `/devices/:id/fcm-token` | Refresh device FCM token |
| PATCH | `/devices/:id/settings` | Update `sensitivity` (`low`/`medium`/`high`), `notifications`, `sound`, `vibration` |
| GET | `/devices/:id/paired` | List devices paired to `:id` |
| POST | `/pairings/code` | Legacy 8-digit pair code creation |
| POST | `/pairings/connect` | Legacy 8-digit pair code redemption |
| DELETE | `/pairings/:id` | Legacy unpair by pairing ID |
| POST | `/falls/report` | Report fall event + create Alert + push FCM to paired devices |
| GET | `/falls/history` | Get user's fall history |
| POST | `/falls/:id/cancel` | Cancel false alarm + push `FALL_CANCELLED` to paired devices |
| POST | `/falls/:id/acknowledge` | Acknowledge fall event |
| POST | `/alerts` | Submit idempotent fall alert by `eventId` |
| POST | `/alerts/trigger` | Trigger manual Emergency SOS alert to paired devices |
| GET | `/alerts` | List alerts (supports `page`, `limit`, `type`, `severity`, `status`) |
| GET | `/alerts/:id` | Get alert detail |
| POST | `/alerts/:id/dismiss` | Dismiss/resolve alert |
| PATCH | `/alerts/:id/cancel` | Cancel alert + notify paired devices |
| GET | `/alerts/contacts` | List emergency contacts |
| POST | `/alerts/contacts` | Add emergency contact |
| PATCH | `/alerts/contacts/:id` | Update emergency contact |
| DELETE | `/alerts/contacts/:id` | Delete emergency contact |
| POST | `/notifications/token` | Register/sync FCM token (`optionalAuth`) |
| GET | `/notifications` | Get in-app notification inbox |
| PATCH | `/notifications/read-all` | Mark all notifications as read |
| PATCH | `/notifications/:id/read` | Mark single notification as read |
| POST | `/nearby/location` | Sync GPS coordinates + FCM token to 100m bystander mesh |
| POST | `/nearby/broadcast` | Broadcast `NEARBY_SOS` FCM push to active devices within radius (default 100m) |
| GET | `/nearby/active-count` | Count active devices in mesh / radius |
