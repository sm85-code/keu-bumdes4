import { useEffect, useMemo, useState } from "react";
import api, { fmtRp, ROLE_LABELS } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import { TrendUp, TrendDown, Coin, Storefront, ReceiptX } from "@phosphor-icons/react";

const COLORS = ["#8CA650", "#A8DADC", "#E1C3F4", "#F4A261", "#D4E09B", "#5C6E5E"];
const TOOLTIP_STYLE = { background: "white", border: "1px solid #E8EAE6", borderRadius: 8 };
const PIE_LEGEND_STYLE = { fontSize: 11 };
const yTickFormatter = (v) => (v >= 1e6 ? `${(v/1e6).toFixed(1)}Jt` : v >= 1e3 ? `${(v/1e3).toFixed(0)}rb` : v);

const PERIODS = [
  { key: "bulan", label: "Per Bulan", months: 1 },
  { key: "3bulan", label: "Per 3 Bulan", months: 3 },
  { key: "6bulan", label: "Per 6 Bulan", months: 6 },
  { key: "tahun", label: "Per Tahun", months: 12 },
];

function computeRange(period) {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  if (period === "tahun") {
    const start = `${now.getFullYear()}-01-01`;
    return { start, end };
  }
  const cfg = PERIODS.find(p => p.key === period);
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - (cfg?.months || 12) + 1);
  startDate.setDate(1);
  const start = startDate.toISOString().slice(0, 10);
  return { start, end };
}

const RANGE_LABELS = {
  bulan: "bulan ini",
  "3bulan": "3 bulan terakhir",
  "6bulan": "6 bulan terakhir",
  tahun: "tahun ini",
};

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("tahun");

  useEffect(() => {
    setLoading(true);
    const { start, end } = computeRange(period);
    api.get("/reports/dashboard", { params: { start_date: start, end_date: end } })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [period]);

  const kpis = useMemo(() => data ? [
    { key: "pendapatan", label: "Total Pendapatan", value: data.total_pendapatan, icon: TrendUp, bg: "var(--primary-light)", color: "#2E4F32" },
    { key: "beban", label: "Total Beban", value: data.total_beban, icon: TrendDown, bg: "#FDE9D0", color: "#8a4a1a" },
    { key: "laba", label: "Laba Bersih", value: data.laba_bersih, icon: Coin, bg: "var(--secondary-blue)", color: "#1e4e50" },
    { key: "tx", label: "Jumlah Transaksi", value: data.total_transactions, icon: ReceiptX, bg: "var(--secondary-purple)", color: "#4a2760", isCount: true },
  ] : [], [data]);

  if (loading && !data) return <div className="text-sm">Memuat dashboard...</div>;
  if (!data) return <div className="text-sm">Tidak ada data.</div>;

  const jabatan = ROLE_LABELS[user?.role] || "Pengguna";

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <p className="label mb-1">Selamat Datang</p>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold" data-testid="dashboard-greeting">
          {jabatan}, ini ringkasan {RANGE_LABELS[period]}.
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          BUMDES Karya Raharja • Desa Wonoharjo • {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 flex-wrap" data-testid="period-selector">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
                  data-testid={`period-${p.key}`}
                  className={`btn text-sm ${period === p.key ? "btn-secondary" : "btn-outline"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.key} className="card card-sm" data-testid={`kpi-${k.key}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                  <Icon size={18} weight="duotone" color={k.color} />
                </div>
              </div>
              <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--text-secondary)" }}>{k.label}</p>
              <p className="font-heading text-xl sm:text-2xl font-bold mt-1 tabular-nums">
                {k.isCount ? k.value : fmtRp(k.value)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h3 className="font-heading text-lg font-semibold mb-4">
            Tren Pendapatan & Beban ({RANGE_LABELS[period]})
          </h3>
          {data.monthly?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.monthly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EAE6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={yTickFormatter} />
                <Tooltip formatter={(v) => fmtRp(v)} contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <Line type="monotone" dataKey="pendapatan" name="Pendapatan"
                      stroke="#8CA650" strokeWidth={3}
                      dot={{ fill: "#8CA650", r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="beban" name="Beban"
                      stroke="#F4A261" strokeWidth={3}
                      dot={{ fill: "#F4A261", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm py-16 text-center" style={{ color: "var(--text-muted)" }}>Belum ada transaksi pada periode ini.</p>
          )}
        </div>

        <div className="card">
          <h3 className="font-heading text-lg font-semibold mb-4">Kontribusi Per Unit</h3>
          {data.unit_summaries?.some(u => u.pendapatan > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.unit_summaries.filter(u => u.pendapatan > 0)}
                     dataKey="pendapatan" nameKey="code" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                  {data.unit_summaries.map((u) => <Cell key={u.id} fill={COLORS[data.unit_summaries.indexOf(u) % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtRp(v)} />
                <Legend wrapperStyle={PIE_LEGEND_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm py-16 text-center" style={{ color: "var(--text-muted)" }}>Belum ada data unit.</p>
          )}
        </div>
      </div>

      {/* Unit Summary Table */}
      <div className="card p-0 overflow-hidden">
        <div className="p-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
            <Storefront size={20} weight="duotone" color="#2E4F32" /> Ringkasan 6 Unit Usaha
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl" data-testid="unit-summary-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Unit Usaha</th>
                <th className="num">Pendapatan</th>
                <th className="num">Beban</th>
                <th className="num">Laba Bersih</th>
              </tr>
            </thead>
            <tbody>
              {data.unit_summaries.map((u) => (
                <tr key={u.id}>
                  <td><span className="badge">{u.code}</span></td>
                  <td className="font-medium">{u.name}</td>
                  <td className="num">{fmtRp(u.pendapatan)}</td>
                  <td className="num">{fmtRp(u.beban)}</td>
                  <td className="num font-semibold" style={{ color: u.laba >= 0 ? "#2E4F32" : "#E76F51" }}>{fmtRp(u.laba)}</td>
                </tr>
              ))}
              {data.unit_summaries.length > 0 && (() => {
                const totP = data.unit_summaries.reduce((s, u) => s + (u.pendapatan || 0), 0);
                const totB = data.unit_summaries.reduce((s, u) => s + (u.beban || 0), 0);
                const totL = data.unit_summaries.reduce((s, u) => s + (u.laba || 0), 0);
                return (
                  <tr data-testid="unit-total-row" style={{ background: "#D4E09B" }}>
                    <td></td>
                    <td className="font-bold" style={{ color: "#2E4F32" }}>TOTAL 6 UNIT USAHA</td>
                    <td className="num font-bold tabular-nums" style={{ color: "#2E4F32" }}>{fmtRp(totP)}</td>
                    <td className="num font-bold tabular-nums" style={{ color: "#2E4F32" }}>{fmtRp(totB)}</td>
                    <td className="num font-bold tabular-nums" style={{ color: totL >= 0 ? "#2E4F32" : "#E76F51" }}>{fmtRp(totL)}</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
