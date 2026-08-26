import { useState } from "react";
import api, { fmtRp, API } from "@/lib/api";
import { FilePdf, ChartLine, Scales, Coins, TrendUp, BookOpen, ChartBar } from "@phosphor-icons/react";

const today = new Date().toISOString().slice(0, 10);
const startOfYear = today.slice(0, 4) + "-01-01";

const REPORTS = [
  { key: "laba-rugi", label: "Laporan Laba Rugi", icon: ChartLine, needsRange: true },
  { key: "neraca", label: "Neraca", icon: Scales, needsRange: false },
  { key: "arus-kas", label: "Laporan Arus Kas", icon: Coins, needsRange: true },
  { key: "perubahan-ekuitas", label: "Perubahan Ekuitas", icon: TrendUp, needsRange: true },
  { key: "calk", label: "Catatan atas Laporan Keuangan (CaLK)", icon: BookOpen, needsRange: true },
];

export default function Reports() {
  const [start, setStart] = useState(startOfYear);
  const [end, setEnd] = useState(today);
  const [active, setActive] = useState("laba-rugi");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const cfg = REPORTS.find(r => r.key === active);

  const load = async () => {
    setLoading(true); setData(null);
    try {
      const params = cfg.needsRange
        ? { start_date: start, end_date: end }
        : { as_of_date: end };
      const r = await api.get(`/reports/${active}`, { params });
      setData(r.data);
    } catch (er) {
      alert(er.response?.data?.detail || "Gagal memuat laporan");
    } finally { setLoading(false); }
  };

  const downloadPdf = async () => {
    const params = new URLSearchParams(cfg.needsRange
      ? { start_date: start, end_date: end }
      : { as_of_date: end });
    const token = localStorage.getItem("bumdes_token");
    const res = await fetch(`${API}/reports/${active}/pdf?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { alert("Gagal export PDF"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${active}_${cfg.needsRange ? start+"_sd_"+end : end}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div>
        <p className="label mb-1">Kepmendesa 136/2022</p>
        <h1 className="font-heading text-3xl font-bold">Laporan Keuangan BUMDES</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Semua laporan wajib BUMDES tersedia dan bisa di-export ke PDF.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {REPORTS.map(r => {
          const Icon = r.icon;
          const isActive = active === r.key;
          return (
            <button key={r.key} data-testid={`rpt-tab-${r.key}`}
                    onClick={() => { setActive(r.key); setData(null); }}
                    className={`btn ${isActive ? "btn-secondary" : "btn-outline"} whitespace-nowrap`}>
              <Icon size={16} weight={isActive ? "fill" : "regular"} /> {r.label}
            </button>
          );
        })}
      </div>

      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          {cfg.needsRange ? (
            <>
              <div>
                <label className="label">Tanggal Mulai</label>
                <input data-testid="start-date" type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <label className="label">Tanggal Akhir</label>
                <input data-testid="end-date" type="date" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="sm:col-span-2">
              <label className="label">Per Tanggal</label>
              <input data-testid="as-of-date" type="date" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          )}
          <div className="flex gap-2">
            <button data-testid="btn-load-report" onClick={load} className="btn btn-primary w-full">
              {loading ? "Memuat..." : "Tampilkan Laporan"}
            </button>
          </div>
        </div>
      </div>

      {data && (
        <div className="card fade-in">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h3 className="font-heading text-xl font-semibold">{cfg.label}</h3>
            <button data-testid="btn-export-pdf" onClick={downloadPdf} className="btn btn-outline">
              <FilePdf size={16} weight="duotone" color="#E76F51" /> Export PDF
            </button>
          </div>
          <ReportBody active={active} data={data} />
        </div>
      )}
    </div>
  );
}

function ReportBody({ active, data }) {
  if (active === "laba-rugi") {
    return (
      <table className="tbl">
        <thead><tr><th>Kode</th><th>Nama Akun</th><th className="num">Jumlah</th></tr></thead>
        <tbody>
          <tr><td colSpan={3} className="font-semibold" style={{ background: "#F5F1E8" }}>PENDAPATAN</td></tr>
          {data.pendapatan.map((it) => (<tr key={it.code}><td>{it.code}</td><td>{it.name}</td><td className="num">{fmtRp(it.amount)}</td></tr>))}
          <tr><td></td><td className="font-semibold">Total Pendapatan</td><td className="num font-semibold">{fmtRp(data.total_pendapatan)}</td></tr>
          <tr><td colSpan={3} className="font-semibold" style={{ background: "#F5F1E8" }}>BEBAN</td></tr>
          {data.beban.map((it) => (<tr key={it.code}><td>{it.code}</td><td>{it.name}</td><td className="num">{fmtRp(it.amount)}</td></tr>))}
          <tr><td></td><td className="font-semibold">Total Beban</td><td className="num font-semibold">{fmtRp(data.total_beban)}</td></tr>
          <tr style={{ background: "#D4E09B" }}><td></td><td className="font-bold" style={{ color: "#2E4F32" }}>LABA / (RUGI) BERSIH</td><td className="num font-bold" style={{ color: "#2E4F32" }}>{fmtRp(data.laba_bersih)}</td></tr>
        </tbody>
      </table>
    );
  }
  if (active === "neraca") {
    return (
      <>
        <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>Per: {data.as_of}</p>
        <table className="tbl">
          <thead><tr><th>Kode</th><th>Akun</th><th className="num">Jumlah</th></tr></thead>
          <tbody>
            <tr><td colSpan={3} className="font-semibold" style={{ background: "#F5F1E8" }}>ASET</td></tr>
            {data.aset.map((it, i) => (<tr key={i}><td>{it.code}</td><td>{it.name}</td><td className="num">{fmtRp(it.amount)}</td></tr>))}
            <tr><td></td><td className="font-semibold">Total Aset</td><td className="num font-semibold">{fmtRp(data.total_aset)}</td></tr>
            <tr><td colSpan={3} className="font-semibold" style={{ background: "#F5F1E8" }}>KEWAJIBAN</td></tr>
            {data.kewajiban.map((it, i) => (<tr key={i}><td>{it.code}</td><td>{it.name}</td><td className="num">{fmtRp(it.amount)}</td></tr>))}
            <tr><td></td><td className="font-semibold">Total Kewajiban</td><td className="num font-semibold">{fmtRp(data.total_kewajiban)}</td></tr>
            <tr><td colSpan={3} className="font-semibold" style={{ background: "#F5F1E8" }}>EKUITAS</td></tr>
            {data.ekuitas.map((it, i) => (<tr key={i}><td>{it.code}</td><td>{it.name}</td><td className="num">{fmtRp(it.amount)}</td></tr>))}
            <tr><td></td><td className="font-semibold">Total Ekuitas</td><td className="num font-semibold">{fmtRp(data.total_ekuitas)}</td></tr>
            <tr style={{ background: "#D4E09B" }}><td></td><td className="font-bold">TOTAL PASIVA</td><td className="num font-bold">{fmtRp(data.total_pasiva)}</td></tr>
          </tbody>
        </table>
        <p className="text-xs mt-3" style={{ color: data.balanced ? "#2E4F32" : "#E76F51" }}>
          {data.balanced ? "✓ Neraca seimbang" : "⚠ Neraca belum seimbang — periksa transaksi."}
        </p>
      </>
    );
  }
  if (active === "arus-kas") {
    return (
      <table className="tbl">
        <thead><tr><th>Tanggal</th><th>Keterangan</th><th className="num">Jumlah</th></tr></thead>
        <tbody>
          <tr><td colSpan={3} className="font-semibold" style={{ background: "#F5F1E8" }}>KAS MASUK</td></tr>
          {data.kas_masuk.map((it, i) => (<tr key={i}><td>{it.date}</td><td>{it.description}</td><td className="num">{fmtRp(it.amount)}</td></tr>))}
          <tr><td></td><td className="font-semibold">Total Kas Masuk</td><td className="num font-semibold">{fmtRp(data.total_masuk)}</td></tr>
          <tr><td colSpan={3} className="font-semibold" style={{ background: "#F5F1E8" }}>KAS KELUAR</td></tr>
          {data.kas_keluar.map((it, i) => (<tr key={i}><td>{it.date}</td><td>{it.description}</td><td className="num">{fmtRp(it.amount)}</td></tr>))}
          <tr><td></td><td className="font-semibold">Total Kas Keluar</td><td className="num font-semibold">{fmtRp(data.total_keluar)}</td></tr>
          <tr style={{ background: "#D4E09B" }}><td></td><td className="font-bold">ARUS KAS BERSIH</td><td className="num font-bold">{fmtRp(data.arus_kas_bersih)}</td></tr>
        </tbody>
      </table>
    );
  }
  if (active === "perubahan-ekuitas") {
    return (
      <table className="tbl">
        <thead><tr><th>Uraian</th><th className="num">Jumlah</th></tr></thead>
        <tbody>
          <tr><td>Modal Awal Periode</td><td className="num">{fmtRp(data.modal_awal)}</td></tr>
          <tr><td>Penambahan Modal</td><td className="num">{fmtRp(data.tambahan_modal)}</td></tr>
          <tr><td>Laba/Rugi Bersih Periode Berjalan</td><td className="num">{fmtRp(data.laba_bersih_periode)}</td></tr>
          <tr style={{ background: "#D4E09B" }}><td className="font-bold">MODAL AKHIR PERIODE</td><td className="num font-bold">{fmtRp(data.modal_akhir)}</td></tr>
        </tbody>
      </table>
    );
  }
  if (active === "calk") {
    return (
      <div className="space-y-5 text-sm">
        <section>
          <h4 className="font-heading font-semibold mb-2">1. Informasi Umum</h4>
          <ul className="space-y-1">
            {Object.entries(data.informasi_umum).map(([k, v]) => (
              <li key={k}>• <b>{k.replace(/_/g, " ")}</b>: {v}</li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="font-heading font-semibold mb-2">2. Ringkasan Kinerja</h4>
          <table className="tbl">
            <tbody>
              {Object.entries(data.ringkasan_kinerja).map(([k, v]) => (
                <tr key={k}><td>{k.replace(/_/g, " ")}</td><td className="num">{fmtRp(v)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h4 className="font-heading font-semibold mb-2">3. Kebijakan Akuntansi</h4>
          <ul className="space-y-1">
            {data.kebijakan_akuntansi.map((k, i) => <li key={i}>• {k}</li>)}
          </ul>
        </section>
      </div>
    );
  }
  return null;
}
