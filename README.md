# DB-Stock-Bot-Reminder

Dashboard laporan stok barang yang mengambil data dari Google Apps Script dan Google Sheets, lengkap dengan ringkasan status dan preview pesan WhatsApp.

## Isi Repo

- `index.html` - halaman dashboard GitHub Pages.
- `kode.gs` - endpoint Google Apps Script untuk mengambil data spreadsheet sebagai JSON.
- `Database Stock.xlsx` - contoh struktur database stok.
- `Images/` - gambar produk yang dipakai dashboard.

## Setup Google Apps Script

1. Buka Google Sheets database stok.
2. Masuk ke Extensions > Apps Script.
3. Salin isi `kode.gs` ke editor Apps Script.
4. Deploy sebagai Web App.
5. Izinkan akses, lalu salin URL `/exec`.
6. Ganti nilai `API_URL` di `index.html` dengan URL Web App terbaru.

## GitHub Pages dan Subdomain

Repo ini bisa dipakai dengan GitHub Pages.

Untuk memakai subdomain seperti `stock.domainkamu.com`:

1. Aktifkan GitHub Pages dari branch `main`.
2. Tambahkan file `CNAME` berisi nama subdomain, contoh:

   ```txt
   stock.domainkamu.com
   ```

3. Di DNS domain, buat record:

   ```txt
   Type: CNAME
   Name: stock
   Value: ramadani1t.github.io
   ```

4. Tunggu DNS aktif, lalu aktifkan HTTPS di GitHub Pages.
