"use client";

import { useState } from "react";
import PLMonthlyTable from "@/components/pl/PLMonthlyTable";
import { Calendar } from "lucide-react";

export default function PLPage() {
  // Dynamically generate the last 12 months starting from the current month
  const months = Array.from({ length: 12 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);
    return {
      key: `${year}-${month}`,
      label: capitalizedLabel,
    };
  });

  const [selectedMonth, setSelectedMonth] = useState(months[0].key);

  return (
    <div className="space-y-6">
      {/* Page Header with selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Compte de Résultat (P&L)</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            {"Analysez votre rentabilité mensuelle, structure de coûts et marge d'exploitation"}
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
          <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent border-0 outline-none text-xs font-semibold text-slate-600 focus:ring-0 focus:outline-none"
          >
            {months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Income Statement Table and KPIs */}
      <PLMonthlyTable monthKey={selectedMonth} />
    </div>
  );
}
