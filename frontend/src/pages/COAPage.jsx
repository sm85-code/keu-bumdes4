import { useEffect, useState } from "react";
import api from "@/lib/api";

const CAT_LABELS = {
  aset: "Aset", kewajiban: "Kewajiban", ekuitas: "Ekuitas", pendapatan: "Pendapatan", beban: "Beban",
};

export default function COAPage() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("");
  useEffect(() => { api.get("/accounts").then(r => setList(r.data)); }, []);

  const filtered = filter ? list.filter(a => a.category === filter) : list;

  return (
    <div className="space-y-6" data-testid="coa-page">
      <div>
        <p className="label mb-1">Chart of Accounts</p>
        <h1 className="font-heading text-3xl font-bold">Kode Akun Keuangan</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Sesuai Kepmendesa PDTT No. 136/2022, disesuaikan untuk 6 unit usaha BUMDES.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[["", "Semua"], ...Object.entries(CAT_LABELS)].map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)} data-testid={`coa-filter-${k || "all"}`}
                  className={`btn ${filter === k ? "btn-secondary" : "btn-outline"} text-sm`}>{v}</button>
        ))}
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="tbl" data-testid="coa-table">
          <thead><tr><th>Kode</th><th>Nama Akun</th><th>Kategori</th><th>Sub</th><th>Saldo Normal</th></tr></thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.code}>
                <td className="font-mono font-semibold">{a.code}</td>
                <td>{a.name}</td>
                <td><span className="badge">{CAT_LABELS[a.category]}</span></td>
                <td className="text-xs">{a.subcategory}</td>
                <td>{a.normal_balance === "debit" ? <span className="badge badge-blue">Debit</span> : <span className="badge badge-purple">Kredit</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
