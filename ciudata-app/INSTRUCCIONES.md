# 🚀 CIUDATA — Guía para generar el APK

## Requisitos previos
- Android Studio Hedgehog 2023.1.1 o superior
- JDK 17
- Android SDK API 34
- Node.js 18+

---

## PASO 1 — Instalar dependencias de Capacitor

```bash
cd ciudata-app
npm install
```

---

## PASO 2 — Agregar plataforma Android y sincronizar

```bash
npx cap add android
npx cap sync android
```

---

## PASO 3 — Abrir en Android Studio

```bash
npx cap open android
```

O abre Android Studio manualmente y selecciona la carpeta `android/`

---

## PASO 4 — Generar APK Debug (para pruebas)

En Android Studio:
```
Build → Build Bundle(s)/APK(s) → Build APK(s)
```

El APK estará en:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## PASO 5 — Generar APK Release (para Play Store)

### 5a. Crear keystore (solo primera vez)
```bash
keytool -genkey -v \
  -keystore ciudata-release.jks \
  -alias ciudata \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### 5b. Configurar variables de entorno
```bash
export CIUDATA_STORE_FILE=ciudata-release.jks
export CIUDATA_STORE_PASSWORD=tu_password
export CIUDATA_KEY_ALIAS=ciudata
export CIUDATA_KEY_PASSWORD=tu_key_password
```

### 5c. Build release
En Android Studio:
```
Build → Generate Signed Bundle/APK
→ Seleccionar APK
→ Seleccionar keystore ciudata-release.jks
→ Build Variant: release
```

O por terminal:
```bash
cd android
./gradlew assembleRelease
```

El APK firmado estará en:
```
android/app/build/outputs/apk/release/app-release.apk
```

### Para Google Play Store (AAB):
```bash
cd android
./gradlew bundleRelease
```
Archivo AAB en:
```
android/app/build/outputs/bundle/release/app-release.aab
```

---

## PASO 6 — Instalar en dispositivo para pruebas

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

O activar "Depuración USB" en el teléfono y:
```
Run → Run 'app' en Android Studio
```

---

## Estructura del proyecto

```
ciudata-app/
├── www/
│   └── index.html          ← App HTML premium completa
├── android/
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/ciudata/app/
│   │   │   │   └── MainActivity.java
│   │   │   ├── res/
│   │   │   │   ├── mipmap-*/     ← Íconos en todas las densidades
│   │   │   │   ├── drawable/     ← Splash screen
│   │   │   │   ├── values/       ← Colores, strings, estilos
│   │   │   │   └── xml/          ← Seguridad y file provider
│   │   │   └── AndroidManifest.xml
│   │   ├── build.gradle
│   │   └── proguard-rules.pro
│   ├── build.gradle
│   ├── settings.gradle
│   └── gradle.properties
├── capacitor.config.json
└── package.json
```

---

## Configuración Play Store

| Campo | Valor |
|-------|-------|
| Package ID | com.ciudata.app |
| Versión | 1.0.0 (versionCode: 1) |
| Min Android | 5.1 (API 22) |
| Target Android | 14 (API 34) |
| Categoría | Herramientas / Medio Ambiente |

---

## Permisos configurados

- ✅ GPS y ubicación (tiempo real)
- ✅ Internet y red
- ✅ Vibración táctil
- ✅ Notificaciones push
- ✅ Cámara (futura)
- ✅ Almacenamiento (modo offline)

---

## Para agregar Firebase (Push Notifications reales)

1. Crear proyecto en [console.firebase.google.com](https://console.firebase.google.com)
2. Agregar app Android con package `com.ciudata.app`
3. Descargar `google-services.json` → carpeta `android/app/`
4. Descomentar líneas de Firebase en `build.gradle`

---

## Soporte

Proyecto desarrollado para Hackathon 2026 — Reto 2: Transporte y Tránsito
Equipo CIUDATA · Universidad Privada de Tacna
