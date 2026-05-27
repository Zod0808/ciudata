# CIUDATA

Aplicación móvil Android para monitoreo ambiental y de calidad del aire en la ciudad de Tacna, Perú. Desarrollada como prototipo universitario para el Hackathon 2026 — Reto 2: Transporte y Tránsito · Equipo CIUDATA · Universidad Privada de Tacna.

---

## Qué puede hacer

### Mapa de calidad del aire
- Muestra un mapa interactivo de Tacna con nodos sensores distribuidos por la ciudad.
- Cada nodo indica su estado de contaminación (OK / Advertencia / Crítico) con marcadores de color.
- Al tocar un nodo se abre un modal con sus métricas individuales (PM2.5, CO₂, temperatura).
- La posición del usuario se puede activar con el botón GPS del header.

### Panel de métricas en tiempo real
- Tarjetas deslizables con valores actuales de:
  - **PM2.5** (µg/m³) — partículas finas
  - **CO₂** (ppm) — dióxido de carbono
  - **UV** — índice ultravioleta
  - **Ozono** (µg/m³)
  - **Temperatura** (°C)
- Cada métrica incluye una sparkline animada y su estado (Bueno / Moderado / Elevado / Crítico).
- Banner de alerta parpadeante cuando algún valor supera el límite ECA-Aire peruano.

### Estadísticas y gráfico en vivo
- Gráfico de barras de PM2.5 con streaming simulado, línea límite ECA (25 µg/m³) y badge "STREAMING".
- Contador de nodos activos, zonas críticas, encuestados y tasa de adopción proyectada.
- Resultados clave de la encuesta ciudadana: 76.6 % evita zonas contaminadas, 95.6 % usaría el mapa.

### Encuesta ciudadana
- Flujo de 5 preguntas con barra de progreso.
- Respuestas guardadas en localStorage (persisten entre sesiones).
- Botón de reinicio para repetir la encuesta.

### Perfil y gamificación
- Puntaje acumulado del usuario.
- Logros desbloqueables (Primer mapa, Encuestador, Vigilante, etc.).
- Menú de configuración (notificaciones, idioma, exportar datos, acerca de).

### Escenarios de tráfico
- Badge "HORA PUNTA · 07:00" que rota entre escenarios simulados al tocarlo, actualizando los valores de todos los nodos.

---

## Cómo funciona

La app es una **SPA (Single Page Application)** contenida en un único archivo `www/index.html` (HTML + CSS + JS inline) que Capacitor envuelve como una aplicación Android nativa.

```
Usuario toca la app
       │
       ▼
Splash screen animado (1.8 s)
       │
       ▼
4 pestañas de navegación (Bottom Nav)
  ├── Mapa       → Leaflet.js + nodos simulados + GPS real (Capacitor Geolocation)
  ├── Stats      → Gráfico streaming + encuesta ciudadana
  ├── Encuesta   → 5 preguntas → localStorage
  └── Perfil     → Puntos + logros + settings
       │
       ▼
Datos: simulados en JS (sin backend real)
Persistencia: localStorage via Capacitor Preferences
```

Los datos de los sensores son **simulados mediante JavaScript** con variaciones aleatorias — no existe un backend ni API externa en este MVP.

---

## Tecnologías

| Capa | Tecnología | Versión |
|------|------------|---------|
| Framework móvil | Capacitor | 6.0.0 |
| Plataforma nativa | Android | API 22–34 |
| Mapa interactivo | Leaflet.js | 1.9.4 |
| Tipografías | Google Fonts (Space Mono, Syne) | — |
| Lenguaje app | HTML5 / CSS3 / JavaScript (vanilla) | — |
| Lenguaje Android | Java 17 | — |
| Build system | Gradle | 8.2.2 |
| Kotlin (plugins) | Kotlin | 1.9.10 |
| Plugins Capacitor | Geolocation, Preferences, Network, SplashScreen, StatusBar, Camera, Haptics, PushNotifications | 6.x |
| Push Notifications | Firebase Cloud Messaging *(configuración pendiente)* | — |

---

## Requisitos previos

- **Node.js** 18 o superior
- **Android Studio** Hedgehog 2023.1.1 o superior
- **JDK 17**
- **Android SDK** API 34

---

## Instalación y uso

### 1. Instalar dependencias

```bash
cd ciudata-app
npm install
```

### 2. Sincronizar con Android

```bash
npx cap add android      # solo la primera vez
npx cap sync android
```

### 3. Abrir en Android Studio

```bash
npx cap open android
```

O abre Android Studio manualmente y selecciona la carpeta `android/`.

### 4. Generar APK de prueba (debug)

En Android Studio:
```
Build → Build Bundle(s)/APK(s) → Build APK(s)
```

El APK de salida se encuentra en:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### 5. Instalar en dispositivo

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Generar APK de producción (release)

### Crear keystore (solo una vez)

```bash
keytool -genkey -v \
  -keystore ciudata-release.jks \
  -alias ciudata \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### Configurar variables de entorno

```bash
export CIUDATA_STORE_FILE=ciudata-release.jks
export CIUDATA_STORE_PASSWORD=tu_password
export CIUDATA_KEY_ALIAS=ciudata
export CIUDATA_KEY_PASSWORD=tu_key_password
```

### Compilar

```bash
cd android
./gradlew assembleRelease     # APK
./gradlew bundleRelease       # AAB para Google Play
```

---

## Estructura del proyecto

```
ciudata-app/
├── www/
│   └── index.html            ← App completa (HTML + CSS + JS)
├── android/
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/ciudata/app/MainActivity.java
│   │   │   ├── res/
│   │   │   │   ├── mipmap-*/     ← Íconos en todas las densidades
│   │   │   │   ├── drawable/     ← Splash screen
│   │   │   │   ├── values/       ← Colores, strings, estilos
│   │   │   │   └── xml/          ← Seguridad de red y file provider
│   │   │   └── AndroidManifest.xml
│   │   ├── build.gradle
│   │   └── proguard-rules.pro
│   ├── build.gradle
│   ├── settings.gradle
│   └── gradle.properties
├── capacitor.config.json
├── package.json
└── INSTRUCCIONES.md
```

---

## Permisos Android

| Permiso | Uso |
|---------|-----|
| `ACCESS_FINE_LOCATION` | GPS en tiempo real |
| `ACCESS_COARSE_LOCATION` | Ubicación aproximada |
| `INTERNET` | Carga del mapa Leaflet |
| `POST_NOTIFICATIONS` | Alertas de contaminación |
| `VIBRATE` | Feedback táctil |
| `CAMERA` | Uso futuro |
| `READ/WRITE_EXTERNAL_STORAGE` | Modo offline (≤ API 28) |

---

## Información de la app

| Campo | Valor |
|-------|-------|
| Package ID | `com.ciudata.app` |
| Versión | 1.0.0 (versionCode 1) |
| Android mínimo | 5.1 (API 22) |
| Android objetivo | 14 (API 34) |
| Categoría | Herramientas / Medio Ambiente |

---

## Pendiente para versión completa

- Conectar a API real con datos de sensores IoT
- Autenticación de usuario
- Activar Firebase Cloud Messaging (push notifications)
- Tests automatizados
- Base de datos en la nube

---

## Equipo

Equipo CIUDATA · Universidad Privada de Tacna · Hackathon 2026
