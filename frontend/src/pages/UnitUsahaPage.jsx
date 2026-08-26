import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function UnitUsahaPage() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get("/unit-usaha").then(r => setList(r.data)); }, []);
  return (
    <div className="space-y-6" data-testid="unit-page">
      <div>
        <p className="label mb-1">Struktur Usaha</p>
        <h1 className="font-heading text-3xl font-bold">6 Unit Usaha BUMDES</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {list.map((u) => (
          <div key={u.id} className="card" data-testid={`unit-card-${u.code}`}>
            <div className="flex items-start justify-between mb-3">
              <span className="badge">{u.code}</span>
            </div>
            <h3 className="font-heading text-lg font-bold mb-2">{u.name}</h3>
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>{u.description}</p>
            <div className="p-3 rounded-lg text-xs" style={{ background: "#FDFBF7", border: "1px solid var(--border)" }}>
              <div className="label mb-1">Skema Bagi Hasil</div>
              <p style={{ color: "var(--text-primary)" }}>{u.revenue_scheme}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
