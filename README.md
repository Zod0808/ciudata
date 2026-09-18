# CIUDATA — Smart Environmental Monitoring for Tacna

Aplicación móvil Android y backend REST para monitoreo ambiental-vial en la ciudad de Tacna, Perú. CIUDATA muestra un mapa interactivo de calidad del aire, un panel de métricas en tiempo real y una encuesta ciudadana con gamificación. Prototipo del Hackathon 2026 — Reto 2: Transporte y Tránsito · Equipo CIUDATA · Universidad Privada de Tacna.

![Capacitor](https://img.shields.io/badge/Capacitor-6.0-119EFF?logo=capacitor&logoColor=white)
![Android](https://img.shields.io/badge/Android-API%2022--34-3DDC84?logo=android&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.19-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white)
![Render](https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Problema

Tacna carece de datos ambientales accesibles y en tiempo real. Las mediciones oficiales son escasas, tardías y difíciles de interpretar para el ciudadano. CIUDATA propone una capa de visualización clara sobre datos simulados —listos para conectarse a sensores reales— y un backend con gamificación que incentiva la participación ciudadana.

---

## Arquitectura

```
┌──────────────────────┐        ┌────────────────────────┐        ┌──────────────────┐
│  ciudata-app         │  HTTPS │  ciudata-api           │   SQL  │  Supabase        │
│  Capacitor Android   │ ─────► │  Node.js + Express     │ ─────► │  Postgres        │
│  SPA (HTML + Leaflet)│  REST  │  rate-limit · JWT · FCM│        │  (esquema en    │
│  datos simulados JS  │        │  cron jobs (scheduler) │        │   supabase/)     │
└──────────────────────┘        └───────────┬────────────┘        └──────────────────┘
                                            │
                                            ▼
                                 ┌───────────────────────┐
                                 │  ciudata-web          │
                                 │  Landing / validación │
                                 │  QR de sponsors       │
                                 └───────────────────────┘
```

- **ciudata-app** — SPA de un solo archivo (`www/index.html`) envuelto por Capacitor 6 como app Android nativa. Los datos de sensores son simulados en JS; la app ya consume geolocalización real vía `@capacitor/geolocation`.
- **ciudata-api** — REST API en Node/Express desplegada en Render. Endpoints para auth, encuesta, puntos, ranking, ruta, QR, sponsors, referidos, domos, onboarding y reporte. Jobs cron para apertura/cierre de ciclos, ranking, notificaciones y generación de QR.
- **supabase** — Esquema Postgres (`schema.sql` + `seed.sql`) más migraciones incrementales en `ciudata-api/migrations/`.
- **ciudata-web** — Página estática de validación de sponsors por QR.

---

## Features

- Mapa interactivo de Tacna con nodos sensores (Leaflet + OpenStreetMap) y modal por nodo con PM2.5, CO₂ y temperatura.
- Panel de métricas: PM2.5, CO₂, UV, ozono y temperatura, cada una con sparkline y estado según ECA-Aire peruano.
- Gráfico streaming de PM2.5 con línea límite ECA (25 µg/m³) y badge en vivo.
- Escenarios de tráfico rotativos (hora punta, madrugada, etc.) que actualizan los valores en toda la app.
- Encuesta ciudadana de 5 preguntas persistida en `localStorage` (Capacitor Preferences).
- Perfil con puntos, logros desbloqueables y configuración.
- Backend con rate limiting (60 req/min por IP), auth JWT, sponsors, referidos, ranking y jobs cron.
- Push notifications preparadas vía Firebase Cloud Messaging (`firebase-admin`).

---

## Tech Stack

| Capa               | Tecnología                                                        |
|--------------------|-------------------------------------------------------------------|
| App móvil          | Capacitor 6 (Android API 22–34), HTML/CSS/JS vanilla, Leaflet 1.9 |
| Plugins Capacitor  | Geolocation, Preferences, Network, SplashScreen, StatusBar, Camera, Haptics, PushNotifications |
| Backend / API      | Node.js 18+, Express 4.19, express-rate-limit, bcryptjs, dotenv   |
| Base de datos      | PostgreSQL (Supabase)                                             |
| Scheduler          | node-cron (jobs en `ciudata-api/src/jobs/`)                       |
| Notificaciones     | Firebase Admin (FCM)                                              |
| Web estática       | HTML puro (`ciudata-web/`)                                        |
| Build Android      | Gradle 8.2.2, Java 17, Kotlin 1.9.10                              |
| Deploy backend     | Render (ver `ciudata-api/render.yaml`)                            |
| Contenedores       | Docker + docker-compose (`ciudata-api/`)                          |

---

## Estructura del monorepo

```
ciudata/
├── ciudata-app/          # App Android (Capacitor + Leaflet SPA)
│   ├── www/index.html    # SPA completa (HTML + CSS + JS)
│   ├── android/          # Proyecto nativo Android
│   ├── capacitor.config.json
│   └── package.json
├── ciudata-api/          # Backend REST (Node.js + Express)
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
├── ciudata-web/          # Landing / validación de sponsors
│   ├── index.html
│   └── sponsor/validar.html
└── supabase/             # Esquema Postgres canónico
    ├── schema.sql
    └── seed.sql
```

---

## Getting Started

### Prerequisitos

- Node.js 18+
- Android Studio Hedgehog (2023.1.1) o superior · JDK 17 · Android SDK API 34 — solo para compilar la app
- Instancia PostgreSQL (Supabase o local vía Docker)

### 1. Clonar

```bash
git clone https://github.com/Zod0808/ciudata.git
cd ciudata
```

### 2. Backend (`ciudata-api`)

```bash
cd ciudata-api
npm install
cp .env.example .env             # rellena DATABASE_URL, JWT_SECRET, etc.
npm run db:migrate               # aplica schema.sql
npm run db:migrate:002           # migraciones incrementales
npm run db:migrate:003
npm run db:migrate:004
npm run dev                      # nodemon
# o levanta API + scheduler juntos:
npm run dev:all
```

API en `http://localhost:3000` — health-check en `GET /health`.

Alternativa con Docker:

```bash
cd ciudata-api
npm run docker:up
```

### 3. App móvil (`ciudata-app`)

```bash
cd ciudata-app
npm install
npx cap add android              # solo la primera vez
npx cap sync android
npx cap open android             # abre Android Studio
```

Generar APK debug:

```
Build → Build Bundle(s)/APK(s) → Build APK(s)
# salida: android/app/build/outputs/apk/debug/app-debug.apk
```

APK release firmado: ver [`ciudata-app/README.md`](ciudata-app/README.md) para el proceso con keystore.

### 4. Web estática (`ciudata-web`)

Sirve la carpeta con cualquier servidor estático:

```bash
cd ciudata-web
npx serve .
```

---

## Variables de entorno

Backend (`ciudata-api/.env`):

```env
DATABASE_URL=postgresql://user:pass@host:5432/ciudata
DB_SSL=true                      # requerido para Supabase
JWT_SECRET=change_me
DOMO_WEBHOOK_SECRET=change_me
ADMIN_KEY=change_me
PORT=3000
NODE_ENV=development
```

> Nunca commitees `.env` con valores reales. Verifica que esté en `.gitignore`.

---

## Endpoints principales

| Ruta            | Descripción                                       |
|-----------------|---------------------------------------------------|
| `GET /health`   | Health-check con ping a Postgres                  |
| `/auth`         | Registro, login y OTP                             |
| `/encuesta`     | Encuesta ciudadana y respuestas                   |
| `/puntos`       | Gamificación — puntos por acción                  |
| `/ranking`      | Ranking por ciclo (job `ranking.js`)              |
| `/ruta`         | Recomendación de ruta según calidad del aire      |
| `/qr`           | Generación y canje de QR                          |
| `/sponsor`      | Sponsors y validación                             |
| `/referidos`    | Programa de referidos                             |
| `/domos`        | Webhooks de domos (`DOMO_WEBHOOK_SECRET`)         |
| `/onboarding`   | Flujo inicial de usuario                          |
| `/reporte`      | Reporte para sponsors                             |

Cron jobs disponibles vía npm: `ranking`, `apertura`, `encuesta`, `cierre`, `final`, `qr`, `notif`, `reporte`.

---

## Roadmap

- [ ] Reemplazar datos simulados por telemetría real de sensores
- [ ] Activar Firebase Cloud Messaging end-to-end
- [ ] Exportación histórica en CSV
- [ ] Tests automatizados (backend + smoke tests app)
- [ ] Publicación en Google Play (AAB firmado)

---

## Equipo

Equipo CIUDATA — Universidad Privada de Tacna · Hackathon 2026 (Reto 2: Transporte y Tránsito).

---

## Licencia

MIT — ver [LICENSE](LICENSE).
