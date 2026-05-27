# CIUDATA ProGuard Rules
# Mantener Capacitor
-keep class com.getcapacitor.** { *; }
-keep class com.ciudata.app.** { *; }

# Mantener anotaciones
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable

# WebView Bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Firebase (cuando se habilite)
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Prevenir eliminación de clases importantes
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver

# Geolocation
-keep class com.getcapacitor.plugin.geolocation.** { *; }
