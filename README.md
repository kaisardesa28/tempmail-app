# ⚡ TempMail - Layanan Email Sementara Siap Pakai

Website email sementara (*disposable temporary email*) modern, cepat, dan siap pakai untuk menerima email konfirmasi, verifikasi kode OTP, dan melindungi privasi email asli Anda dari spam.

---

## 🚀 Cara Menjalankan

1. **Jalankan Server**:
   ```bash
   npm start
   ```
   Atau untuk mode development (auto-reload):
   ```bash
   npm run dev
   ```

2. **Akses di Browser**:
   Buka URL: [http://localhost:3000](http://localhost:3000)

---

## 🌟 Fitur Utama

- **Email Aktif Sungguhan**: Terhubung langsung dengan Mail.tm API dengan domain aktif publik (`@uberip.com`).
- **Alamat Otomatis & Kustom**:
  - Dibuat otomatis saat halaman dibuka.
  - Opsi **Ganti Acak** untuk membuat alamat baru.
  - Opsi **Kustom Username** untuk menentukan nama email sendiri.
- **Deteksi Otomatis Kode OTP**:
  - Mendeteksi kode verifikasi (angka 4–8 digit) dari isi email.
  - Tombol **1-Click Salin OTP** untuk menyalin kode secara instan.
- **Auto-Refresh & Notifikasi Suara**:
  - Countdown otomatis 10 detik dengan bar visual.
  - Suara lonceng (*audio chime*) otomatis saat email masuk.
- **Tampilan Aman**:
  - Tab Tampilan HTML (sandboxed iframe).
  - Tab Teks Polos.
  - Dukungan daftar unduhan lampiran (*attachments*).
- **QR Code Generator**:
  - Scan QR code dengan kamera HP untuk menyalin email langsung ke smartphone.

---

## 📁 Struktur Folder

```
h:\1\we\
├── server\
│   ├── index.js             # Express server & static serving
│   ├── routes\
│   │   └── mail.js          # Proxy API Mail.tm (akun, inbox, pesan)
│   └── utils\
│       └── otpExtractor.js  # Ekstraktor cerdas kode OTP
├── public\
│   ├── index.html           # Tampilan web SPA modern
│   ├── css\
│   │   └── style.css        # Desain glassmorphism & animasi
│   └── js\
│       ├── app.js           # Core controller, audio chime, toast
│       └── mail.js          # Logika temp mail, auto-refresh & reader
├── package.json
└── README.md
```
