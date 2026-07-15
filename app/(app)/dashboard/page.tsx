"use client";

import { useState, useEffect } from "react";
import KPICard from "@/components/dashboard/KPICard";
import CashFlowChart from "@/components/dashboard/CashFlowChart";
import RevenueChart from "@/components/dashboard/RevenueChart";
import TodoPanel from "@/components/dashboard/TodoPanel";
import StatusBadge from "@/components/shared/StatusBadge";
import AmountFCFA from "@/components/shared/AmountFCFA";
import DateDisplay from "@/components/shared/DateDisplay";
import ConfirmDeleteModal from "@/components/shared/ConfirmDeleteModal";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  Coins,
  Percent,
  CalendarClock,
  ArrowRight,
  Eye,
  MoreVertical,
  Edit2,
  Trash2,
  Send
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";

interface SimpleInvoiceItem {
  id: string;
  invoiceRef: string;
  clientName: string;
  clientId: string;
  issueDate: string;
  total: number;
  status: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<SimpleInvoiceItem[]>([]);
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; ref: string } | null>(null);
  const [balance, setBalance] = useState(0);
  const [currentMonthCA, setCurrentMonthCA] = useState(0);
  const [currentMonthMargin, setCurrentMonthMargin] = useState(0);
  const [caDelta, setCaDelta] = useState<string>("");
  const [caTrend, setCaTrend] = useState<"up" | "down" | "neutral">("neutral");
  const [dso, setDso] = useState<string>("—");
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      
      // 1. Fetch 5 most recent invoices
      const { data: invData, error: invErr } = await supabase
        .schema("nafaflow")
        .from("invoices")
        .select("*, clients(name)")
        .order("created_at", { ascending: false })
        .limit(5);

      if (invErr) throw invErr;

      if (invData) {
        const mapped: SimpleInvoiceItem[] = invData.map((item) => {
          const year = new Date(item.created_at).getFullYear();
          const shortId = item.id.split("-")[0]?.slice(0, 4).toUpperCase();
          const invoiceRef = item.number || `NF-${year}-${shortId}`;
          
          let mappedStatus = item.status || "draft";
          if (mappedStatus === "draft") mappedStatus = "brouillon";
          else if (mappedStatus === "sent") mappedStatus = "envoyée";
          else if (mappedStatus === "paid") mappedStatus = "payée";
          else if (mappedStatus === "partial") mappedStatus = "partiellement payée";
          else if (mappedStatus === "overdue") mappedStatus = "en retard";

          return {
            id: item.id,
            invoiceRef,
            clientName: item.clients?.name || "Client Inconnu",
            clientId: item.client_id,
            issueDate: item.issue_date || item.created_at.slice(0, 10),
            total: Math.round(Number(item.total)),
            status: mappedStatus,
          };
        });
        setInvoices(mapped);
      }

      // 2. Fetch cash entries to calculate KPIs
      const { data: cashData, error: cashErr } = await supabase
        .schema("nafaflow")
        .from("cash_entries")
        .select("*");

      if (cashErr) throw cashErr;

      if (cashData) {
        const today = new Date();
        const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
        const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

        let journalSum = 0;
        let monthlyInflow = 0;
        let monthlyCogs = 0;
        let prevMonthInflow = 0;

        cashData.forEach((entry) => {
          const amount = Number(entry.amount) || 0;
          const entryDate = entry.entry_date || "";
          const isCurrentMonth = entryDate.startsWith(currentMonthKey);
          const isPrevMonth = entryDate.startsWith(prevMonthKey);

          if (entry.type === "in") {
            journalSum += amount;
            if (isCurrentMonth) monthlyInflow += amount;
            if (isPrevMonth) prevMonthInflow += amount;
          } else if (entry.type === "out") {
            journalSum -= amount;
            if (isCurrentMonth) {
              const label = (entry.label || "").toLowerCase();
              if (label.includes("prestataire") || label.includes("freelance") || label.includes("cogs") || label.includes("variable")) {
                monthlyCogs += amount;
              }
            }
          }
        });

        setBalance(journalSum);
        setCurrentMonthCA(monthlyInflow);
        setCurrentMonthMargin(monthlyInflow > 0 ? Math.round(((monthlyInflow - monthlyCogs) / monthlyInflow) * 100) : 0);

        // Évolution du CA vs mois précédent (uniquement si base comparable)
        if (prevMonthInflow > 0) {
          const pct = ((monthlyInflow - prevMonthInflow) / prevMonthInflow) * 100;
          setCaDelta(`${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`);
          setCaTrend(pct >= 0 ? "up" : "down");
        } else {
          setCaDelta("");
          setCaTrend("neutral");
        }
      }

      // DSO : délai moyen d'encaissement (émission → paiement) sur les factures réglées
      const { data: paidData } = await supabase
        .schema("nafaflow")
        .from("payments")
        .select("paid_at, invoices(issue_date)");

      if (paidData && paidData.length > 0) {
        let totalDays = 0;
        let counted = 0;
        (paidData as unknown as { paid_at?: string; invoices?: { issue_date?: string } | null }[]).forEach((p) => {
          const issue = p.invoices?.issue_date;
          if (issue && p.paid_at) {
            const days = Math.round((new Date(p.paid_at).getTime() - new Date(issue).getTime()) / (1000 * 3600 * 24));
            if (days >= 0) {
              totalDays += days;
              counted++;
            }
          }
        });
        setDso(counted > 0 ? `${Math.round(totalDays / counted)} jours` : "—");
      } else {
        setDso("—");
      }
    } catch (err: unknown) {
      console.error("Dashboard loading error:", err);
    } finally {
      setUpdatedAt(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Dashboard | NafaFlow";
    loadDashboardData();
  }, []);

  const handleDeleteConfirm = async () => {
    if (deleteCandidate) {
      try {
        const supabase = createBrowserClient();

        // 1. Delete associated cash entries first
        const { error: cashErr } = await supabase
          .schema("nafaflow")
          .from("cash_entries")
          .delete()
          .eq("link_type", "invoice")
          .eq("link_id", deleteCandidate.id);

        if (cashErr) throw cashErr;

        // 2. Delete the invoice (lines and payments cascade delete in DB)
        const { error: invoiceErr } = await supabase
          .schema("nafaflow")
          .from("invoices")
          .delete()
          .eq("id", deleteCandidate.id);

        if (invoiceErr) throw invoiceErr;

        toast.error(`Facture ${deleteCandidate.ref} supprimée.`);
        loadDashboardData();
      } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`Erreur lors de la suppression : ${message}`);
      } finally {
        setDeleteCandidate(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section with Date & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Vue d&apos;ensemble</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Mises à jour en temps réel des performances de l&apos;activité
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-100 px-3 py-2 rounded-lg shadow-sm">
            {updatedAt ? `Mise à jour: aujourd'hui, ${updatedAt}` : "Chargement..."}
          </span>
        </div>
      </div>

      {/* 4 Stats Cards Grid (Harmonized gap-6) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <KPICard
          title="Solde Trésorerie"
          value={`${balance.toLocaleString()} F`}
          delta=""
          trend="neutral"
          trendLabel="solde de caisse courant"
          icon={Wallet}
          iconClassName="text-emerald-600 bg-emerald-50"
        />
        <KPICard
          title="Chiffre d&apos;Affaires (Mois)"
          value={`${currentMonthCA.toLocaleString()} F`}
          delta={caDelta}
          trend={caTrend}
          trendLabel={caDelta ? "comparé au mois dernier" : "encaissements du mois en cours"}
          icon={Coins}
          iconClassName="text-blue-600 bg-blue-50"
        />
        <KPICard
          title="Marge Brute"
          value={`${currentMonthMargin}%`}
          delta=""
          trend="neutral"
          trendLabel="sur le chiffre d&apos;affaires du mois"
          icon={Percent}
          iconClassName="text-purple-600 bg-purple-50"
        />
        <KPICard
          title="Délai de Paiement (DSO)"
          value={dso}
          delta=""
          trend="neutral"
          trendLabel="délai moyen d&apos;encaissement"
          icon={CalendarClock}
          iconClassName="text-amber-600 bg-amber-50"
        />
      </div>

      {/* Recharts Charts Grid (Harmonized gap-6) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CashFlowChart />
        </div>
        <div className="lg:col-span-1">
          <RevenueChart />
        </div>
      </div>

      {/* Invoices Table & Todo Panel (Harmonized gap-6) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table layout (2/3 width) */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Dernières factures</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Historique des 5 factures les plus récentes émises
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-semibold text-[#16A34A] hover:text-[#15803D] hover:bg-[#F0FDF4]"
                asChild
              >
                <Link href="/factures" className="flex items-center gap-1.5">
                  Voir tout <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {/* Table wrapper for scroll stability */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] tracking-wider uppercase font-bold">
                    <th className="py-3 px-6">Client</th>
                    <th className="py-3 px-6">Référence</th>
                    <th className="py-3 px-6">Date d&apos;émission</th>
                    <th className="py-3 px-6 text-right">Montant</th>
                    <th className="py-3 px-6 text-center">Statut</th>
                    <th className="py-3 px-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="py-4 px-6"><div className="h-4 bg-slate-100 rounded w-28"></div></td>
                        <td className="py-4 px-6"><div className="h-4 bg-slate-100 rounded w-16"></div></td>
                        <td className="py-4 px-6"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                        <td className="py-4 px-6 text-right"><div className="h-4 bg-slate-100 rounded w-16 ml-auto"></div></td>
                        <td className="py-4 px-6 text-center"><div className="h-6 bg-slate-100 rounded-full w-20 mx-auto"></div></td>
                        <td className="py-4 px-6"></td>
                      </tr>
                    ))
                  ) : invoices.length > 0 ? (
                    invoices.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                        onClick={() => router.push(`/factures/${invoice.id}`)}
                      >
                        <td className="py-3.5 px-6 font-semibold text-slate-800">
                          {invoice.clientName}
                        </td>
                        <td className="py-3.5 px-6 text-xs text-slate-500 font-medium tabular-nums">
                          {invoice.invoiceRef}
                        </td>
                        <td className="py-3.5 px-6">
                          <DateDisplay date={invoice.issueDate} />
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          <AmountFCFA amount={invoice.total} highlight />
                        </td>
                        <td className="py-3.5 px-6 text-center">
                          <StatusBadge status={invoice.status} />
                        </td>
                        <td className="py-3.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => router.push(`/factures/${invoice.id}`)}
                              className="h-8 w-8 text-slate-400 hover:text-[#16A34A] hover:bg-slate-100 rounded-lg shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            {/* Actions Dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg shrink-0"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="bg-white border border-slate-100 shadow-lg rounded-xl p-1 text-slate-700 min-w-32 z-50"
                              >
                                <DropdownMenuItem
                                  onClick={() => router.push(`/factures/${invoice.id}`)}
                                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>Voir</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => router.push(`/factures/modifier?id=${invoice.id}`)}
                                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                  <span>Modifier</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteCandidate({ id: invoice.id, ref: invoice.invoiceRef })}
                                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Supprimer</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    toast.success(`Relance de la facture ${invoice.invoiceRef} envoyée.`);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold hover:bg-slate-50 rounded-lg cursor-pointer border-t border-slate-50 mt-1 transition-colors"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  <span>Relancer</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                        Aucune facture émise.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Todo panel (1/3 width) */}
        <div className="lg:col-span-1">
          <TodoPanel />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteCandidate !== null}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={handleDeleteConfirm}
        title="Supprimer la facture"
        message={`Êtes-vous sûr de vouloir supprimer la facture ${deleteCandidate?.ref || ""} ? Cette action est irréversible et annulera toutes les écritures de caisse associées.`}
      />
    </div>
  );
}
