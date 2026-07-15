"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatFCFA } from "@/lib/utils/format";
import { createBrowserClient } from "@/lib/supabase/client";

interface ChartItem {
  month: string;
  revenue: number;
}

export default function RevenueChart() {
  const [mounted, setMounted] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [chartData, setChartData] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);

    const fetchRevenues = async () => {
      setLoading(true);
      try {
        const supabase = createBrowserClient();
        const { data: entries, error } = await supabase
          .schema("nafaflow")
          .from("cash_entries")
          .select("amount, entry_date")
          .eq("type", "in");

        if (error) throw error;

        // Group and sum by month for the last 12 months
        const today = new Date();
        interface MonthsListItem {
          key: string;
          label: string;
          revenue: number;
        }
        const monthsList: MonthsListItem[] = [];
        const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jui", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

        for (let i = 11; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const mName = monthNames[d.getMonth()];
          monthsList.push({ key: mKey, label: mName, revenue: 0 });
        }

        if (entries) {
          entries.forEach((e) => {
            const date = e.entry_date || "";
            const amount = Number(e.amount) || 0;
            const monthKey = date.slice(0, 7); // "YYYY-MM"
            const match = monthsList.find((m) => m.key === monthKey);
            if (match) {
              match.revenue += amount;
            }
          });
        }

        // Toujours les vraies données de l'organisation (zéros si aucune écriture).
        setChartData(monthsList.map((m) => ({ month: m.label, revenue: m.revenue })));
      } catch (err) {
        console.error("Error loading revenue chart:", err);
        setChartData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRevenues();
  }, []);

  if (!mounted || loading) {
    return (
      <Card className="bg-white border-slate-100 shadow-sm w-full h-[400px] flex items-center justify-center">
        <span className="text-slate-400 font-medium text-sm animate-pulse">Chargement des graphiques...</span>
      </Card>
    );
  }

  const hasRevenue = chartData.some((d) => d.revenue > 0);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-slate-100 text-xs flex flex-col gap-1">
          <p className="font-semibold text-slate-400">{"Chiffre d'Affaires"}</p>
          <p className="font-bold text-slate-800 tabular-nums">{formatFCFA(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-white border-slate-100 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-bold text-slate-800">{"Chiffre d'Affaires"}</CardTitle>
        <CardDescription className="text-xs text-slate-400">
          {"Chiffre d'affaires mensuel sur les 12 derniers mois"}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-1 md:p-6 pt-0">
        {!hasRevenue ? (
          <div className="h-[320px] w-full flex flex-col items-center justify-center text-center gap-2 text-slate-400">
            <p className="text-sm font-semibold text-slate-500">Aucun chiffre d&apos;affaires enregistré</p>
            <p className="text-[11px] max-w-xs">Vos encaissements apparaîtront ici au fur et à mesure que vous enregistrez des paiements.</p>
          </div>
        ) : (
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              onMouseMove={(state) => {
                if (typeof state.activeTooltipIndex === "number") {
                  setHoveredIndex(state.activeTooltipIndex);
                } else {
                  setHoveredIndex(null);
                }
              }}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value / 1000000}M`}
                dx={-10}
              />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={hoveredIndex === index ? "#15803D" : "#16A34A"}
                    className="transition-colors duration-200"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
