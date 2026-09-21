# ==============================================================================
# Build Script: DStock POS Android 13 APK (API 33 Only)
# ==============================================================================

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  DStock POS Mobile - Android 13 (API 33 Only) Build " -ForegroundColor Yellow
Write-Host "=====================================================" -ForegroundColor Cyan

# 1. Pastikan JAVA_HOME terdeteksi
if (-not $env:JAVA_HOME) {
    if (Test-Path "C:\Program Files\Java\jdk-22") {
        $env:JAVA_HOME = "C:\Program Files\Java\jdk-22"
        Write-Host "[OK] Configured JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Green
    } else {
        Write-Host "[!] JAVA_HOME is not set. Please install JDK 17 or higher." -ForegroundColor Yellow
    }
} else {
    Write-Host "[OK] Detected JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Green
}

# 2. Cek Android SDK Lokal
$hasSdk = $false
if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
    $hasSdk = $true
} elseif (Test-Path "C:\Users\RAMA\AppData\Local\Android\Sdk") {
    $env:ANDROID_HOME = "C:\Users\RAMA\AppData\Local\Android\Sdk"
    $hasSdk = $true
}

if ($hasSdk) {
    Write-Host "[OK] Detected Android SDK: $env:ANDROID_HOME" -ForegroundColor Green
    Write-Host "[*] Memulai kompilasi APK Android 13..." -ForegroundColor Cyan
    Push-Location "mobile\android"
    if (Test-Path "gradlew.bat") {
        .\gradlew.bat assembleRelease
    } else {
        gradle assembleRelease
    }
    Pop-Location
    Write-Host "[OK] Build selesai! APK berada di: mobile\android\app\build\outputs\apk\release\" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[INFO] Android SDK lokal sengaja tidak diinstall agar hemat resource disk (14GB free)." -ForegroundColor Yellow
    Write-Host "Pilihan build cepat & ringan Android 13:" -ForegroundColor Cyan
    Write-Host "1. GitHub Actions Cloud Runner:" -ForegroundColor White
    Write-Host "   File workflow: .github/workflows/build-android-apk.yml" -ForegroundColor Gray
    Write-Host "   Otomatis compile APK Android 13 di server cloud dalam 90 detik tanpa memakan RAM laptop." -ForegroundColor Gray
    Write-Host "2. PWA WebAPK Instan (0 MB):" -ForegroundColor White
    Write-Host "   Buka https://dstock.tahunyakrispiya.my.id/pos di Chrome Android 13 lalu klik 'Pasang Kasir'." -ForegroundColor Gray
}
