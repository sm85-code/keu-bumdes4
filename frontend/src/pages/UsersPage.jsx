import { useEffect, useState } from "react";
import api, { ROLE_LABELS } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Plus, Trash } from "@phosphor-icons/react";

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [units, setUnits] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    username: "", email: "", name: "", password: "", role: "pengelola", unit_usaha_id: "",
  });

  const load = async () => {
    const [u, un] = await Promise.all([api.get("/users"), api.get("/unit-usaha")]);
    setUsers(u.data); setUnits(un.data);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/register", { ...form, unit_usaha_id: form.role === "pengelola" ? form.unit_usaha_id : null });
      setShow(false);
      setForm({ username: "", email: "", name: "", password: "", role: "pengelola", unit_usaha_id: "" });
      load();
    } catch (er) { alert(er.response?.data?.detail || "Gagal"); }
  };

  const del = async (id) => { if (window.confirm("Hapus pengguna?")) { await api.delete(`/users/${id}`); load(); } };

  const isAdmin = user.role === "admin";

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div><p className="label mb-1">Manajemen Akses</p><h1 className="font-heading text-3xl font-bold">Kelola Pengguna</h1></div>
        {isAdmin && <button data-testid="btn-new-user" onClick={() => setShow(true)} className="btn btn-primary"><Plus size={16} /> Tambah Pengguna</button>}
      </div>

      {show && isAdmin && (
        <div className="card fade-in">
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Nama Lengkap</label><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Username</label><input required className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            <div><label className="label">Email</label><input type="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Password</label><input type="password" required minLength={6} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div><label className="label">Role</label>
              <select required className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="admin">Admin Utama</option>
                <option value="direktur">Direktur</option>
                <option value="bendahara">Bendahara</option>
                <option value="pengelola">Pengelola Unit</option>
              </select></div>
            {form.role === "pengelola" && (
              <div><label className="label">Unit Usaha</label>
                <select required className="select" value={form.unit_usaha_id} onChange={(e) => setForm({ ...form, unit_usaha_id: e.target.value })}>
                  <option value="">— pilih unit —</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.code} - {u.name}</option>)}
                </select></div>
            )}
            <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setShow(false)} className="btn btn-outline">Batal</button><button data-testid="btn-save-user" className="btn btn-primary">Simpan</button></div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Nama</th><th>Username</th><th>Email</th><th>Role</th><th>Unit</th>{isAdmin && <th></th>}</tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td>{u.username}</td>
                <td className="text-xs">{u.email}</td>
                <td><span className={`badge ${u.role === "admin" ? "" : u.role === "direktur" ? "badge-purple" : u.role === "bendahara" ? "badge-blue" : "badge-warn"}`}>{ROLE_LABELS[u.role]}</span></td>
                <td className="text-xs">{units.find(x => x.id === u.unit_usaha_id)?.code || "-"}</td>
                {isAdmin && <td>{u.id !== user.id && <button onClick={() => del(u.id)} className="p-1.5"><Trash size={16} color="#E76F51" /></button>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
