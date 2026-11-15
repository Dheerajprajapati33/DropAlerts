# FallAlert Android Backend

Node.js + Express + MongoDB starter backend, based on the supplied UI and architecture image. Android-only. Includes JWT auth, Google ID-token verification, device registration, QR/code pairing, fall events, FCM push, history, settings, and in-app notifications.

## Requirements
- Node.js 20+
- MongoDB local or Atlas
- Firebase project with Cloud Messaging enabled for actual push delivery

## Run (Windows PowerShell)
```powershell
cd fallalert-backend
npm install
Copy-Item .env.example .env
# edit .env with MongoDB URI and a strong random JWT_SECRET
npm run dev
```
Test: `http://localhost:5000/api/v1/health`.
Android emulator uses `http://10.0.2.2:5000/api/v1`; physical phone uses your computer's LAN IP, or HTTPS hosted API.

## Firebase
Put Firebase Admin service-account fields in server `.env` (never in mobile app). For multiline private key set FIREBASE_PRIVATE_KEY with literal `\n` characters. Create Android notification channel `fall_alerts` and bundle sound resource `fall_alert` in React Native native Android setup. Request Android 13+ notification permission. FCM must be enabled, and the target phone must have network access.

## Security and limitations
- Pair codes expire after 10 minutes and are one-use. They authorize connection to the displayed device; share only with trusted people. The initial starter allows pairing without remote confirmation; **add a remote approval handshake before production**.
- No guarantee of instant delivery: Doze, permissions, network, device vendor policies and FCM can delay or block pushes. Safety-critical emergency use requires substantial testing and fallback channels.
- JWT logout is client-side token removal; add refresh tokens/revocation for production.
- Server trusts authenticated client fall events; add device attestation, anomaly checks, per-device rate limits and event cooldown before production.
- A cancelled alert is stored but currently does not issue a separate cancellation push.
- No SOS escalation, contacts/SMS, geolocation, or medical-grade fall verification in this starter.
- Store minimal user data, define retention/deletion policies, and deploy over HTTPS.

Full endpoint docs: `docs/API_DOCUMENTATION.md`.
