import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useAuth, can } from "@/lib/auth";
import { Plus, Pencil, Trash } from "@phosphor-icons/react";

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

const emptyAcc = { code: "", name: "", category: "aset", subcategory: "aset_lancar", normal_balance: "debit", parent_code: "" };
const emptyTT = { code: "", name: "", debit: "", credit: "", unit_codes: [] };

export default function COAPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canAdd = can(user, "admin", "direktur", "bendahara");

  const [list, setList] = useState([]);
  const [types, setTypes] = useState([]);
  const [units, setUnits] = useState([]);
  const [filter, setFilter] = useState("");

  // Account form state
  const [showAcc, setShowAcc] = useState(false);
  const [editAccCode, setEditAccCode] = useState(null);
  const [accForm, setAccForm] = useState(emptyAcc);
  const [accErr, setAccErr] = useState("");

  // Transaction type form state
  const [showTT, setShowTT] = useState(false);
  const [editTTCode, setEditTTCode] = useState(null);
  const [ttForm, setTtForm] = useState(emptyTT);
  const [ttErr, setTtErr] = useState("");

  const load = useCallback(async () => {
    const [a, t, u] = await Promise.all([
      api.get("/accounts"), api.get("/transaction-types"), api.get("/unit-usaha"),
    ]);
    setList(a.data); setTypes(t.data); setUnits(u.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const onCatChange = (cat) => setAccForm(f => ({
    ...f, category: cat,
    subcategory: SUBCATEGORIES[cat][0],
    normal_balance: DEFAULT_NB[cat],
  }));

  const openCreateAcc = () => { setEditAccCode(null); setAccForm(emptyAcc); setAccErr(""); setShowAcc(true); };
  const openEditAcc = (a) => {
    setEditAccCode(a.code);
    setAccForm({
      code: a.code, name: a.name, category: a.category,
      subcategory: a.subcategory || SUBCATEGORIES[a.category][0],
      normal_balance: a.normal_balance, parent_code: a.parent_code || "",
    });
    setAccErr(""); setShowAcc(true);
  };

  const submitAcc = async (e) => {
    e.preventDefault(); setAccErr("");
    try {
      const body = {
        code: accForm.code.trim(), name: accForm.name.trim(),
        category: accForm.category, subcategory: accForm.subcategory,
        normal_balance: accForm.normal_balance, parent_code: accForm.parent_code || null,
      };
      if (editAccCode) await api.put(`/accounts/${encodeURIComponent(editAccCode)}`, body);
      else await api.post("/accounts", body);
      setShowAcc(false); setEditAccCode(null); load();
    } catch (ex) { setAccErr(ex.response?.data?.detail || "Gagal menyimpan"); }
  };

  const delAcc = async (code) => {
    if (!window.confirm(`Hapus kode akun ${code}?`)) return;
    try {
      await api.delete(`/accounts/${encodeURIComponent(code)}`);
      load();
    } catch (ex) { alert(ex.response?.data?.detail || "Gagal hapus"); }
  };

  const openCreateTT = () => { setEditTTCode(null); setTtForm(emptyTT); setTtErr(""); setShowTT(true); };
  const openEditTT = (t) => {
    setEditTTCode(t.code);
    setTtForm({
      code: t.code, name: t.name, debit: t.debit || "", credit: t.credit || "",
      unit_codes: t.unit_codes || [],
    });
    setTtErr(""); setShowTT(true);
  };

  const toggleTTUnit = (code) => {
    setTtForm(f => ({
      ...f,
      unit_codes: f.unit_codes.includes(code)
        ? f.unit_codes.filter(c => c !== code)
        : [...f.unit_codes, code],
    }));
  };

  const submitTT = async (e) => {
    e.preventDefault(); setTtErr("");
    try {
      const body = {
        code: ttForm.code.trim(), name: ttForm.name.trim(),
        debit: ttForm.debit, credit: ttForm.credit,
        unit_codes: ttForm.unit_codes,
      };
      if (editTTCode) await api.put(`/transaction-types/${encodeURIComponent(editTTCode)}`, body);
      else await api.post("/transaction-types", body);
      setShowTT(false); setEditTTCode(null); load();
    } catch (ex) { setTtErr(ex.response?.data?.detail || "Gagal menyimpan"); }
  };

  const delTT = async (code) => {
    if (!window.confirm(`Hapus jenis transaksi ${code}?`)) return;
    try {
      await api.delete(`/transaction-types/${encodeURIComponent(code)}`);
      load();
    } catch (ex) { alert(ex.response?.data?.detail || "Gagal hapus"); }
  };

  const filtered = useMemo(
    () => (filter ? list.filter(a => a.category === filter) : list),
    [list, filter]
  );

  const unitName = (code) => units.find(u => u.code === code)?.name || code;

  return (
    <div className="space-y-6" data-testid="coa-page">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <p className="label mb-1">Chart of Accounts</p>
          <h1 className="font-heading text-3xl font-bold">Kode Akun & Jenis Transaksi</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Sesuai Kepmendesa PDTT No. 136/2022, disesuaikan untuk 6 unit usaha BUMDES.
          </p>
        </div>
        {canAdd && (
          <button data-testid="btn-new-account" onClick={openCreateAcc} className="btn btn-primary">
            <Plus size={16} /> Tambah Kode Akun
          </button>
        )}
      </div>

      {showAcc && canAdd && (
        <div className="card fade-in">
          <h3 className="font-heading text-lg font-semibold mb-4">
            {editAccCode ? `Edit Kode Akun (${editAccCode})` : "Kode Akun Baru"}
          </h3>
          <form onSubmit={submitAcc} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Kode Akun</label>
              <input data-testid="acc-code" required className="input"
                     value={accForm.code} onChange={(e) => setAccForm({ ...accForm, code: e.target.value })} /></div>
            <div><label className="label">Nama Akun</label>
              <input data-testid="acc-name" required className="input"
                     value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} /></div>
            <div><label className="label">Kategori</label>
              <select data-testid="acc-category" className="select" value={accForm.category}
                      onChange={(e) => onCatChange(e.target.value)}>
                {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className="label">Sub-Kategori</label>
              <select data-testid="acc-subcategory" className="select" value={accForm.subcategory}
                      onChange={(e) => setAccForm({ ...accForm, subcategory: e.target.value })}>
                {SUBCATEGORIES[accForm.category].map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select></div>
            <div><label className="label">Saldo Normal</label>
              <select data-testid="acc-normal-balance" className="select" value={accForm.normal_balance}
                      onChange={(e) => setAccForm({ ...accForm, normal_balance: e.target.value })}>
                <option value="debit">Debit</option><option value="kredit">Kredit</option>
              </select></div>
            <div><label className="label">Akun Induk (opsional)</label>
              <select className="select" value={accForm.parent_code}
                      onChange={(e) => setAccForm({ ...accForm, parent_code: e.target.value })}>
                <option value="">— tanpa —</option>
                {list.filter(a => a.category === accForm.category && a.code !== editAccCode)
                     .map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
              </select></div>
            {accErr && <div className="sm:col-span-2 text-sm p-3 rounded-lg"
                            style={{ background: "#FDECEA", color: "#8a3225", border: "1px solid #f5c6c1" }}>{accErr}</div>}
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAcc(false)} className="btn btn-outline">Batal</button>
              <button data-testid="acc-save" className="btn btn-primary">Simpan</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {[["", "Semua"], ...Object.entries(CAT_LABELS)].map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)}
                  className={`btn ${filter === k ? "btn-secondary" : "btn-outline"} text-sm`}>{v}</button>
        ))}
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="tbl" data-testid="coa-table">
          <thead>
            <tr><th>Kode</th><th>Nama Akun</th><th>Kategori</th><th>Sub</th><th>Saldo Normal</th>
              {isAdmin && <th></th>}</tr>
          </thead>
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
                {isAdmin && (
                  <td>
                    <div className="flex gap-1">
                      <button data-testid={`edit-acc-${a.code}`} onClick={() => openEditAcc(a)}
                              className="p-1.5 rounded-md hover:bg-yellow-50" title="Edit">
                        <Pencil size={16} color="#8a4a1a" />
                      </button>
                      <button data-testid={`del-acc-${a.code}`} onClick={() => delAcc(a.code)}
                              className="p-1.5 rounded-md hover:bg-red-50" title="Hapus">
                        <Trash size={16} color="#E76F51" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============ JENIS TRANSAKSI TABLE ============ */}
      <div className="flex justify-between items-center gap-4 flex-wrap pt-4">
        <div>
          <h2 className="font-heading text-2xl font-bold">Jenis Transaksi</h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Pemetaan jenis transaksi ke unit usaha yang relevan.
          </p>
        </div>
        {isAdmin && (
          <button data-testid="btn-new-tt" onClick={openCreateTT} className="btn btn-primary">
            <Plus size={16} /> Tambah Jenis Transaksi
          </button>
        )}
      </div>

      {showTT && isAdmin && (
        <div className="card fade-in">
          <h3 className="font-heading text-lg font-semibold mb-4">
            {editTTCode ? `Edit Jenis Transaksi (${editTTCode})` : "Jenis Transaksi Baru"}
          </h3>
          <form onSubmit={submitTT} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Kode</label>
              <input data-testid="tt-code" required className="input"
                     placeholder="mis. penjualan_kios"
                     value={ttForm.code} onChange={(e) => setTtForm({ ...ttForm, code: e.target.value })} /></div>
            <div><label className="label">Nama Transaksi</label>
              <input data-testid="tt-name" required className="input"
                     value={ttForm.name} onChange={(e) => setTtForm({ ...ttForm, name: e.target.value })} /></div>
            <div><label className="label">Akun Debit (default)</label>
              <select data-testid="tt-debit" required className="select" value={ttForm.debit}
                      onChange={(e) => setTtForm({ ...ttForm, debit: e.target.value })}>
                <option value="">— pilih akun —</option>
                {list.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
              </select></div>
            <div><label className="label">Akun Kredit (default)</label>
              <select data-testid="tt-credit" required className="select" value={ttForm.credit}
                      onChange={(e) => setTtForm({ ...ttForm, credit: e.target.value })}>
                <option value="">— pilih akun —</option>
                {list.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
              </select></div>
            <div className="sm:col-span-2">
              <label className="label">Berlaku untuk Unit Usaha (bisa lebih dari satu, atau kosongkan = umum)</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {units.map(u => (
                  <label key={u.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer"
                         style={{
                           background: ttForm.unit_codes.includes(u.code) ? "var(--primary-light)" : "var(--bg)",
                           border: "1px solid var(--border)",
                         }}>
                    <input type="checkbox" data-testid={`tt-unit-${u.code}`}
                           checked={ttForm.unit_codes.includes(u.code)}
                           onChange={() => toggleTTUnit(u.code)} />
                    <span className="text-sm font-medium">{u.code} - {u.name}</span>
                  </label>
                ))}
              </div>
            </div>
            {ttErr && <div className="sm:col-span-2 text-sm p-3 rounded-lg"
                           style={{ background: "#FDECEA", color: "#8a3225" }}>{ttErr}</div>}
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowTT(false)} className="btn btn-outline">Batal</button>
              <button data-testid="tt-save" className="btn btn-primary">Simpan</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-x-auto">
        <table className="tbl" data-testid="tt-table">
          <thead>
            <tr>
              <th>Nama Transaksi</th>
              <th>Nama Unit Usaha</th>
              <th>Debit / Kredit</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {types.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-6" style={{ color: "var(--text-muted)" }}>Belum ada jenis transaksi.</td></tr>
            ) : types.map(t => (
              <tr key={t.code}>
                <td>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{t.code}</div>
                </td>
                <td>
                  {t.unit_codes && t.unit_codes.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {t.unit_codes.map(uc => (
                        <span key={uc} className="badge" title={unitName(uc)}>{uc}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="badge badge-blue">Umum (BUMDES)</span>
                  )}
                </td>
                <td className="text-xs">
                  <div>D: {t.debit}</div>
                  <div>K: {t.credit}</div>
                </td>
                {isAdmin && (
                  <td>
                    <div className="flex gap-1">
                      <button data-testid={`edit-tt-${t.code}`} onClick={() => openEditTT(t)}
                              className="p-1.5 rounded-md hover:bg-yellow-50" title="Edit">
                        <Pencil size={16} color="#8a4a1a" />
                      </button>
                      <button data-testid={`del-tt-${t.code}`} onClick={() => delTT(t.code)}
                              className="p-1.5 rounded-md hover:bg-red-50" title="Hapus">
                        <Trash size={16} color="#E76F51" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
