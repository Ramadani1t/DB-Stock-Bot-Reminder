# React Native & Hermes Proguard Rules
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# React Native WebView & WebRTC Camera
-keep class com.reactnativecommunity.webview.** { *; }
-keepclassmembers class * extends android.webkit.WebChromeClient {
    public void onPermissionRequest(...);
}

# Keep hardware camera & media interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-dontwarn com.facebook.react.**
-dontwarn okhttp3.**
-dontwarn okio.**
