import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Reports from "@/pages/Reports";
import ReportsPerUnit from "@/pages/ReportsPerUnit";
import RevenueShare from "@/pages/RevenueShare";
import UnitUsahaPage from "@/pages/UnitUsahaPage";
import MitraPage from "@/pages/MitraPage";
import COAPage from "@/pages/COAPage";
import UsersPage from "@/pages/UsersPage";

const ROLES_REPORTS = ["admin", "direktur", "bendahara"];
const ROLES_REVSHARE = ["admin", "direktur", "bendahara"];
const ROLES_COA = ["admin", "direktur", "bendahara"];
const ROLES_USERS = ["admin", "direktur"];

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/transactions" element={<Protected><Transactions /></Protected>} />
            <Route path="/reports" element={<Protected roles={ROLES_REPORTS}><Reports /></Protected>} />
            <Route path="/reports/per-unit" element={<Protected><ReportsPerUnit /></Protected>} />
            <Route path="/revenue-share" element={<Protected roles={ROLES_REVSHARE}><RevenueShare /></Protected>} />
            <Route path="/unit-usaha" element={<Protected><UnitUsahaPage /></Protected>} />
            <Route path="/mitra" element={<Protected><MitraPage /></Protected>} />
            <Route path="/accounts" element={<Protected roles={ROLES_COA}><COAPage /></Protected>} />
            <Route path="/users" element={<Protected roles={ROLES_USERS}><UsersPage /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
