# 📱 DStock POS Kasir — Mobile Android App (Android Studio & Native WebView Shell)

Aplikasi kasir mobile native untuk **Tahunya Krispi-ya!** yang dioptimalkan untuk ukuran file sangat kecil (**~5-10 MB**), waktu cold-start di bawah 1 detik (**sat-set**), serta akses langsung ke **hardware kamera belakang** untuk jepret bukti QRIS / QRISKas secara instan dengan resolusi penuh (Full HD).

---

## 🚀 Fitur Utama & Arsitektur Kamera Hardware

1. **Hardware Kamera Belakang Langsung (Level Hardware)**:
   - **Kamera Belakang Fisik Terkunci**: Menggunakan Bundle Extras level hardware (`android.intent.extra.CAMERA_FACING = 0`, `android.intent.extra.USE_FRONT_CAMERA = false`, `LENS_FACING_FRONT = 0`) untuk memastikan kamera belakang selalu aktif (bukan kamera selfie).
   - **FileProvider Full-HD Capture**: Foto jepretan kamera pihak ketiga / kamera bawaan HP disimpan via `androidx.core.content.FileProvider` dan dikompresi ke citra beresolusi tinggi (HD 1280px, JPEG 85%), bukan thumbnail buram/mini.
   - **Live In-App Viewfinder (WebRTC / getUserMedia)**: Layar scanner kamera langsung di dalam aplikasi tanpa perlu keluar-masuk aplikasi kamera eksternal yang berat.
   - **Multi-Tier Camera Enumeration (Standar QRISKas)**: Sistem deteksi cerdas yang menyaring kata kunci sensor hardware (`back`, `rear`, `environment`, `belakang`, `camera2 0`) serta continuous autofocus otomatis.
   - **Tombol Senter / Torch**: Kontrol lampu kilat langsung dari viewfinder kamera saat pencahayaan gerai minim.
2. **Performa Sat-Set**:
   - Hardware acceleration WebView aktif (`android:hardwareAccelerated="true"` dan `setLayerType(View.LAYER_TYPE_HARDWARE, null)`).
   - Cold start aplikasi < 800ms, transisi mulus 60 FPS, dan respon ketukan haptik instan.
3. **Ukuran File APK Sangat Ringan**:
   - Ukuran APK rilis berkisar **~5–10 MB** (sangat hemat memori HP kasir dan cepat dikirim via WhatsApp antar gerai).
4. **Physical Back Button Protection (Smart Bridge)**:
   - Tombol back fisik Android terhubung langsung ke Web POS; secara pintar menutup modal kamera, popup konfirmasi, atau keranjang terlebih dahulu sebelum keluar aplikasi.

---

## 🛠️ Langkah Menjalankan di Android Studio

### 1. Prasyarat:
- **Android Studio** (Hedgehog / Iguana / Jellyfish / Ladybug atau versi terbaru).
- Android SDK Platform 34 & Build-Tools 34.0.0.
- JDK 17.

### 2. Buka Proyek di Android Studio:
1. Buka aplikasi **Android Studio**.
2. Pilih menu **File** $\to$ **Open...**
3. Arahkan dan pilih folder:
   ```
   c:\DB-Stock-Bot-Reminder\mobile\android
   ```
4. Tunggu proses **Gradle Sync** selesai mengunduh dependensi dan mengindeks proyek.

### 3. Menjalankan di HP Android / Emulator:
1. Sambungkan HP Android kasir via kabel USB (pastikan *USB Debugging* aktif).
2. Di Android Studio, pilih perangkat HP Anda di menu dropdown toolbar atas.
3. Klik tombol hijau **Run 'app'** (atau tekan `Shift + F10`).
4. Aplikasi akan otomatis terpasang dan terbuka di HP kasir!

---

## 📦 Cara Membuat File APK Rilis

Untuk membuat file `.apk` mandiri yang bisa langsung dibagikan dan di-install di HP kasir tanpa Android Studio:

### Cara 1: Lewat Terminal
```bash
cd c:\DB-Stock-Bot-Reminder\mobile\android
./gradlew assembleRelease
```
File APK hasil build yang siap dipasang akan berada di folder:
`mobile/android/app/build/outputs/apk/release/`

### Cara 2: Lewat Android Studio GUI
1. Di Android Studio, klik menu **Build** $\to$ **Build Bundle(s) / APK(s)** $\to$ **Build APK(s)**.
2. Tunggu notifikasi *"APK(s) generated successfully"*.
3. Klik **locate** untuk mengambil file APK.

### Cara 3: Lewat GitHub Actions CI Otomatis
Setiap kali ada *push* ke branch `main`, workflow `.github/workflows/build-android-apk.yml` akan otomatis mengompilasi APK dan mengunggahnya ke tab **GitHub Actions Artifacts**.

---

## 🌐 Mode Instan PWA (Alternatif 0 MB Tanpa Install APK)

Selain APK Android Studio, kasir juga bisa menggunakan mode **PWA (Progressive Web App)**:
1. Buka browser Chrome di HP: `https://dstock.tahunyakrispiya.my.id/pos`
2. Tap menu titik tiga di kanan atas $\to$ Pilih **"Tambahkan ke Layar Utama" (Add to Home screen)** / **"Instal Aplikasi"**.
3. Icon **DStock Kasir** akan langsung muncul di menu HP dengan ukuran 0 MB, berjalan full-screen tanpa address bar, dan langsung dapat mengakses kamera belakang secara native!
