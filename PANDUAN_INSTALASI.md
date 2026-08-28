# PANDUAN INSTALASI - Aplikasi Laporan Keuangan BUMDES Karya Raharja

## 🎯 Aplikasi ini sudah HIDUP & Siap Dipakai!

Aplikasi ini sudah otomatis di-deploy oleh platform Emergent. Ibu Riska dan tim BUMDES Karya Raharja dapat langsung menggunakannya melalui HP Android atau laptop.

---

## 🚀 Cara Menggunakan Aplikasi (Untuk Ibu Riska dan Tim)

### 1. Buka Aplikasi
- Buka browser **Google Chrome** di HP Android atau laptop.
- Ketik alamat aplikasi ini di address bar (URL yang diberikan Emergent).
- Aplikasi akan langsung terbuka dan tampil responsif untuk layar HP maupun laptop.

### 2. Login Pertama Kali (Akun Demo/Bawaan)

Ada 3 akun bawaan yang sudah dibuatkan otomatis:

| Peran | Username | Password |
|---|---|---|
| **Admin Utama** | `admin` | `admin123` |
| **Direktur (Budianto)** | `budianto` | `direktur123` |
| **Bendahara (Riska)** | `riska` | `bendahara123` |

> **PENTING:** Segera ganti password default setelah login pertama demi keamanan (fitur ini bisa ditambahkan di iterasi berikutnya).

### 3. Menambahkan Akun Pengelola Unit Usaha
1. Login sebagai **Admin Utama**.
2. Klik menu **"Kelola Pengguna"** di sidebar.
3. Klik tombol **"Tambah Pengguna"**.
4. Isi Nama, Username, Email, Password, pilih Role = **"Pengelola Unit"**, dan pilih Unit Usaha yang ditugaskan.
5. Klik **Simpan**. Pengelola akan bisa login dan hanya melihat data unit-nya sendiri.

### 4. Input Transaksi (Cukup 3 Langkah)
1. Login (dengan akun apapun sesuai peran).
2. Klik menu **"Transaksi"** → **"Tambah Transaksi"**.
3. Isi: **Tanggal**, pilih **Jenis Transaksi** (mis. "Penerimaan Setoran Rp3.000/kg Ikan"), isi **Nominal** → tekan **Simpan**.

Akun Debit dan Kredit akan otomatis terpilih sesuai jenis transaksi (bisa diubah manual jika perlu). Laporan Neraca, Laba Rugi, dan semua laporan lain akan **otomatis terbentuk**.

### 5. Melihat & Export Laporan (PDF)
1. Klik menu **"Laporan Keuangan"**.
2. Pilih jenis laporan (tab): Laba Rugi, Neraca, Arus Kas, Perubahan Ekuitas, atau CaLK.
3. Pilih rentang tanggal → klik **"Tampilkan Laporan"**.
4. Klik tombol **"Export PDF"** di kanan atas untuk mengunduh laporan sebagai file PDF (siap dicetak / dikirim).

### 6. Kalkulator Bagi Hasil 30/70
1. Klik menu **"Bagi Hasil 30/70"**.
2. Klik **"Hitung Bagi Hasil"** → pilih periode, unit usaha, isi pendapatan kotor dan biaya operasional.
3. Sistem menghitung otomatis: **Laba Bersih**, **30% untuk Pengelola**, **70% untuk BUMDES**.

---

## 🔐 Pembagian Akses (Sesuai Peran)

| Menu | Admin | Direktur | Bendahara | Pengelola |
|---|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | ✅ (unit sendiri) |
| Transaksi | ✅ | ✅ | ✅ | ✅ (unit sendiri) |
| Laporan Keuangan (Neraca, L/R, dll) | ✅ | ✅ | ✅ | ❌ |
| Laporan Per Unit | ✅ | ✅ | ✅ | ✅ (unit sendiri) |
| Bagi Hasil 30/70 | ✅ | ✅ | ✅ | ❌ |
| Unit Usaha | ✅ | ✅ | ✅ | ✅ |
| Data Mitra | ✅ | ✅ | ✅ | ✅ (unit sendiri) |
| Kode Akun (COA) | ✅ | ✅ | ✅ | ❌ |
| Kelola Pengguna | ✅ | ✅ (baca) | ❌ | ❌ |

---

## 📱 Tips untuk Pengguna HP Android

1. Buka Chrome → buka aplikasi → titik-tiga di kanan atas → **"Tambahkan ke Layar utama"**.
2. Ikon aplikasi akan muncul di layar utama HP seperti aplikasi biasa.
3. Aplikasi akan **auto-responsive** menyesuaikan layar kecil (menu berubah jadi tombol hamburger di kiri atas).

---

## 🛠️ Untuk Pengembangan Lanjutan (Opsional - Buat Developer)

Aplikasi ini dibangun dengan stack:
- **Backend:** FastAPI (Python) + MongoDB
- **Frontend:** React 19 + Tailwind CSS + Recharts
- **PDF Export:** ReportLab (server-side, bahasa Indonesia)
- **Auth:** JWT username/password (bcrypt hash)

Semua kode ada di folder `/app/backend` (Python) dan `/app/frontend` (React).

### Menjalankan Lokal (Bagi Developer)
```bash
# Backend
cd /app/backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# Frontend
cd /app/frontend
yarn install
yarn start
```

---

## 📊 Chart of Accounts (Kode Akun)

Aplikasi sudah menyediakan **54 kode akun** default sesuai Kepmendesa PDTT No. 136/2022, disesuaikan dengan karakteristik 6 unit usaha BUMDES Karya Raharja. Kelompok besar:

- **1-xxxx** — Aset (Kas, Bank, Piutang, Persediaan, Aset Tetap)
- **2-xxxx** — Kewajiban (Utang Usaha, Utang Bagi Hasil)
- **3-xxxx** — Ekuitas (Modal Penyertaan, Laba Ditahan)
- **4-xxxx** — Pendapatan (per unit usaha)
- **5-xxxx** — Beban (BBM Monitoring, ATK, Packing, Listrik, PDAM, Wifi, dsb.)

Dapat diperluas via menu **"Kode Akun (COA)"** oleh Admin/Direktur/Bendahara.

---

Selamat menggunakan, Bu Riska! Semoga aplikasi ini membantu pengelolaan keuangan BUMDES Karya Raharja lebih rapi, transparan, dan sesuai regulasi. 🌾
