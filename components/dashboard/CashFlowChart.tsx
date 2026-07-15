"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatFCFA } from "@/lib/utils/format";
import { createBrowserClient } from "@/lib/supabase/client";

interface ProjectionItem {
  week: string;
  cashIn: number;
  cashOut: number;
  balance: number;
}

export default function CashFlowChart() {
  const [mounted, setMounted] = useState(false);
  const [chartData, setChartData] = useState<ProjectionItem[]>([]);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);

    const calculateProjections = async () => {
      setLoading(true);
      try {
        const supabase = createBrowserClient();

        // 1. Calculate current cash balance
        const { data: cashEntries, error: cashErr } = await supabase
          .schema("nafaflow")
          .from("cash_entries")
          .select("amount, type");

        if (cashErr) throw cashErr;

        let currentBalance = 0;
        if (cashEntries) {
          cashEntries.forEach((e) => {
            const amount = Number(e.amount) || 0;
            if (e.type === "in") currentBalance += amount;
            else if (e.type === "out") currentBalance -= amount;
          });
        }

        // 2. Fetch unpaid invoices to predict cash inflows
        const { data: invoices, error: invErr } = await supabase
          .schema("nafaflow")
          .from("invoices")
          .select("total, status, due_date")
          .not("status", "eq", "paid")
          .not("status", "eq", "draft");

        if (invErr) throw invErr;

        // 2b. Charges fixes hebdomadaires dérivées des charges mensuelles déclarées
        const { data: fixedCosts } = await supabase
          .schema("nafaflow")
          .from("fixed_costs")
          .select("amount, periodicity, active")
          .eq("active", true);

        let monthlyCharges = 0;
        (fixedCosts || []).forEach((fc) => {
          const amount = Number(fc.amount) || 0;
          const p = (fc.periodicity || "monthly").toLowerCase();
          if (p.startsWith("year") || p.startsWith("annu")) monthlyCharges += amount / 12;
          else if (p.startsWith("quart") || p.startsWith("trim")) monthlyCharges += amount / 3;
          else monthlyCharges += amount;
        });
        const weeklyCharges = Math.round(monthlyCharges / 4.33);

        // 3. Setup 12 weekly projection periods
        const today = new Date();
        const projectionList: ProjectionItem[] = [];

        for (let w = 1; w <= 12; w++) {
          projectionList.push({
            week: `S${String(w).padStart(2, "0")}`,
            cashIn: 0,
            cashOut: weeklyCharges,
            balance: 0,
          });
        }

        // 4. Map invoices to their target week slot
        if (invoices) {
          invoices.forEach((inv) => {
            if (!inv.due_date) return;
            const dueDate = new Date(inv.due_date);
            const diffTime = dueDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // Map days diff to week slot (0 to 11)
            let targetWeek = Math.floor(diffDays / 7);
            if (targetWeek < 0) targetWeek = 0; // Overdue invoices mapped to current week
            if (targetWeek > 11) targetWeek = 11; // Caps forecast to Week 12
            
            projectionList[targetWeek].cashIn += Number(inv.total) || 0;
          });
        }

        // 5. Calculate running cumulative balance
        let runningBalance = currentBalance;
        projectionList.forEach((weekProj) => {
          runningBalance = runningBalance + weekProj.cashIn - weekProj.cashOut;
          weekProj.balance = runningBalance;
        });

        // 6. Vraies projections de l'organisation (pas de données de démo)
        const totalInflows = projectionList.reduce((sum, w) => sum + w.cashIn, 0);
        const hasAny = (cashEntries && cashEntries.length > 0) || totalInflows > 0 || weeklyCharges > 0;
        setChartData(projectionList);
        setHasData(!!hasAny);
      } catch (err) {
        console.error("Error calculating cash flow projections:", err);
        setChartData([]);
        setHasData(false);
      } finally {
        setLoading(false);
      }
    };

    calculateProjections();
  }, []);

  if (!mounted || loading) {
    return (
      <Card className="bg-white border-slate-100 shadow-sm w-full h-[400px] flex items-center justify-center">
        <span className="text-slate-400 font-medium text-sm animate-pulse">Chargement de la projection...</span>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; color?: string; name?: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-xl border border-slate-100 flex flex-col gap-1.5 text-xs text-slate-700">
          <p className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-1">Semaine {label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="font-bold text-slate-900 tabular-nums">{formatFCFA(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-white border-slate-100 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">Projection de Trésorerie</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              {"Flux prévisionnel d'encaissements et décaissements sur 12 semaines"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold bg-slate-50/50 border border-slate-100/80 rounded-lg px-2.5 py-1 mt-1 sm:mt-0">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" /> Encaissements
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-[#F43F5E]" /> Décaissements
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-[#64748B]" /> Solde Projeté
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-1 md:p-6 pt-0">
        {!hasData ? (
          <div className="h-[320px] w-full flex flex-col items-center justify-center text-center gap-2 text-slate-400">
            <p className="text-sm font-semibold text-slate-500">Pas encore de projection</p>
            <p className="text-[11px] max-w-xs">Créez des factures et enregistrez vos charges pour visualiser vos flux de trésorerie sur 12 semaines.</p>
          </div>
        ) : (
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="week"
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
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }} />
              
              <Area
                name="Encaissements"
                type="monotone"
                dataKey="cashIn"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorIn)"
              />
              <Area
                name="Décaissements"
                type="monotone"
                dataKey="cashOut"
                stroke="#f43f5e"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#colorOut)"
              />
              <Area
                name="Solde tréso"
                type="monotone"
                dataKey="balance"
                stroke="#64748b"
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="none"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
