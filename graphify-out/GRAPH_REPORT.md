# Graph Report - .  (2026-05-27)

## Corpus Check
- Corpus is ~22,674 words - fits in a single context window. You may not need a graph.

## Summary
- 178 nodes · 225 edges · 23 communities (21 shown, 2 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.9)
- Token cost: 3,200 input · 1,800 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Android Build & Config Pipeline|Android Build & Config Pipeline]]
- [[_COMMUNITY_CIUDATA App Features|CIUDATA App Features]]
- [[_COMMUNITY_Package Metadata & Dependencies|Package Metadata & Dependencies]]
- [[_COMMUNITY_App Icon Assets & Brand|App Icon Assets & Brand]]
- [[_COMMUNITY_Capacitor Plugin Registry|Capacitor Plugin Registry]]
- [[_COMMUNITY_Capacitor Plugin Config (Assets)|Capacitor Plugin Config (Assets)]]
- [[_COMMUNITY_Capacitor Config Settings|Capacitor Config Settings]]
- [[_COMMUNITY_Capacitor Android Config|Capacitor Android Config]]
- [[_COMMUNITY_NPM Dependencies|NPM Dependencies]]
- [[_COMMUNITY_Project Docs & Context|Project Docs & Context]]
- [[_COMMUNITY_Android MainActivity|Android MainActivity]]
- [[_COMMUNITY_Splash Screen Design|Splash Screen Design]]
- [[_COMMUNITY_App Icon SVG Source|App Icon SVG Source]]
- [[_COMMUNITY_Launcher Icons (mdpi)|Launcher Icons (mdpi)]]
- [[_COMMUNITY_Launcher Icons (xxxhdpi)|Launcher Icons (xxxhdpi)]]
- [[_COMMUNITY_Notification Icon|Notification Icon]]
- [[_COMMUNITY_Android Root Build Script|Android Root Build Script]]

## God Nodes (most connected - your core abstractions)
1. `CIUDATA SPA index.html` - 22 edges
2. `CIUDATA App README` - 10 edges
3. `CIUDATA Package.json` - 9 edges
4. `scripts` - 8 edges
5. `Android Assets Capacitor Plugins Registry` - 8 edges
6. `CIUDATA App Build Instructions` - 8 edges
7. `CiuData Brand Identity` - 6 edges
8. `Orbital/Atom Visual Motif` - 6 edges
9. `android` - 5 edges
10. `plugins` - 5 edges

## Surprising Connections (you probably didn't know these)
- `CIUDATA App Build Instructions` --semantically_similar_to--> `CIUDATA App README`  [INFERRED] [semantically similar]
  ciudata-app/INSTRUCCIONES.md → ciudata-app/README.md
- `Capacitor 6.0.0 Mobile Framework` --implements--> `MainActivity.java (com.ciudata.app)`  [INFERRED]
  ciudata-app/README.md → ciudata-app/INSTRUCCIONES.md
- `App Launcher Icon (mdpi)` --conceptually_related_to--> `CiuData Brand Identity`  [INFERRED]
  ciudata-app/android/app/src/main/res/mipmap-mdpi/ic_launcher.png → ciudata-app/android/app/src/main/res/mipmap-hdpi/ic_launcher.png
- `App Launcher Icon (xxxhdpi)` --conceptually_related_to--> `CiuData Brand Identity`  [INFERRED]
  ciudata-app/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png → ciudata-app/android/app/src/main/res/mipmap-hdpi/ic_launcher.png
- `Circular App Icon Design - Dark Theme with Atom/Orbit Motif` --rationale_for--> `Atom/Orbit Visual Motif`  [INFERRED]
  ciudata-app/android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png → ciudata-app/android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png

## Hyperedges (group relationships)
- **CIUDATA Capacitor Plugin Set** — capacitor_plugin_camera, capacitor_plugin_geolocation, capacitor_plugin_haptics, capacitor_plugin_network, capacitor_plugin_preferences, capacitor_plugin_push_notifications, capacitor_plugin_splash_screen, capacitor_plugin_status_bar [EXTRACTED 1.00]
- **Android Gradle Build Chain** — android_settings_gradle, android_capacitor_settings_gradle, android_root_build_gradle, android_app_build_gradle, android_app_capacitor_build_gradle, cordova_plugins_build_gradle, cordova_variables_gradle [EXTRACTED 1.00]
- **CIUDATA App Core Technology Stack** — www_index_html, capacitor_framework, leaflet_map, openstreetmap_tiles, capacitor_geolocation, android_gradle, mainactivity_java [EXTRACTED 1.00]
- **Air Quality Display Subsystem** — pm25_metric, streaming_chart, heat_zones, eca_aire_standard, simulated_sensor_data, scenarios_traffic [INFERRED 0.95]
- **Route Recommendation Subsystem** — ai_route_model, osrm_routing, nominatim_geocoder, address_search, scenarios_traffic [INFERRED 0.95]
- **User Engagement Subsystem** — citizen_survey, gamification_points, localstorage_persistence, four_tab_bottom_nav [INFERRED 0.85]

