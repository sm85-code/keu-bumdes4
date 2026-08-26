import { useEffect, useState } from "react";
import api, { fmtRp } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Plus, Trash } from "@phosphor-icons/react";

export default function MitraPage() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [units, setUnits] = useState([]);
  const [filter, setFilter] = useState("");
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ unit_usaha_id: "", name: "", mitra_type: "", phone: "", address: "", modal: 0 });

  const load = async () => {
    const [m, u] = await Promise.all([api.get("/mitra", { params: filter ? { unit_usaha_id: filter } : {} }), api.get("/unit-usaha")]);
    setList(m.data); setUnits(u.data);
  };
  useEffect(() => { load(); }, [filter]);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/mitra", { ...form, modal: parseFloat(form.modal || 0) });
    setShow(false); setForm({ unit_usaha_id: "", name: "", mitra_type: "", phone: "", address: "", modal: 0 });
    load();
  };

  const del = async (id) => { if (window.confirm("Hapus mitra?")) { await api.delete(`/mitra/${id}`); load(); } };

  const canDel = ["admin", "direktur", "bendahara"].includes(user.role);

  return (
    <div className="space-y-6" data-testid="mitra-page">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div><p className="label mb-1">Kemitraan</p><h1 className="font-heading text-3xl font-bold">Data Mitra Usaha</h1></div>
        <button data-testid="btn-new-mitra" onClick={() => setShow(true)} className="btn btn-primary"><Plus size={16} /> Tambah Mitra</button>
      </div>

      <div className="card p-4">
        <label className="label">Filter Unit</label>
        <select className="select max-w-md" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Semua unit</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.code} - {u.name}</option>)}
        </select>
      </div>

      {show && (
        <div className="card fade-in">
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Unit Usaha</label>
              <select className="select" required value={form.unit_usaha_id} onChange={(e) => setForm({ ...form, unit_usaha_id: e.target.value })}>
                <option value="">— pilih —</option>{units.map(u => <option key={u.id} value={u.id}>{u.code} - {u.name}</option>)}
              </select></div>
            <div><label className="label">Nama Mitra</label><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Jenis</label><input className="input" placeholder="peternak_domba / tukang_kayu / dll" value={form.mitra_type} onChange={(e) => setForm({ ...form, mitra_type: e.target.value })} /></div>
            <div><label className="label">HP</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="label">Alamat</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><label className="label">Modal Dititipkan (Rp)</label><input type="number" className="input" value={form.modal} onChange={(e) => setForm({ ...form, modal: e.target.value })} /></div>
            <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setShow(false)} className="btn btn-outline">Batal</button><button className="btn btn-primary">Simpan</button></div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Nama</th><th>Unit</th><th>Jenis</th><th>HP</th><th className="num">Modal</th>{canDel && <th></th>}</tr></thead>
          <tbody>
            {list.length === 0 ? <tr><td colSpan={6} className="text-center py-8" style={{ color: "var(--text-muted)" }}>Belum ada mitra.</td></tr>
              : list.map(m => (
                <tr key={m.id}>
                  <td className="font-medium">{m.name}</td>
                  <td><span className="badge">{units.find(u => u.id === m.unit_usaha_id)?.code || "-"}</span></td>
                  <td>{m.mitra_type || "-"}</td>
                  <td>{m.phone || "-"}</td>
                  <td className="num">{fmtRp(m.modal)}</td>
                  {canDel && <td><button onClick={() => del(m.id)} className="p-1.5"><Trash size={16} color="#E76F51" /></button></td>}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
