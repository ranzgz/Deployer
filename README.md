# FishNemo Deployer

FishNemo Deployer adalah platform *one-click deploy* yang memungkinkan pengguna untuk mendeploy situs web statis (HTML, CSS, JS, termasuk JSX/TSX) secara instan ke Vercel. Proyek ini dilengkapi dengan fitur live preview, admin dashboard untuk manajemen, dan notifikasi Telegram.

## Fitur Utama

- **Deploy Instan:** Unggah file atau ZIP dan dapatkan URL `.vercel.app` publik dalam hitungan menit.
- **Live Preview Canggih:** Pratinjau interaktif yang mendukung HTML, CSS, JS, JSX, dan TSX sebelum deploy.
- **Admin Dashboard:** Kelola semua proyek yang telah di-deploy, lihat daftar, dan hapus proyek langsung dari antarmuka.
- **Notifikasi Telegram:** Dapatkan notifikasi real-time di Telegram setiap kali ada deployment baru, lengkap dengan file proyek.
- **Antarmuka Modern:** Desain yang bersih, minimalis, dan responsif dengan animasi halus.
- **Tanpa Database Eksternal:** Mengambil data proyek secara langsung dari Vercel API untuk manajemen yang efisien.

## Prasyarat

Sebelum memulai, pastikan Anda memiliki:
- Akun [Vercel](https://vercel.com)
- Akun [GitHub](https://github.com)
- [Node.js](https://nodejs.org/) dan npm terinstal di komputer Anda
- Bot Telegram dan API Token dari [@BotFather](https://t.me/BotFather)
- Chat ID Telegram Anda dari [@userinfobot](https://t.me/userinfobot)
- API Key dari layanan subdomain Anda (misalnya, `subdo.fishnemo.xyz`)

## Tutorial Setup

Ikuti langkah-langkah ini untuk men-setup dan mendeploy proyek Anda sendiri.

### 1. Clone Repository

Clone repository ini ke mesin lokal Anda:
```bash
git clone [URL_REPOSITORY_ANDA]
cd fishnemo-deployer
```

### 2. Instal Dependensi

Jalankan perintah berikut untuk menginstal semua paket yang dibutuhkan:
```bash
npm install
```

### 3. Konfigurasi Environment Variables

Ini adalah langkah paling penting. Anda perlu menambahkan variabel-variabel berikut ke proyek Vercel Anda.

1.  Push proyek Anda ke repository GitHub.
2.  Impor repository tersebut ke Vercel.
3.  Di dashboard proyek Vercel Anda, pergi ke **Settings -> Environment Variables**.
4.  Tambahkan variabel-variabel berikut satu per satu:

| Nama Variabel        | Deskripsi                                                              | Contoh Nilai                               |
| -------------------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| `VERCEL_API_TOKEN`   | Token akses dari akun Vercel Anda. [Buat di sini](https://vercel.com/account/tokens). | `aBcDeFgHiJkLmNoPqRsTuVwXyZ1234`           |
| `VERCEL_TEAM_ID`     | (Opsional) Jika proyek berada di dalam tim Vercel, masukkan ID tim.      | `team_xxxxxxxxxxxxxxxx`                    |
| `ADMIN_PASSWORD`     | Password rahasia yang akan Anda gunakan untuk login ke Admin Dashboard.  | `PasswordSuperRahasia123!@#`               |
| `TELEGRAM_BOT_TOKEN` | Token API dari bot Telegram Anda yang didapat dari @BotFather.         | `1234567890:ABC-DEF1234ghIkl-zyx57W2v1u`    |
| `TELEGRAM_CHAT_ID`   | ID chat Telegram Anda (atau grup) untuk menerima notifikasi.           | `987654321`                                |
| `SUBDOMAKER_API_KEY` | API Key untuk layanan penghapusan subdomain (misal: `subdo.fishnemo.xyz`). | `subdo_apikey_xxxxxxxxxxxx`                |

### 4. Konfigurasi `vercel.json`

Pastikan file `vercel.json` di root proyek Anda ada dan berisi konfigurasi berikut. Ini akan membuat URL Anda bersih (tanpa `.html`) dan mengamankan Admin Dashboard.

```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [
    {
      "source": "/admin",
      "destination": "/pages/admin.html"
    },
    {
      "source": "/deploy",
      "destination": "/pages/deploy.html"
    },
    {
      "source": "/docs",
      "destination": "/pages/docs.html"
    },
    {
      "source": "/preview",
      "destination": "/pages/preview.html"
    },
    {
      "source": "/admin.js",
      "destination": "/js/admin.js"
    },
    {
      "source": "/preview.js",
      "destination": "/js/preview.js"
    }
  ]
}
```

### 5. Deploy

Setelah semua variabel diatur dan kode di-push ke GitHub, Vercel akan secara otomatis mendeploy versi terbaru. Kunjungi URL Vercel Anda untuk melihat landing page.

- **Halaman Deploy:** `https://[nama-proyek-anda].vercel.app/deploy`
- **Admin Dashboard:** `https://[nama-proyek-anda].vercel.app/admin`

Proyek Anda sekarang sudah siap digunakan!