## Communities (23 total, 2 thin omitted)

### Community 0 - "Android Build & Config Pipeline"
Cohesion: 0.21
Nodes (17): Android Assets Capacitor Config, Android Assets Capacitor Plugins Registry, BridgeActivity (Capacitor), Capacitor Config (Root), Capacitor Camera Plugin, Capacitor Geolocation Plugin, Capacitor Haptics Plugin, Capacitor Network Plugin (+9 more)

### Community 1 - "CIUDATA App Features"
Cohesion: 0.15
Nodes (21): Tacna Address Search (Local + Nominatim), AI Route Scoring Model, Android Asset index.html (bundled), Citizen Survey (5 Questions), ECA-Aire Peruvian Air Quality Standard, Four-Tab Bottom Navigation, Gamification Points & Achievements, Google Fonts (Space Mono, Syne) (+13 more)

### Community 2 - "Package Metadata & Dependencies"
Cohesion: 0.12
Nodes (16): author, description, devDependencies, @capacitor/cli, keywords, license, name, scripts (+8 more)

### Community 3 - "App Icon Assets & Brand"
Cohesion: 0.18
Nodes (16): Android Mipmap HDPI Resource Density, Android mipmap-xhdpi Resource Directory, Android mipmap-xxhdpi Resource Directory, Atom/Orbit Visual Motif, Android Mipmap Resource (xxhdpi), CiuData Brand Identity, App Launcher Icon (hdpi), App Launcher Icon (mdpi) (+8 more)

### Community 4 - "Capacitor Plugin Registry"
Cohesion: 0.15
Nodes (13): requestPermissions, plugins, Geolocation, PushNotifications, SplashScreen, StatusBar, presentationOptions, backgroundColor (+5 more)

### Community 5 - "Capacitor Plugin Config (Assets)"
Cohesion: 0.15
Nodes (13): requestPermissions, plugins, Geolocation, PushNotifications, SplashScreen, StatusBar, presentationOptions, backgroundColor (+5 more)

### Community 6 - "Capacitor Config Settings"
Cohesion: 0.17
Nodes (11): android, backgroundColor, captureInput, loggingBehavior, webContentsDebuggingEnabled, appId, appName, server (+3 more)

### Community 7 - "Capacitor Android Config"
Cohesion: 0.17
Nodes (11): android, backgroundColor, captureInput, loggingBehavior, webContentsDebuggingEnabled, appId, appName, server (+3 more)

### Community 8 - "NPM Dependencies"
Cohesion: 0.17
Nodes (12): Capacitor Geolocation Plugin, dependencies, @capacitor/android, @capacitor/camera, @capacitor/core, @capacitor/geolocation, @capacitor/haptics, @capacitor/network (+4 more)

### Community 9 - "Project Docs & Context"
Cohesion: 0.42
Nodes (9): Android Gradle Build System (8.2.2), Capacitor 6.0.0 Mobile Framework, Single Page Application Architecture, Firebase Cloud Messaging (Pending), Hackathon 2026 Reto 2 — Transporte y Tránsito, CIUDATA App Build Instructions, MainActivity.java (com.ciudata.app), CIUDATA App README (+1 more)

### Community 10 - "Android MainActivity"
Cohesion: 0.39
Nodes (4): MainActivity, BridgeActivity, Bundle, Override

### Community 11 - "Splash Screen Design"
Cohesion: 0.60
Nodes (5): Android Application, Dark Teal Color Palette, Radar Concentric Circles Design, Splash Screen, App Visual Identity

### Community 12 - "App Icon SVG Source"
Cohesion: 0.83
Nodes (4): CiuData Color Scheme (Dark Green, Teal, Orange, Red), Network Graph Visual Motif, CiuData App Icon Source SVG, CiuData Visual Identity

### Community 13 - "Launcher Icons (mdpi)"
Cohesion: 1.00
Nodes (3): Android App Icon Visual Design, Android mipmap-mdpi Resource Directory, App Launcher Round Icon (mdpi)

### Community 14 - "Launcher Icons (xxxhdpi)"
Cohesion: 1.00
Nodes (3): Android Mipmap xxxhdpi Density Bucket, Circular Orbital App Icon Design, App Launcher Round Icon (xxxhdpi)

## Knowledge Gaps
- **67 isolated node(s):** `appId`, `appName`, `webDir`, `captureInput`, `webContentsDebuggingEnabled` (+62 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `NPM Dependencies` to `Package Metadata & Dependencies`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Why does `Capacitor Geolocation Plugin` connect `NPM Dependencies` to `Project Docs & Context`, `CIUDATA App Features`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **What connects `appId`, `appName`, `webDir` to the rest of the system?**
  _71 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CIUDATA App Features` be split into smaller, more focused modules?**
  _Cohesion score 0.14761904761904762 - nodes in this community are weakly interconnected._
- **Should `Package Metadata & Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._