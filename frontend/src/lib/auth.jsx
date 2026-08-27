import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bumdes_user") || "null"); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("bumdes_token");
    if (!t) { setLoading(false); return; }
    api.get("/auth/me").then((r) => {
      setUser(r.data);
      localStorage.setItem("bumdes_user", JSON.stringify(r.data));
    }).catch(() => {
      localStorage.removeItem("bumdes_token");
      localStorage.removeItem("bumdes_user");
      setUser(null);
    }).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const r = await api.post("/auth/login", { username, password });
    localStorage.setItem("bumdes_token", r.data.access_token);
    localStorage.setItem("bumdes_user", JSON.stringify(r.data.user));
    setUser(r.data.user);
    return r.data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("bumdes_token");
    localStorage.removeItem("bumdes_user");
    setUser(null);
    window.location.href = "/login";
  }, []);

  const value = useMemo(() => ({ user, login, logout, loading }), [user, login, logout, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export const can = (user, ...roles) => user && roles.includes(user.role);
