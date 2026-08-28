import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { fmtRp, fmtDate, API } from "@/lib/api";
import { useAuth, can } from "@/lib/auth";
import { Plus, Trash, Pencil, Receipt, FileArrowUp } from "@phosphor-icons/react";

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  unit_usaha_id: "",
  transaction_type: "",
  description: "",
  amount: "",
  debit_account_code: "",
  credit_account_code: "",
  reference: "",
};

export default function Transactions() {
  const { user } = useAuth();
  const canWrite = can(user, "admin", "direktur", "bendahara", "pengelola");
  const canImport = can(user, "admin", "direktur", "bendahara");
  const [txs, setTxs] = useState([]);
  const [units, setUnits] = useState([]);
  const [types, setTypes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, u, tt, a] = await Promise.all([
      api.get("/transactions"),
      api.get("/unit-usaha"),
      api.get("/transaction-types"),
      api.get("/accounts"),
    ]);
    setTxs(t.data); setUnits(u.data); setTypes(tt.data); setAccounts(a.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter tx types by selected unit_usaha
  const filteredTypes = useMemo(() => {
    if (!form.unit_usaha_id) return types;
    const unitCode = units.find(u => u.id === form.unit_usaha_id)?.code;
    if (!unitCode) return types;
    return types.filter(t => !t.unit_codes || t.unit_codes.length === 0 || t.unit_codes.includes(unitCode));
  }, [types, form.unit_usaha_id, units]);

  const onTypeChange = (code) => {
    const t = types.find(x => x.code === code);
    setForm(f => ({
      ...f, transaction_type: code,
      debit_account_code: t?.debit || f.debit_account_code,
      credit_account_code: t?.credit || f.credit_account_code,
      description: (editingId ? f.description : t?.name) || f.description,
    }));
  };

  const onUnitChange = (unitId) => {
    setForm(f => {
      const unitCode = units.find(u => u.id === unitId)?.code;
      // reset jenis transaksi jika tidak match dengan unit baru
      const stillOk = !f.transaction_type || types.find(t => t.code === f.transaction_type)
        ?.unit_codes?.includes(unitCode) || types.find(t => t.code === f.transaction_type)?.unit_codes?.length === 0;
      return { ...f, unit_usaha_id: unitId, transaction_type: stillOk ? f.transaction_type : "" };
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setShowForm(true);
  };

  const openEdit = (tx) => {
    setEditingId(tx.id);
    setForm({
      date: tx.date, unit_usaha_id: tx.unit_usaha_id || "",
      transaction_type: tx.transaction_type || "",
      description: tx.description || "", amount: String(tx.amount || 0),
      debit_account_code: tx.debit_account_code || "",
      credit_account_code: tx.credit_account_code || "",
      reference: tx.reference || "",
    });
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const body = { ...form, amount: parseFloat(form.amount) };
      if (editingId) {
        await api.put(`/transactions/${editingId}`, body);
      } else {
        await api.post("/transactions", body);
      }
      setShowForm(false); setEditingId(null);
      load();
    } catch (er) { alert(er.response?.data?.detail || "Gagal menyimpan"); }
  };

  const del = async (id) => {
    if (!window.confirm("Hapus transaksi ini?")) return;
    await api.delete(`/transactions/${id}`);
    load();
  };

  const onImportClick = () => fileInputRef.current?.click();

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const token = localStorage.getItem("bumdes_token");
      const res = await fetch(`${API}/transactions/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { alert(data.detail || "Gagal impor"); return; }
      setImportResult(data);
      load();
    } catch (er) { alert("Gagal impor: " + er.message); }
    finally { e.target.value = ""; }
  };

  const unitName = (id) => units.find(u => u.id === id) || null;
  const accName = (c) => accounts.find(a => a.code === c)?.name || c;
  const canEditRow = (tx) => {
    if (!canWrite) return false;
    if (user.role === "pengelola") return tx.unit_usaha_id === user.unit_usaha_id;
    return true;
  };

  return (
    <div className="space-y-6" data-testid="transactions-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="label mb-1">Buku Kas</p>
          <h1 className="font-heading text-3xl font-bold">Transaksi Keuangan</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Input transaksi cepat — laporan terbentuk otomatis.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canImport && (
            <>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                     data-testid="import-file-input" onChange={onFileChange} />
              <button data-testid="btn-import-excel" onClick={onImportClick} className="btn btn-outline">
                <FileArrowUp size={16} weight="duotone" color="#2E4F32" /> Impor Excel
              </button>
            </>
          )}
          <button data-testid="btn-new-tx" onClick={openCreate}
                  disabled={!canWrite}
                  className={`btn btn-primary ${!canWrite ? "opacity-50 cursor-not-allowed" : ""}`}>
            <Plus size={18} weight="bold" /> Tambah Transaksi
          </button>
        </div>
      </div>

      {importResult && (
        <div className="card fade-in" data-testid="import-result"
             style={{ background: "#F5F1E8", border: "1px solid #D4E09B" }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-heading font-semibold mb-1">Hasil Impor</h4>
              <p className="text-sm">Berhasil: <b>{importResult.inserted}</b> dari <b>{importResult.total_rows}</b> baris.</p>
              {importResult.errors?.length > 0 && (
                <ul className="text-xs mt-2 space-y-0.5" style={{ color: "#8a3225" }}>
                  {importResult.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>Baris {e.row}: {e.error}</li>
                  ))}
                  {importResult.errors.length > 10 && <li>+ {importResult.errors.length - 10} error lainnya</li>}
                </ul>
              )}
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer" style={{ color: "var(--text-secondary)" }}>Format kolom Excel</summary>
                <div className="mt-1" style={{ color: "var(--text-secondary)" }}>
                  Kolom wajib: <b>tanggal</b> (YYYY-MM-DD), <b>jenis_transaksi</b> (code, mis. penerimaan_setoran_ikan), <b>nominal</b>.
                  Kolom opsional: <b>unit_code</b> (UU01..UU06), <b>keterangan</b>, <b>debit</b>, <b>kredit</b>, <b>referensi</b>.
                </div>
              </details>
            </div>
            <button onClick={() => setImportResult(null)} className="btn btn-outline text-xs">Tutup</button>
          </div>
        </div>
      )}

      {showForm && canWrite && (
        <div className="card fade-in">
          <h3 className="font-heading text-lg font-semibold mb-4">
            {editingId ? "Edit Transaksi" : "Transaksi Baru"}
          </h3>
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Tanggal</label>
              <input data-testid="tx-date" type="date" required className="input"
                     value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            {user.role !== "pengelola" && (
              <div>
                <label className="label">Unit Usaha (opsional)</label>
                <select data-testid="tx-unit" className="select" value={form.unit_usaha_id}
                        onChange={(e) => onUnitChange(e.target.value)}>
                  <option value="">— BUMDES (umum) —</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.code} - {u.name}</option>)}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="label">
                Jenis Transaksi
                {form.unit_usaha_id && (
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                    (difilter berdasarkan unit terpilih)
                  </span>
                )}
              </label>
              <select data-testid="tx-type" required className="select" value={form.transaction_type}
                      onChange={(e) => onTypeChange(e.target.value)}>
                <option value="">— pilih jenis —</option>
                {filteredTypes.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Nominal (Rp)</label>
              <input data-testid="tx-amount" type="number" min="0" step="1" required className="input"
                     value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                     placeholder="100000" />
            </div>
            <div>
              <label className="label">Nomor Referensi (opsional)</label>
              <input data-testid="tx-ref" className="input"
                     value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })}
                     placeholder="mis. nota-001" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Keterangan</label>
              <input data-testid="tx-desc" required className="input"
                     value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                     placeholder="Keterangan detail transaksi" />
            </div>
            <div>
              <label className="label">Debit</label>
              <select data-testid="tx-debit" className="select" value={form.debit_account_code}
                      onChange={(e) => setForm({ ...form, debit_account_code: e.target.value })} required>
                <option value="">— pilih akun —</option>
                {accounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Kredit</label>
              <select data-testid="tx-credit" className="select" value={form.credit_account_code}
                      onChange={(e) => setForm({ ...form, credit_account_code: e.target.value })} required>
                <option value="">— pilih akun —</option>
                {accounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="btn btn-outline">Batal</button>
              <button data-testid="tx-save" type="submit" className="btn btn-primary">
                {editingId ? "Simpan Perubahan" : "Simpan Transaksi"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tbl" data-testid="tx-table">
            <thead>
              <tr>
                <th>Tanggal</th><th>Unit</th><th>Keterangan</th>
                <th>Debit</th><th>Kredit</th><th className="num">Jumlah</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8">Memuat...</td></tr>
              ) : txs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10">
                  <Receipt size={32} weight="duotone" color="#8A9A8C" style={{ margin: "0 auto 8px" }} />
                  <div style={{ color: "var(--text-muted)" }}>Belum ada transaksi.</div>
                </td></tr>
              ) : txs.map((t) => (
                <tr key={t.id}>
                  <td>{fmtDate(t.date)}</td>
                  <td>{t.unit_usaha_id ? <span className="badge">{unitName(t.unit_usaha_id)?.code}</span> : <span className="badge badge-blue">BUMDES</span>}</td>
                  <td className="max-w-xs truncate">{t.description}</td>
                  <td className="text-xs">{accName(t.debit_account_code)}</td>
                  <td className="text-xs">{accName(t.credit_account_code)}</td>
                  <td className="num font-semibold tabular-nums">{fmtRp(t.amount)}</td>
                  {canWrite && (
                    <td>
                      <div className="flex gap-1">
                        {canEditRow(t) && (
                          <button data-testid={`edit-tx-${t.id}`} onClick={() => openEdit(t)}
                                  className="p-1.5 rounded-md hover:bg-yellow-50" title="Edit">
                            <Pencil size={16} color="#8a4a1a" />
                          </button>
                        )}
                        {can(user, "admin", "direktur", "bendahara") && (
                          <button data-testid={`del-tx-${t.id}`} onClick={() => del(t.id)}
                                  className="p-1.5 rounded-md hover:bg-red-50" title="Hapus">
                            <Trash size={16} color="#E76F51" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
