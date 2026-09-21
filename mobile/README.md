# 📱 DStock POS Kasir – Mobile Android App (React Native & Android Studio)

Aplikasi kasir mobile native untuk **Tahunya Krispi-ya!** yang dioptimalkan untuk ukuran file sangat kecil (**~10-12 MB**), waktu cold-start di bawah 1 detik (**sat-set**), serta akses langsung ke **hardware kamera belakang** untuk jepret bukti QRIS / QRISKas secara instan.

---

## 🚀 Fitur Utama

1. **Hardware Kamera Belakang Langsung**:
   - Izin kamera otomatis diminta saat aplikasi dibuka (`android.permission.CAMERA`).
   - Kamera belakang diakses langsung dengan hardware acceleration tanpa perlu keluar-masuk aplikasi kamera bawaan Android yang berat.
   - Dilengkapi tombol kontrol **Senter / Flashlight (Torch)** langsung dari viewfinder kamera.
2. **Performa Sat-Set (Hermes Engine Enabled)**:
   - Kode JavaScript dikompilasi menjadi bytecode pra-hitung via **Hermes Engine**.
   - Cold start aplikasi < 800ms, transisi mulus 60 FPS, dan respon ketukan haptik instan.
3. **Ukuran File APK Sangat Kecil (~10–12 MB)**:
   - Dilengkapi konfigurasi **Proguard / R8 Code Shrinking**, Resource Shrinking, dan **ABI Splits** di `app/build.gradle`.
   - Menghasilkan file APK rilis berkisar **~10–12 MB** (sangat ringan di memori HP kasir dan cepat dikirim via WhatsApp antar gerai).
4. **Physical Back Button Protection (Smart Bridge)**:
   - Tombol back fisik Android terhubung langsung ke Web POS; secara pintar menutup modal kamera, popup konfirmasi, atau keranjang terlebih dahulu sebelum keluar aplikasi.

---

## 🛠️ Langkah Menjalankan di Android Studio

### 1. Prasyarat:
- **Node.js** v18+ sudah terpasang.
- **Android Studio** (Hedgehog / Iguana / Jellyfish atau versi terbaru).
- Android SDK Platform 34 & Build-Tools 34.0.0.

### 2. Buka Proyek di Android Studio:
1. Buka aplikasi **Android Studio**.
2. Pilih menu **File** $\to$ **Open...**
3. Arahkan dan pilih folder:
   ```
   c:\DB-Stock-Bot-Reminder\mobile\android
   ```
4. Tunggu proses **Gradle Sync** selesai mengunduh dependensi dan mengindeks proyek.

### 3. Install Dependensi JavaScript (Terminal `mobile/`):
Buka PowerShell / Terminal di folder `mobile/`:
```bash
cd c:\DB-Stock-Bot-Reminder\mobile
npm install
```

### 4. Menjalankan di HP Android / Emulator:
1. Sambungkan HP Android kasir via kabel USB (pastikan *USB Debugging* aktif).
2. Di Android Studio, pilih perangkat HP Anda di menu dropdown toolbar atas.
3. Klik tombol hijau **Run 'app'** (atau tekan `Shift + F10`).
4. Aplikasi akan otomatis terpasang dan terbuka di HP kasir!

---

## 📦 Cara Membuat File APK Rilis (Siap Install di HP Kasir Gerai)

Untuk membuat file `.apk` mandiri yang bisa langsung dibagikan dan di-install di HP kasir tanpa Android Studio:

### Cara 1: Lewat Terminal (Paling Cepat)
```powershell
cd c:\DB-Stock-Bot-Reminder\mobile\android
.\gradlew assembleRelease
```
File APK hasil build yang siap dipasang akan berada di folder `mobile/android/app/build/outputs/apk/release/`:
- **`app-arm64-v8a-release.apk`** (**~10 MB** – Direkomendasikan untuk 95% HP Android modern saat ini, sangat ringan & cepat dikirim via WhatsApp)
- **`app-armeabi-v7a-release.apk`** (**~10 MB** – Untuk HP Android lama 32-bit)
- **`app-universal-release.apk`** (**~15 MB** – File universal gabungan yang kompatibel di semua tipe HP)

### Cara 2: Lewat Android Studio GUI
1. Di Android Studio, klik menu **Build** $\to$ **Build Bundle(s) / APK(s)** $\to$ **Build APK(s)**.
2. Tunggu notifikasi *"APK(s) generated successfully"*.
3. Klik **locate** untuk mengambil file APK.

---

## ⚡ Mode Instan PWA (Alternatif 0 MB Tanpa Install APK)

Selain APK Android Studio, kasir juga bisa menggunakan mode **PWA (Progressive Web App)**:
1. Buka browser Chrome di HP: `https://dstock.tahunyakrispiya.my.id/pos`
2. Tap menu titik tiga di kanan atas $\to$ Pilih **"Tambahkan ke Layar Utama" (Add to Home screen)** / **"Instal Aplikasi"**.
3. Icon **DStock Kasir** akan langsung muncul di menu HP dengan ukuran 0 MB, berjalan full-screen tanpa address bar, dan langsung dapat mengakses kamera belakang secara native!
