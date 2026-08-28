# PRD - Aplikasi Laporan Keuangan BUMDES Karya Raharja

## Problem Statement
Bendahara BUMDES Karya Raharja (Desa Wonoharjo, Pangandaran) membutuhkan aplikasi laporan keuangan lengkap sesuai Kepmendesa PDTT No. 136/2022 untuk 6 unit usaha, sistem bagi hasil 30% pengelola / 70% BUMDES.

## User Personas / RBAC (6 role)
- **Admin Utama**: full + kelola pengguna, CRUD COA, CRUD Jenis Transaksi
- **Direktur (Budianto)**: full read + write transaksi
- **Bendahara (Riska)**: full transaksi + laporan + import Excel
- **Pengelola Unit**: hanya unit sendiri
- **Pengawas / Penasihat**: read-only setara Direktur

## Core Features (Implemented)
1. Auth JWT username/password + RBAC 6 role + password recovery admin-view
2. 54 kode akun COA + 27 jenis transaksi (per unit usaha) + CRUD keduanya (admin)
3. Input transaksi cepat + edit + Excel import (bendahara/direktur/admin)
4. Filter jenis transaksi mengikuti unit terpilih
5. Dashboard: 4 KPI + period selector (bulan/3bulan/6bulan/tahun, default tahun), LineChart tren, PieChart kontribusi, ringkasan 6 unit + baris TOTAL
6. 7 Laporan lengkap (Neraca, L/R, Arus Kas sorted date, Perubahan Ekuitas, CaLK, Per Unit sorted code, Bagi Hasil)
7. Export PDF dengan logo BUMDES + word-wrap + tanda tangan Direktur & Bendahara
8. Bagi Hasil 30/70 otomatis + delete per baris
9. CRUD Mitra + Unit Usaha
10. Kelola Pengguna (admin only): 6 role, kolom password reveal/reset
11. Mobile responsive + logo BUMDES di sidebar & favicon
12. Tema hijau muda + krem pastel

## Architecture
- Backend: FastAPI + MongoDB + JWT (bcrypt) + ReportLab (PDF + logo PNG) + openpyxl (Excel import)
- Frontend: React 19 + Tailwind + Recharts + Phosphor Icons + Plus Jakarta Sans/Outfit

## Testing Status (5 iterations, all 100%)
- Iter 1: baseline (backend 33/33 + frontend 100%)
- Iter 2: 4 fitur baru (backend 49/49 + frontend 100%)
- Iter 3: RBAC hardening (backend 12/12 + frontend 8/8)
- Iter 4: 7 revisi besar (backend 17/17 + frontend 100%)
- Iter 5: Logo BUMDES asli (backend 15/15 + frontend 100%)
- Total: **126 backend tests pass**, no regression

## Prioritized Backlog

### P1
- Enkripsi at-rest untuk plain_password
- HttpOnly cookies (bukan localStorage)
- Audit log transaksi

### P2
- Buku besar per akun (drill-down)
- Multi-tahun budget vs realisasi
- Notifikasi email setoran bulanan (SendGrid/Resend)
- Optimize logo PNG ke 512x512 (dari 2000x2000)

### P3
- Split server.py jadi routers/
- Extract PDF module ke pdf_reports.py
- Google Login opsional
