import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth, can } from "@/lib/auth";
import { Plus } from "@phosphor-icons/react";

const CAT_LABELS = {
  aset: "Aset", kewajiban: "Kewajiban", ekuitas: "Ekuitas", pendapatan: "Pendapatan", beban: "Beban",
};

const SUBCATEGORIES = {
  aset: ["aset_lancar", "aset_tetap"],
  kewajiban: ["kewajiban_jangka_pendek", "kewajiban_jangka_panjang"],
  ekuitas: ["modal", "saldo_laba"],
  pendapatan: ["pendapatan_operasional", "pendapatan_non_operasional"],
  beban: ["beban_operasional", "beban_administrasi", "beban_lain_lain"],
};

const DEFAULT_NB = { aset: "debit", kewajiban: "kredit", ekuitas: "kredit", pendapatan: "kredit", beban: "debit" };

export default function COAPage() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    code: "", name: "", category: "aset", subcategory: "aset_lancar",
    normal_balance: "debit", parent_code: "",
  });

  const load = async () => {
    const r = await api.get("/accounts");
    setList(r.data);
  };
  useEffect(() => { load(); }, []);

  const canAdd = can(user, "admin", "direktur", "bendahara");

  const onCatChange = (cat) => {
    setForm(f => ({
      ...f, category: cat,
      subcategory: SUBCATEGORIES[cat][0],
      normal_balance: DEFAULT_NB[cat],
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setSaving(true);
    try {
      await api.post("/accounts", {
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category,
        subcategory: form.subcategory,
        normal_balance: form.normal_balance,
        parent_code: form.parent_code || null,
      });
      setShow(false);
      setForm({ code: "", name: "", category: "aset", subcategory: "aset_lancar", normal_balance: "debit", parent_code: "" });
      load();
    } catch (ex) {
      setErr(ex.response?.data?.detail || "Gagal menyimpan akun");
    } finally { setSaving(false); }
  };

  const filtered = filter ? list.filter(a => a.category === filter) : list;

  return (
    <div className="space-y-6" data-testid="coa-page">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <p className="label mb-1">Chart of Accounts</p>
          <h1 className="font-heading text-3xl font-bold">Kode Akun Keuangan</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Sesuai Kepmendesa PDTT No. 136/2022, disesuaikan untuk 6 unit usaha BUMDES.
          </p>
        </div>
        {canAdd && (
          <button data-testid="btn-new-account" onClick={() => setShow(true)} className="btn btn-primary">
            <Plus size={16} /> Tambah Kode Akun
          </button>
        )}
      </div>

      {show && canAdd && (
        <div className="card fade-in">
          <h3 className="font-heading text-lg font-semibold mb-4">Kode Akun Baru</h3>
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Kode Akun</label>
              <input data-testid="acc-code" required className="input"
                     placeholder="mis. 1-1111"
                     value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <label className="label">Nama Akun</label>
              <input data-testid="acc-name" required className="input"
                     placeholder="mis. Kas Kecil Toko Offline"
                     value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Kategori</label>
              <select data-testid="acc-category" className="select" value={form.category}
                      onChange={(e) => onCatChange(e.target.value)}>
                {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sub-Kategori</label>
              <select data-testid="acc-subcategory" className="select" value={form.subcategory}
                      onChange={(e) => setForm({ ...form, subcategory: e.target.value })}>
                {SUBCATEGORIES[form.category].map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Saldo Normal</label>
              <select data-testid="acc-normal-balance" className="select" value={form.normal_balance}
                      onChange={(e) => setForm({ ...form, normal_balance: e.target.value })}>
                <option value="debit">Debit</option>
                <option value="kredit">Kredit</option>
              </select>
            </div>
            <div>
              <label className="label">Akun Induk (opsional)</label>
              <select data-testid="acc-parent" className="select" value={form.parent_code}
                      onChange={(e) => setForm({ ...form, parent_code: e.target.value })}>
                <option value="">— tanpa akun induk —</option>
                {list.filter(a => a.category === form.category).map(a => (
                  <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>
            {err && (
              <div data-testid="acc-error" className="sm:col-span-2 text-sm p-3 rounded-lg"
                   style={{ background: "#FDECEA", color: "#8a3225", border: "1px solid #f5c6c1" }}>{err}</div>
            )}
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShow(false); setErr(""); }} className="btn btn-outline">Batal</button>
              <button data-testid="acc-save" type="submit" disabled={saving} className="btn btn-primary">
                {saving ? "Menyimpan..." : "Simpan Akun"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {[["", "Semua"], ...Object.entries(CAT_LABELS)].map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)} data-testid={`coa-filter-${k || "all"}`}
                  className={`btn ${filter === k ? "btn-secondary" : "btn-outline"} text-sm`}>{v}</button>
        ))}
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="tbl" data-testid="coa-table">
          <thead><tr><th>Kode</th><th>Nama Akun</th><th>Kategori</th><th>Sub</th><th>Saldo Normal</th></tr></thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.code}>
                <td className="font-mono font-semibold">{a.code}</td>
                <td>{a.name}</td>
                <td><span className="badge">{CAT_LABELS[a.category]}</span></td>
                <td className="text-xs">{a.subcategory}</td>
                <td>{a.normal_balance === "debit"
                  ? <span className="badge badge-blue">Debit</span>
                  : <span className="badge badge-purple">Kredit</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
