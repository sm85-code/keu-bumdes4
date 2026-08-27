import { useCallback, useEffect, useState } from "react";
import api, { ROLE_LABELS } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Plus, Trash, Eye, EyeSlash, Key } from "@phosphor-icons/react";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin Utama" },
  { value: "direktur", label: "Direktur" },
  { value: "bendahara", label: "Bendahara" },
  { value: "pengelola", label: "Pengelola Unit" },
  { value: "pengawas", label: "Pengawas (read-only)" },
  { value: "penasihat", label: "Penasihat (read-only)" },
];

const ROLE_BADGE = {
  admin: "", direktur: "badge-purple", bendahara: "badge-blue",
  pengelola: "badge-warn", pengawas: "badge-blue", penasihat: "badge-purple",
};

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [units, setUnits] = useState([]);
  const [show, setShow] = useState(false);
  const [showResetFor, setShowResetFor] = useState(null); // user id
  const [newPw, setNewPw] = useState("");
  const [revealAll, setRevealAll] = useState(false);
  const [reveal, setReveal] = useState({}); // {userId: true}
  const [form, setForm] = useState({
    username: "", email: "", name: "", password: "", role: "pengelola", unit_usaha_id: "",
  });

  const load = useCallback(async () => {
    const [u, un] = await Promise.all([api.get("/users"), api.get("/unit-usaha")]);
    setUsers(u.data); setUnits(un.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/register", {
        ...form, unit_usaha_id: form.role === "pengelola" ? form.unit_usaha_id : null,
      });
      setShow(false);
      setForm({ username: "", email: "", name: "", password: "", role: "pengelola", unit_usaha_id: "" });
      load();
    } catch (er) { alert(er.response?.data?.detail || "Gagal"); }
  };

  const del = async (id) => {
    if (!window.confirm("Hapus pengguna?")) return;
    await api.delete(`/users/${id}`);
    load();
  };

  const resetPw = async (e) => {
    e.preventDefault();
    if (newPw.length < 6) { alert("Password minimal 6 karakter"); return; }
    try {
      await api.post(`/users/${showResetFor}/reset-password`, { new_password: newPw });
      setShowResetFor(null); setNewPw("");
      load();
      alert("Password berhasil direset.");
    } catch (er) { alert(er.response?.data?.detail || "Gagal reset"); }
  };

  const isAdmin = user.role === "admin";

  if (!isAdmin) {
    return (
      <div data-testid="users-page-forbidden" className="card">
        <h2 className="font-heading text-xl font-bold">Akses Ditolak</h2>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
          Hanya Admin Utama yang berwenang melihat dan mengelola pengguna.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <p className="label mb-1">Manajemen Akses (Admin Utama)</p>
          <h1 className="font-heading text-3xl font-bold">Kelola Pengguna</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Password ditampilkan untuk bantuan pemulihan akses. Simpan halaman ini secara rahasia.
          </p>
        </div>
        <div className="flex gap-2">
          <button data-testid="btn-toggle-reveal" onClick={() => setRevealAll(!revealAll)} className="btn btn-outline">
            {revealAll ? <EyeSlash size={16} /> : <Eye size={16} />}
            {revealAll ? "Sembunyikan Password" : "Tampilkan Password"}
          </button>
          <button data-testid="btn-new-user" onClick={() => setShow(true)} className="btn btn-primary">
            <Plus size={16} /> Tambah Pengguna
          </button>
        </div>
      </div>

      {show && (
        <div className="card fade-in">
          <h3 className="font-heading text-lg font-semibold mb-4">Tambah Pengguna Baru</h3>
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Nama Lengkap</label>
              <input required className="input" value={form.name}
                     onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Username</label>
              <input required className="input" value={form.username}
                     onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            <div><label className="label">Email</label>
              <input type="email" required className="input" value={form.email}
                     onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Password</label>
              <input type="text" required minLength={6} className="input" value={form.password}
                     onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min. 6 karakter" /></div>
            <div><label className="label">Role</label>
              <select required className="select" value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select></div>
            {form.role === "pengelola" && (
              <div><label className="label">Unit Usaha</label>
                <select required className="select" value={form.unit_usaha_id}
                        onChange={(e) => setForm({ ...form, unit_usaha_id: e.target.value })}>
                  <option value="">— pilih unit —</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.code} - {u.name}</option>)}
                </select></div>
            )}
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShow(false)} className="btn btn-outline">Batal</button>
              <button data-testid="btn-save-user" className="btn btn-primary">Simpan</button>
            </div>
          </form>
        </div>
      )}

      {showResetFor && (
        <div className="card fade-in" data-testid="reset-pw-form">
          <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
            <Key size={20} weight="duotone" color="#2E4F32" /> Reset Password
          </h3>
          <form onSubmit={resetPw} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Password Baru</label>
              <input data-testid="reset-pw-input" type="text" required minLength={6} className="input"
                     value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="min. 6 karakter" />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => { setShowResetFor(null); setNewPw(""); }} className="btn btn-outline">Batal</button>
              <button data-testid="btn-confirm-reset" className="btn btn-primary">Reset & Simpan</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-x-auto">
        <table className="tbl" data-testid="users-table">
          <thead>
            <tr>
              <th>Nama</th><th>Username</th><th>Email</th>
              <th>Password</th>
              <th>Role</th><th>Unit</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const shown = revealAll || reveal[u.id];
              return (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}</td>
                  <td>{u.username}</td>
                  <td className="text-xs">{u.email}</td>
                  <td className="font-mono text-xs">
                    <span data-testid={`pw-${u.id}`}>{shown ? (u.plain_password || "—") : "••••••••"}</span>
                    <button onClick={() => setReveal({ ...reveal, [u.id]: !reveal[u.id] })}
                            className="ml-2 p-1 align-middle" title={shown ? "Sembunyikan" : "Lihat"}>
                      {shown ? <EyeSlash size={14} /> : <Eye size={14} />}
                    </button>
                  </td>
                  <td>
                    <span className={`badge ${ROLE_BADGE[u.role] || ""}`}>{ROLE_LABELS[u.role] || u.role}</span>
                  </td>
                  <td className="text-xs">{units.find(x => x.id === u.unit_usaha_id)?.code || "-"}</td>
                  <td>
                    <div className="flex gap-1">
                      <button data-testid={`btn-reset-${u.id}`} onClick={() => setShowResetFor(u.id)}
                              className="p-1.5 rounded-md hover:bg-yellow-50" title="Reset Password">
                        <Key size={16} color="#8a4a1a" />
                      </button>
                      {u.id !== user.id && (
                        <button data-testid={`btn-del-${u.id}`} onClick={() => del(u.id)}
                                className="p-1.5 rounded-md hover:bg-red-50" title="Hapus">
                          <Trash size={16} color="#E76F51" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
