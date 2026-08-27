import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth, can } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/api";
import {
  House, Receipt, ChartLine, ChartBar, Storefront, UsersThree,
  BookOpenText, SignOut, List, X, HandCoins, Books, Calculator,
} from "@phosphor-icons/react";

const READ_ONLY = ["admin", "direktur", "bendahara", "pengawas", "penasihat"];
const READ_MOST = ["admin", "direktur", "bendahara", "pengelola", "pengawas", "penasihat"];

const NAV = [
  { to: "/", label: "Dashboard", icon: House, roles: READ_MOST },
  { to: "/transactions", label: "Transaksi", icon: Receipt, roles: READ_MOST },
  { to: "/reports", label: "Laporan Keuangan", icon: ChartLine, roles: READ_ONLY },
  { to: "/reports/per-unit", label: "Laporan Per Unit", icon: ChartBar, roles: READ_MOST },
  { to: "/revenue-share", label: "Bagi Hasil 30/70", icon: HandCoins, roles: READ_ONLY },
  { to: "/unit-usaha", label: "Unit Usaha", icon: Storefront, roles: READ_MOST },
  { to: "/mitra", label: "Data Mitra", icon: UsersThree, roles: READ_MOST },
  { to: "/accounts", label: "Kode Akun (COA)", icon: Books, roles: READ_ONLY },
  { to: "/users", label: "Kelola Pengguna", icon: UsersThree, roles: ["admin"] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (!user) return null;
  const visible = NAV.filter(n => can(user, ...n.roles));

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14"
           style={{ background: "white", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--primary-light)" }}>
            <Calculator size={18} weight="duotone" color="#2E4F32" />
          </div>
          <span className="font-heading font-bold text-sm">BUMDES Karya Waharja</span>
        </div>
        <button data-testid="mobile-menu-btn" onClick={() => setOpen(!open)} className="p-2">
          {open ? <X size={22} /> : <List size={22} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className={`fixed lg:sticky top-0 left-0 h-screen w-72 z-30 transform transition-transform lg:transform-none ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ background: "white", borderRight: "1px solid var(--border)" }}
      >
        <div className="p-6 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "var(--primary-light)" }}>
            <Calculator size={24} weight="duotone" color="#2E4F32" />
          </div>
          <div>
            <div className="font-heading font-bold text-base leading-tight">BUMDES</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>Karya Waharja</div>
          </div>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          {visible.map((n) => {
            const Icon = n.icon;
            const active = location.pathname === n.to;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                data-testid={`nav-${n.to.replace(/\//g, "-")}`}
                onClick={() => setOpen(false)}
                className={`side-link ${active ? "active" : ""}`}
              >
                <Icon size={20} weight={active ? "fill" : "regular"} />
                <span>{n.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="absolute bottom-0 inset-x-0 p-4" style={{ borderTop: "1px solid var(--border)", background: "white" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-heading font-bold text-sm"
                 style={{ background: "var(--secondary-blue)", color: "#1e4e50" }}>
              {user.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{user.name}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{ROLE_LABELS[user.role]}</div>
            </div>
          </div>
          <button data-testid="logout-btn" onClick={logout} className="btn btn-outline w-full text-sm">
            <SignOut size={16} /> Keluar
          </button>
        </div>
      </aside>

      {open && <div className="lg:hidden fixed inset-0 z-20 bg-black/30" onClick={() => setOpen(false)} />}

      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
