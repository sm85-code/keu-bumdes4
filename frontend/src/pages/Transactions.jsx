import { useCallback, useEffect, useState } from "react";
import api, { fmtRp, fmtDate } from "@/lib/api";
import { useAuth, can } from "@/lib/auth";
import { Plus, Trash, Receipt } from "@phosphor-icons/react";

export default function Transactions() {
  const { user } = useAuth();
  const canWrite = can(user, "admin", "direktur", "bendahara", "pengelola");
  const [txs, setTxs] = useState([]);
  const [units, setUnits] = useState([]);
  const [types, setTypes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    unit_usaha_id: "",
    transaction_type: "",
    description: "",
    amount: "",
    debit_account_code: "",
    credit_account_code: "",
    reference: "",
  });

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

  const onTypeChange = (code) => {
    const t = types.find(x => x.code === code);
    setForm(f => ({
      ...f, transaction_type: code,
      debit_account_code: t?.debit || f.debit_account_code,
      credit_account_code: t?.credit || f.credit_account_code,
      description: t?.name || f.description,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/transactions", { ...form, amount: parseFloat(form.amount) });
      setShowForm(false);
      setForm({ ...form, transaction_type: "", description: "", amount: "", reference: "" });
      load();
    } catch (er) {
      alert(er.response?.data?.detail || "Gagal menyimpan");
    }
  };

  const del = async (id) => {
    if (!window.confirm("Hapus transaksi ini?")) return;
    await api.delete(`/transactions/${id}`);
    load();
  };

  const unitName = (id) => units.find(u => u.id === id)?.name || "-";
  const accName = (c) => accounts.find(a => a.code === c)?.name || c;

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
        <button data-testid="btn-new-tx" onClick={() => setShowForm(true)}
                disabled={!canWrite}
                className={`btn btn-primary ${!canWrite ? "opacity-50 cursor-not-allowed" : ""}`}
                title={canWrite ? "" : "Read-only role"}>
          <Plus size={18} weight="bold" /> Tambah Transaksi
        </button>
      </div>

      {showForm && canWrite && (
        <div className="card fade-in">
          <h3 className="font-heading text-lg font-semibold mb-4">Transaksi Baru</h3>
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
                        onChange={(e) => setForm({ ...form, unit_usaha_id: e.target.value })}>
                  <option value="">— BUMDES (umum) —</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.code} - {u.name}</option>)}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="label">Jenis Transaksi</label>
              <select data-testid="tx-type" required className="select" value={form.transaction_type}
                      onChange={(e) => onTypeChange(e.target.value)}>
                <option value="">— pilih jenis —</option>
                {types.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
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
              <label className="label">Debit (Auto)</label>
              <select data-testid="tx-debit" className="select" value={form.debit_account_code}
                      onChange={(e) => setForm({ ...form, debit_account_code: e.target.value })} required>
                <option value="">— pilih akun —</option>
                {accounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Kredit (Auto)</label>
              <select data-testid="tx-credit" className="select" value={form.credit_account_code}
                      onChange={(e) => setForm({ ...form, credit_account_code: e.target.value })} required>
                <option value="">— pilih akun —</option>
                {accounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline">Batal</button>
              <button data-testid="tx-save" type="submit" className="btn btn-primary">Simpan Transaksi</button>
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
                {can(user, "admin", "direktur", "bendahara") && <th></th>}
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
                  <td>{t.unit_usaha_id ? <span className="badge">{units.find(u=>u.id===t.unit_usaha_id)?.code}</span> : <span className="badge badge-blue">BUMDES</span>}</td>
                  <td className="max-w-xs truncate">{t.description}</td>
                  <td className="text-xs">{accName(t.debit_account_code)}</td>
                  <td className="text-xs">{accName(t.credit_account_code)}</td>
                  <td className="num font-semibold tabular-nums">{fmtRp(t.amount)}</td>
                  {can(user, "admin", "direktur", "bendahara") && (
                    <td>
                      <button data-testid={`del-tx-${t.id}`} onClick={() => del(t.id)}
                              className="p-1.5 rounded-md hover:bg-red-50" title="Hapus">
                        <Trash size={16} color="#E76F51" />
                      </button>
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
