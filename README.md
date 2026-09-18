# CIUDATA — Smart Environmental Monitoring for Tacna

Android app and REST backend for real-time environmental and traffic monitoring in Tacna, Peru. CIUDATA ships an interactive air-quality map, a live metrics dashboard, and a citizen survey with gamification. Prototype for Hackathon 2026 — Challenge 2: Transport & Traffic · Team CIUDATA · Universidad Privada de Tacna.

![Capacitor](https://img.shields.io/badge/Capacitor-6.0-119EFF?logo=capacitor&logoColor=white)
![Android](https://img.shields.io/badge/Android-API%2022--34-3DDC84?logo=android&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.19-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white)
![Render](https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Screenshots

<p align="center">
  <img src="docs/screenshot-map.png" alt="Air quality map with live sensor nodes" width="320" />
  &nbsp;&nbsp;
  <img src="docs/screenshot-dashboard.png" alt="Metrics dashboard with PM2.5 streaming chart" width="320" />
</p>

---

## The Problem

Tacna lacks accessible, real-time environmental data. Official measurements are sparse, delayed, and hard to interpret for citizens. CIUDATA delivers a clean visualization layer over currently-simulated data — ready to plug into real sensors — plus a backend with gamification that incentivizes citizen participation.

---

## Architecture

```
┌──────────────────────┐        ┌────────────────────────┐        ┌──────────────────┐
│  ciudata-app         │  HTTPS │  ciudata-api           │   SQL  │  Supabase        │
│  Capacitor Android   │ ─────► │  Node.js + Express     │ ─────► │  Postgres        │
│  SPA (HTML + Leaflet)│  REST  │  rate-limit · JWT · FCM│        │  (schema in      │
│  simulated JS data   │        │  cron jobs (scheduler) │        │   supabase/)     │
└──────────────────────┘        └───────────┬────────────┘        └──────────────────┘
                                            │
                                            ▼
                                 ┌───────────────────────┐
                                 │  ciudata-web          │
                                 │  Landing / sponsor    │
                                 │  QR validation        │
                                 └───────────────────────┘
```

- **ciudata-app** — Single-file SPA (`www/index.html`) wrapped by Capacitor 6 as a native Android app. Sensor data is simulated in JS today; the app already uses real geolocation via `@capacitor/geolocation`.
- **ciudata-api** — Node/Express REST API deployed on Render. Endpoints for auth, survey, points, ranking, routing, QR, sponsors, referrals, domes, onboarding, and reporting. Cron jobs for cycle open/close, ranking, notifications, and QR generation.
- **supabase** — Canonical Postgres schema (`schema.sql` + `seed.sql`) plus incremental migrations under `ciudata-api/migrations/`.
- **ciudata-web** — Static site for sponsor QR validation.

---

## Features

- Interactive Tacna map with sensor nodes (Leaflet + OpenStreetMap) and per-node modal with PM2.5, CO₂, and temperature.
- Metrics panel: PM2.5, CO₂, UV, ozone, and temperature — each with sparkline and status against the Peruvian ECA-Aire thresholds.
- Live PM2.5 streaming chart with ECA limit line (25 µg/m³) and live badge.
- Rotating traffic scenarios (rush hour, night, etc.) that refresh every value across the app.
- 5-question citizen survey persisted to `localStorage` (Capacitor Preferences).
- Profile with points, unlockable achievements, and settings.
- Backend with rate limiting (60 req/min per IP), JWT auth, sponsors, referrals, ranking, and cron jobs.
- Push notifications wired for Firebase Cloud Messaging (`firebase-admin`).

---

## Tech Stack

| Layer              | Technology                                                        |
|--------------------|-------------------------------------------------------------------|
| Mobile app         | Capacitor 6 (Android API 22–34), vanilla HTML/CSS/JS, Leaflet 1.9 |
| Capacitor plugins  | Geolocation, Preferences, Network, SplashScreen, StatusBar, Camera, Haptics, PushNotifications |
| Backend / API      | Node.js 18+, Express 4.19, express-rate-limit, bcryptjs, dotenv   |
| Database           | PostgreSQL (Supabase)                                             |
| Scheduler          | node-cron (jobs in `ciudata-api/src/jobs/`)                       |
| Notifications      | Firebase Admin (FCM)                                              |
| Static web         | Plain HTML (`ciudata-web/`)                                       |
| Android build      | Gradle 8.2.2, Java 17, Kotlin 1.9.10                              |
| Backend deploy     | Render (see `ciudata-api/render.yaml`)                            |
| Containers         | Docker + docker-compose (`ciudata-api/`)                          |

---

## Monorepo Layout

```
ciudata/
├── ciudata-app/          # Android app (Capacitor + Leaflet SPA)
│   ├── www/index.html    # Full SPA (HTML + CSS + JS)
│   ├── android/          # Native Android project
│   ├── capacitor.config.json
│   └── package.json
├── ciudata-api/          # REST backend (Node.js + Express)
│   ├── src/
│   │   ├── app.js
│   │   ├── db.js
│   │   ├── scheduler.js
│   │   ├── routes/       # auth, encuesta, puntos, ranking, ruta, qr, sponsor, ...
│   │   ├── jobs/         # ranking, ciclo-apertura, cierre, notificaciones, qr, ...
│   │   ├── services/     # fcm, otp
│   │   └── middleware/
│   ├── migrations/       # 002_..., 003_..., 004_...
│   ├── schema.sql
│   ├── render.yaml
│   ├── Dockerfile
│   └── docker-compose.yml
├── ciudata-web/          # Sponsor landing / QR validation
│   ├── index.html
│   └── sponsor/validar.html
└── supabase/             # Canonical Postgres schema
    ├── schema.sql
    └── seed.sql
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Android Studio Hedgehog (2023.1.1) or newer · JDK 17 · Android SDK API 34 — only needed to build the app
- A PostgreSQL instance (Supabase or local via Docker)

### 1. Clone

```bash
git clone https://github.com/Zod0808/ciudata.git
cd ciudata
```

### 2. Backend (`ciudata-api`)

```bash
cd ciudata-api
npm install
cp .env.example .env             # fill in DATABASE_URL, JWT_SECRET, ...
npm run db:migrate               # applies schema.sql
npm run db:migrate:002           # incremental migrations
npm run db:migrate:003
npm run db:migrate:004
npm run dev                      # nodemon
# or run API + scheduler together:
npm run dev:all
```

API served at `http://localhost:3000` — health check at `GET /health`.

Docker alternative:

```bash
cd ciudata-api
npm run docker:up
```

### 3. Mobile app (`ciudata-app`)

```bash
cd ciudata-app
npm install
npx cap add android              # first time only
npx cap sync android
npx cap open android             # opens Android Studio
```

Build debug APK:

```
Build → Build Bundle(s)/APK(s) → Build APK(s)
# output: android/app/build/outputs/apk/debug/app-debug.apk
```

Signed release APK: see [`ciudata-app/README.md`](ciudata-app/README.md) for the keystore workflow.

### 4. Static web (`ciudata-web`)

Serve the folder with any static server:

```bash
cd ciudata-web
npx serve .
```

---

## Environment Variables

Backend (`ciudata-api/.env`):

```env
DATABASE_URL=postgresql://user:pass@host:5432/ciudata
DB_SSL=true                      # required for Supabase
JWT_SECRET=change_me
DOMO_WEBHOOK_SECRET=change_me
ADMIN_KEY=change_me
PORT=3000
NODE_ENV=development
```

> Never commit a `.env` with real values. Verify it stays in `.gitignore`.

---

## Main Endpoints

| Route           | Description                                       |
|-----------------|---------------------------------------------------|
| `GET /health`   | Health check with a Postgres ping                 |
| `/auth`         | Signup, login, and OTP                            |
| `/encuesta`     | Citizen survey and responses                      |
| `/puntos`       | Gamification — points per action                  |
| `/ranking`      | Per-cycle ranking (job `ranking.js`)              |
| `/ruta`         | Route recommendation based on air quality         |
| `/qr`           | QR generation and redemption                      |
| `/sponsor`      | Sponsors and validation                           |
| `/referidos`    | Referral program                                  |
| `/domos`        | Dome webhooks (`DOMO_WEBHOOK_SECRET`)             |
| `/onboarding`   | User onboarding flow                              |
| `/reporte`      | Sponsor reporting                                 |

Cron jobs exposed via npm scripts: `ranking`, `apertura`, `encuesta`, `cierre`, `final`, `qr`, `notif`, `reporte`.

---

## Roadmap

- [ ] Replace simulated data with real sensor telemetry
- [ ] Enable Firebase Cloud Messaging end-to-end
- [ ] Historical export to CSV
- [ ] Automated tests (backend + app smoke tests)
- [ ] Google Play release (signed AAB)

---

## Team

Team CIUDATA — Universidad Privada de Tacna · Hackathon 2026 (Challenge 2: Transport & Traffic).

---

## License

MIT — see [LICENSE](LICENSE).
