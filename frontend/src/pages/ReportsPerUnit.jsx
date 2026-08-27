import { useCallback, useEffect, useState } from "react";
import api, { fmtRp, API } from "@/lib/api";
import { FilePdf } from "@phosphor-icons/react";

const today = new Date().toISOString().slice(0, 10);
const startOfYear = today.slice(0, 4) + "-01-01";

export default function ReportsPerUnit() {
  const [start, setStart] = useState(startOfYear);
  const [end, setEnd] = useState(today);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    const r = await api.get("/reports/per-unit", { params: { start_date: start, end_date: end } });
    setData(r.data);
  }, [start, end]);

  useEffect(() => { load(); }, [load]);

  const downloadPdf = async () => {
    const token = localStorage.getItem("bumdes_token");
    const res = await fetch(`${API}/reports/per-unit/pdf?start_date=${start}&end_date=${end}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Laporan-Per-Unit_${start}_sd_${end}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="per-unit-page">
      <div>
        <p className="label mb-1">Laporan</p>
        <h1 className="font-heading text-3xl font-bold">Kinerja Per Unit Usaha</h1>
      </div>
      <div className="card grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div><label className="label">Dari</label><input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div><label className="label">Sampai</label><input type="date" className="input" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        <div className="flex gap-2">
          <button onClick={load} className="btn btn-primary flex-1">Terapkan</button>
          <button onClick={downloadPdf} className="btn btn-outline"><FilePdf size={16} color="#E76F51" /> PDF</button>
        </div>
      </div>
      {data && (
        <div className="card p-0 overflow-hidden overflow-x-auto">
          <table className="tbl" data-testid="per-unit-table">
            <thead>
              <tr>
                <th>Kode</th><th>Unit Usaha</th>
                <th className="num">Pendapatan</th><th className="num">Beban</th>
                <th className="num">Laba Bersih</th>
                <th className="num">30% Pengelola</th><th className="num">70% BUMDES</th>
              </tr>
            </thead>
            <tbody>
              {data.units.map(u => (
                <tr key={u.id}>
                  <td><span className="badge">{u.code}</span></td>
                  <td className="font-medium">{u.name}</td>
                  <td className="num">{fmtRp(u.pendapatan)}</td>
                  <td className="num">{fmtRp(u.beban)}</td>
                  <td className="num font-semibold" style={{ color: u.laba_bersih >= 0 ? "#2E4F32" : "#E76F51" }}>{fmtRp(u.laba_bersih)}</td>
                  <td className="num" style={{ color: "#4a2760" }}>{fmtRp(u.share_pengelola_30)}</td>
                  <td className="num" style={{ color: "#1e4e50" }}>{fmtRp(u.share_bumdes_70)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
