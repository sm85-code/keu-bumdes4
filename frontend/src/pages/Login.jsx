import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Calculator, Eye, EyeSlash, SignIn } from "@phosphor-icons/react";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      await login(username.trim(), password);
      nav("/");
    } catch (er) {
      setErr(er.response?.data?.detail || "Login gagal");
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-in">
        <div className="text-center mb-6">
          <div className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-3"
               style={{ background: "white", boxShadow: "0 4px 20px rgba(46,79,50,0.15)" }}>
            <Calculator size={34} weight="duotone" color="#2E4F32" />
          </div>
          <h1 className="font-heading text-3xl font-bold" style={{ color: "#1A2E1E" }}>
            BUMDES Karya Raharja
          </h1>
          <p className="text-sm mt-1" style={{ color: "#2E4F32" }}>
            Sistem Laporan Keuangan • Desa Wonoharjo
          </p>
        </div>

        <div className="card">
          <h2 className="font-heading text-xl font-semibold mb-1">Masuk ke Akun</h2>
          <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
            Silakan gunakan username & password Anda.
          </p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Username / Email</label>
              <input
                data-testid="login-username"
                className="input" value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="mis. admin"
                autoFocus required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  data-testid="login-password"
                  className="input pr-10" type={showPw ? "text" : "password"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required
                />
                <button type="button" data-testid="toggle-password"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: "var(--text-muted)" }}>
                  {showPw ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {err && (
              <div data-testid="login-error" className="text-sm p-3 rounded-lg"
                   style={{ background: "#FDECEA", color: "#8a3225", border: "1px solid #f5c6c1" }}>
                {err}
              </div>
            )}
            <button data-testid="login-submit" disabled={loading} className="btn btn-primary w-full">
              <SignIn size={18} weight="bold" />
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-5" style={{ color: "#2E4F32" }}>
          Kepmendesa PDTT No. 136 Tahun 2022
        </p>
      </div>
    </div>
  );
}
