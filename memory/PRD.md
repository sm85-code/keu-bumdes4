# PRD - Aplikasi Laporan Keuangan BUMDES Karya Waharja

## Problem Statement (Original)
Ibu Riska Vianti (Bendahara BUMDES Karya Waharja, Desa Wonoharjo, Pangandaran) membutuhkan aplikasi laporan keuangan lengkap sesuai Kepmendesa PDTT No. 136 Tahun 2022 untuk mengelola 6 unit usaha (Pembibitan Domba Garut, Ternak Ikan Mujaer Bioflok, Sewa Angkutan, Perdagangan & Produksi, Toko Offline, Toko Online). Sistem bagi hasil 30% pengelola / 70% BUMDES.

## User Personas
- **Admin Utama** — kelola semua, termasuk pengguna
- **Direktur (Budianto)** — akses penuh + kelola pengguna
- **Bendahara (Riska)** — input transaksi + semua laporan
- **Pengelola Unit Usaha** — hanya lihat unit sendiri (Transaksi, Mitra, Per-Unit Report)

## Core Requirements (Static)
1. Laporan sesuai Kepmendesa 136/2022 (Neraca, L/R, Arus Kas, Perubahan Ekuitas, CaLK, Per Unit, Bagi Hasil) — export PDF
2. Multi-user login username/password + RBAC 4 role
3. Input transaksi cepat (tanggal, jenis, nominal) → laporan otomatis
4. Dashboard ringkasan 6 unit + grafik pendapatan/beban
5. Chart of Accounts (COA) berdasar Kepmendesa 136/2022
6. Tema pastel hijau muda + krem, responsif mobile

## Architecture
- Backend: FastAPI + MongoDB + JWT (bcrypt) + ReportLab (PDF)
- Frontend: React 19 + Tailwind + Recharts + Phosphor Icons + Plus Jakarta Sans/Outfit
- Auth: JWT username/password, session di localStorage (v2 → httpOnly cookie)

## What's Implemented (2026-01)
- ✅ Auth JWT + RBAC (4 role) + seed 3 default user
- ✅ 54 kode akun COA + 6 unit usaha + 27 tipe transaksi (auto-seed startup)
- ✅ Input transaksi (double-entry, auto pilih debit/kredit dari jenis)
- ✅ Dashboard: 4 KPI, chart bar tren bulanan, pie kontribusi, tabel 6 unit
- ✅ 7 Laporan (Neraca, L/R, Arus Kas, Perubahan Ekuitas, CaLK, Per Unit, Bagi Hasil) + Export PDF
- ✅ Kalkulator bagi hasil 30/70 otomatis
- ✅ CRUD Mitra, Unit Usaha, Kode Akun (form Tambah COA)
- ✅ Kelola Pengguna (admin/direktur)
- ✅ Mobile responsive + sidebar collapse + custom pastel theme
- ✅ Code quality fixes: useCallback, useMemo, stable keys, extracted constants
- ✅ Panduan instalasi non-teknis di /app/PANDUAN_INSTALASI.md

## Testing Status
- Backend: 33/33 pytest ✅
- Frontend: all critical flows ✅ (login, dashboard, transactions, reports, PDF export, COA create, RBAC)
- No regressions after code review fixes

## Prioritized Backlog (Next Iterations)

### P1 (Security & Quality)
- Migrasi token ke httpOnly cookies (perlu backend set-cookie + CORS credentials)
- Ganti password sendiri (self-service change password)
- Audit log (siapa input transaksi apa & kapan)

### P2 (Feature Enhancements)
- Import bulk transaksi via Excel/CSV
- Backup & restore database
- Notifikasi email untuk setoran bagi hasil bulanan (SendGrid/Resend)
- Buku besar per akun (drill-down dari trial balance)
- Dashboard per unit untuk pengelola

### P3 (Nice-to-have)
- Google Login (Emergent OAuth) sebagai opsi paralel JWT
- Split backend server.py jadi multiple router
- Multi-tahun budgeting & realisasi
