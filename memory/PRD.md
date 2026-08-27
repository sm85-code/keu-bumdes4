# PRD - Aplikasi Laporan Keuangan BUMDES Karya Waharja

## Problem Statement (Original)
Ibu Riska Vianti (Bendahara BUMDES Karya Waharja, Desa Wonoharjo, Pangandaran) membutuhkan aplikasi laporan keuangan lengkap sesuai Kepmendesa PDTT No. 136 Tahun 2022 untuk mengelola 6 unit usaha (Pembibitan Domba Garut, Ternak Ikan Mujaer Bioflok, Sewa Angkutan, Perdagangan & Produksi, Toko Offline, Toko Online). Sistem bagi hasil 30% pengelola / 70% BUMDES.

## User Personas / Roles (6)
- **Admin Utama** — kelola semua data + kelola pengguna (satu-satunya yang bisa lihat/edit /users)
- **Direktur (Budianto)** — akses penuh transaksi & laporan (tanpa /users)
- **Bendahara (Riska)** — input transaksi + semua laporan + bagi hasil
- **Pengelola Unit Usaha** — hanya unit sendiri (Transaksi, Mitra, Laporan Per Unit)
- **Pengawas** — read-only setara Direktur, tidak bisa POST/DELETE apapun
- **Penasihat** — read-only setara Direktur, tidak bisa POST/DELETE apapun

## Core Requirements (Static)
1. Laporan sesuai Kepmendesa 136/2022 (Neraca, L/R, Arus Kas, Perubahan Ekuitas, CaLK, Per Unit, Bagi Hasil) — export PDF word-wrap rapi
2. Multi-user login username/password + RBAC 6 role
3. Input transaksi cepat (tanggal, jenis, nominal) → laporan otomatis
4. Dashboard ringkasan 6 unit + baris TOTAL + grafik pendapatan/beban
5. Chart of Accounts (COA) berdasar Kepmendesa 136/2022 (bisa CRUD)
6. Tema pastel hijau muda + krem, responsif mobile

## Architecture
- Backend: FastAPI + MongoDB + JWT (bcrypt) + ReportLab (PDF word-wrap)
- Frontend: React 19 + Tailwind + Recharts + Phosphor Icons + Plus Jakarta Sans/Outfit
- RBAC: `READ_LEVEL` (6 role), `WRITE_LEVEL` (admin/direktur/bendahara), `ADMIN_LEVEL`, `require_not_readonly()` untuk block pengawas/penasihat pada POST tx/mitra

## What's Implemented (2026-01)
- ✅ Auth JWT + RBAC 6 role + seed 3 default user + plain_password backfill (admin-view untuk recovery)
- ✅ 54 kode akun COA + CRUD (form Tambah COA) + 6 unit usaha + 27 tipe transaksi
- ✅ Input transaksi (double-entry, auto pilih debit/kredit dari jenis)
- ✅ Dashboard: 4 KPI, chart bar tren bulanan, pie kontribusi, tabel 6 unit **+ baris TOTAL** (hijau muda)
- ✅ 7 Laporan (Neraca, L/R, Arus Kas, Perubahan Ekuitas, CaLK, Per Unit, Bagi Hasil) + Export PDF word-wrap (Paragraph in cells, section headers, total rows highlighted)
- ✅ Bagi Hasil 30/70 otomatis + **hapus per baris**
- ✅ CRUD Mitra, Unit Usaha, Kode Akun
- ✅ Kelola Pengguna (admin-only): 6 role, kolom password (reveal per-baris + toggle global), reset password, tambah pengguna
- ✅ Role Pengawas & Penasihat: read-only (tidak bisa POST/DELETE transaksi/mitra/bagi-hasil/dsb.)
- ✅ Mobile responsive + sidebar collapse + custom pastel theme
- ✅ Code quality: useCallback, useMemo, stable keys, extracted constants
- ✅ Panduan instalasi non-teknis di /app/PANDUAN_INSTALASI.md

## Testing Status (semua 100%)
- Iteration 1: backend 33/33 + frontend 100% ✅
- Iteration 2 (fitur baru): backend 49/49 + frontend 100% ✅
- Iteration 3 (RBAC patch): backend 12/12 + frontend 8/8 ✅
- Tidak ada regresi

## Prioritized Backlog

### P1 (Security)
- Enkripsi at-rest untuk `plain_password` di DB (saat ini plaintext, admin-only access)
- Migrasi token dari localStorage → httpOnly cookie
- Audit log (who did what when)

### P2 (Feature)
- Import bulk transaksi via Excel/CSV
- Buku besar per akun (drill-down)
- Multi-tahun budgeting & realisasi
- Backup/restore database

### P3 (Nice-to-have)
- Google Login opsional
- Split server.py jadi multiple router
- Extract PDF table-builder helper (DRY)
- Dashboard per-unit view untuk pengelola
