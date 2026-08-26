import { useEffect, useState } from "react";
import api, { fmtRp } from "@/lib/api";
import { Plus, HandCoins } from "@phosphor-icons/react";

export default function RevenueShare() {
  const [list, setList] = useState([]);
  const [units, setUnits] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    period: new Date().toISOString().slice(0, 7),
    unit_usaha_id: "",
    gross_revenue: "",
    operational_cost: "",
  });

  const load = async () => {
    const [r, u] = await Promise.all([api.get("/revenue-share"), api.get("/unit-usaha")]);
    setList(r.data); setUnits(u.data);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/revenue-share", {
      period: form.period, unit_usaha_id: form.unit_usaha_id,
      gross_revenue: parseFloat(form.gross_revenue),
      operational_cost: parseFloat(form.operational_cost || 0),
    });
    setShow(false); load();
  };

  const preview = (form.gross_revenue && !isNaN(form.gross_revenue)) ? {
    net: (parseFloat(form.gross_revenue) - parseFloat(form.operational_cost || 0)),
    mgr: (parseFloat(form.gross_revenue) - parseFloat(form.operational_cost || 0)) * 0.3,
    bumdes: (parseFloat(form.gross_revenue) - parseFloat(form.operational_cost || 0)) * 0.7,
  } : null;

  return (
    <div className="space-y-6" data-testid="revshare-page">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <p className="label mb-1">Bagi Hasil 30 / 70</p>
          <h1 className="font-heading text-3xl font-bold">Kalkulasi Bagi Hasil Pengelola</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            30% pengelola, 70% BUMDES — otomatis setelah dikurangi biaya operasional.
          </p>
        </div>
        <button data-testid="btn-new-rs" onClick={() => setShow(true)} className="btn btn-primary">
          <Plus size={18} /> Hitung Bagi Hasil
        </button>
      </div>

      {show && (
        <div className="card fade-in">
          <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
            <HandCoins size={20} weight="duotone" color="#2E4F32" /> Kalkulator Bagi Hasil
          </h3>
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Periode (YYYY-MM)</label>
              <input type="month" required className="input" value={form.period}
                     onChange={(e) => setForm({ ...form, period: e.target.value })} />
            </div>
            <div>
              <label className="label">Unit Usaha</label>
              <select className="select" required value={form.unit_usaha_id}
                      onChange={(e) => setForm({ ...form, unit_usaha_id: e.target.value })}>
                <option value="">— pilih unit —</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.code} - {u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Pendapatan Kotor (Rp)</label>
              <input type="number" required className="input" value={form.gross_revenue}
                     onChange={(e) => setForm({ ...form, gross_revenue: e.target.value })} />
            </div>
            <div>
              <label className="label">Biaya Operasional (Rp)</label>
              <input type="number" className="input" value={form.operational_cost}
                     onChange={(e) => setForm({ ...form, operational_cost: e.target.value })} placeholder="0" />
            </div>
            {preview && (
              <div className="sm:col-span-2 p-4 rounded-lg" style={{ background: "#FDFBF7", border: "1px solid var(--border)" }}>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><div className="label">Laba Bersih</div><div className="font-heading font-bold">{fmtRp(preview.net)}</div></div>
                  <div><div className="label">30% Pengelola</div><div className="font-heading font-bold" style={{ color: "#4a2760" }}>{fmtRp(preview.mgr)}</div></div>
                  <div><div className="label">70% BUMDES</div><div className="font-heading font-bold" style={{ color: "#2E4F32" }}>{fmtRp(preview.bumdes)}</div></div>
                </div>
              </div>
            )}
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShow(false)} className="btn btn-outline">Batal</button>
              <button type="submit" className="btn btn-primary">Simpan Perhitungan</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-hidden overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Periode</th><th>Unit</th>
              <th className="num">Pendapatan</th><th className="num">Op. Cost</th>
              <th className="num">Laba Bersih</th>
              <th className="num">30% Pengelola</th><th className="num">70% BUMDES</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: "var(--text-muted)" }}>Belum ada perhitungan.</td></tr>
            ) : list.map(rs => {
              const unit = units.find(u => u.id === rs.unit_usaha_id);
              return (
                <tr key={rs.id}>
                  <td className="font-medium">{rs.period}</td>
                  <td>{unit ? <span className="badge">{unit.code}</span> : "-"}</td>
                  <td className="num">{fmtRp(rs.gross_revenue)}</td>
                  <td className="num">{fmtRp(rs.operational_cost)}</td>
                  <td className="num font-semibold">{fmtRp(rs.net_revenue)}</td>
                  <td className="num" style={{ color: "#4a2760" }}>{fmtRp(rs.manager_share)}</td>
                  <td className="num font-semibold" style={{ color: "#2E4F32" }}>{fmtRp(rs.bumdes_share)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
