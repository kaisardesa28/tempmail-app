# 🚀 Panduan Deploy Gratisan (100% Free)

Proyek **TempMail** ini sudah dikonfigurasi secara lengkap agar bisa langsung dideploy secara **GRATIS** ke platform cloud terbaik: **Vercel** atau **Render**.

---

## 🥇 OPSI 1: Deploy ke VERCEL (Paling Direkomendasikan & Cepat)
*Keunggulan: 100% Gratis selamanya, loading super cepat (Global Edge CDN), tanpa batas sleep.*

### Langkah-langkah:
1. **Upload / Push Proyek ke GitHub**:
   - Buka GitHub ([github.com](https://github.com/)) dan buat repository baru (misal: `my-tempmail`).
   - Di terminal folder proyek (`h:\1\we`), jalankan:
     ```bash
     git init
     git add .
     git commit -m "Initial commit TempMail"
     git branch -M main
     git remote add origin https://github.com/USERNAME-KAMU/my-tempmail.git
     git push -u origin main
     ```

2. **Deploy di Vercel**:
   - Buka [vercel.com](https://vercel.com/) dan login menggunakan akun GitHub Anda.
   - Klik **"Add New..."** -> **"Project"**.
   - Pilih repository `my-tempmail` yang baru saja Anda push, lalu klik **"Import"**.
   - Biarkan semua pengaturan default (konfigurasi sudah otomatis dibaca dari `vercel.json`).
   - Klik tombol **"Deploy"**.

3. **Selesai!**
   Dalam hitungan detik, website Anda sudah aktif secara online dengan domain gratis dari Vercel (misal: `https://my-tempmail.vercel.app`).

---

## 🥈 OPSI 2: Deploy ke RENDER (Gratis Web Service)
*Keunggulan: Menjalankan Node.js server murni, sangat mudah tanpa konfigurasi rumit.*

### Langkah-langkah:
1. Pastikan kode sudah di-push ke GitHub (seperti langkah di Opsi 1).
2. Buka [render.com](https://render.com/) dan login dengan GitHub.
3. Klik **"New +"** -> pilih **"Web Service"**.
4. Pilih repository `my-tempmail` Anda.
5. Isi konfigurasi:
   - **Name**: `tempmail-app` (bebas)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan Type**: `Free`
6. Klik **"Create Web Service"**.
7. Tunggu build selesai, dan website Anda akan aktif di URL `https://tempmail-app.onrender.com`.

---

## 🥉 OPSI 3: Deploy via Docker (Koyeb / Railway / VPS)
Jika Anda memiliki VPS atau menggunakan platform berbasis Docker (seperti Koyeb):
Proyek ini sudah dilengkapi `Dockerfile`. Anda tinggal menghubungkan repository ke Koyeb atau jalankan:
```bash
docker build -t tempmail .
docker run -p 3000:3000 tempmail
```
