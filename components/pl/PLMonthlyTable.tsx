"use client";

import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AmountFCFA from "@/components/shared/AmountFCFA";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TrendingUp, Percent, Landmark, Target, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import { toMonthlyAmount, errorMessage } from "@/lib/utils/orgProfile";

interface RevenueLine {
  category: string;
  amount: number;
}

interface FixedCostLine {
  id: string;
  label: string;
  amount: number;        // montant tel que stocké
  periodicity: string;   // monthly | quarterly | yearly
  monthly: number;       // équivalent mensuel calculé
}

interface PLMonthlyTableProps {
  monthKey: string; // e.g. "2026-06"
}

const OTHER_REVENUE = "Autres produits";

export default function PLMonthlyTable({ monthKey }: PLMonthlyTableProps) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [revenueLines, setRevenueLines] = useState<RevenueLine[]>([]);
  const [cogs, setCogs] = useState(0);
  const [fixedCosts, setFixedCosts] = useState<FixedCostLine[]>([]);
  const [loading, setLoading] = useState(true);

  // Édition des charges fixes
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<{ id?: string; label: string; amount: string; periodicity: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const loadPLData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();

      // org courant
      const { data: { user } } = await supabase.auth.getUser();
      let uOrg: string | null = null;
      if (user) {
        const { data: u } = await supabase.schema("nafaflow").from("users").select("org_id").eq("id", user.id).single();
        uOrg = u?.org_id || null;
        setOrgId(uOrg);
      }

      // Plage de dates du mois
      const year = parseInt(monthKey.split("-")[0]);
      const month = parseInt(monthKey.split("-")[1]);
      const lastDay = new Date(year, month, 0).getDate();
      const startDate = `${monthKey}-01`;
      const endDate = `${monthKey}-${String(lastDay).padStart(2, "0")}`;

      // 1. Écritures de caisse du mois
      const { data: entries } = await supabase
        .schema("nafaflow")
        .from("cash_entries")
        .select("amount, type, label, category, link_type, link_id")
        .gte("entry_date", startDate)
        .lte("entry_date", endDate);

      // 2. Services → catégories
      const { data: services } = await supabase
        .schema("nafaflow")
        .from("services")
        .select("id, category");
      const serviceCat: Record<string, string> = {};
      (services || []).forEach((s: { id: string; category?: string | null }) => {
        serviceCat[s.id] = (s.category || "").trim() || OTHER_REVENUE;
      });

      // 3. Lignes des factures liées aux encaissements du mois
      const linkedInvoiceIds = Array.from(
        new Set(
          (entries || [])
            .filter((e) => e.type === "in" && e.link_type === "invoice" && e.link_id)
            .map((e) => e.link_id as string)
        )
      );

      const invoiceAgg: Record<string, { total: number; byCat: Record<string, number> }> = {};
      if (linkedInvoiceIds.length > 0) {
        const { data: lines } = await supabase
          .schema("nafaflow")
          .from("invoice_lines")
          .select("invoice_id, service_id, total")
          .in("invoice_id", linkedInvoiceIds);

        (lines || []).forEach((l: { invoice_id: string; service_id?: string | null; total?: number | null }) => {
          const cat = l.service_id ? (serviceCat[l.service_id] || OTHER_REVENUE) : OTHER_REVENUE;
          const amt = Number(l.total) || 0;
          if (!invoiceAgg[l.invoice_id]) invoiceAgg[l.invoice_id] = { total: 0, byCat: {} };
          invoiceAgg[l.invoice_id].total += amt;
          invoiceAgg[l.invoice_id].byCat[cat] = (invoiceAgg[l.invoice_id].byCat[cat] || 0) + amt;
        });
      }

      // 4. Répartition des encaissements par catégorie + coûts variables
      const revenueByCat: Record<string, number> = {};
      let cogsSum = 0;

      (entries || []).forEach((e) => {
        const amount = Math.round(Number(e.amount)) || 0;
        if (e.type === "in") {
          const agg = e.link_id ? invoiceAgg[e.link_id as string] : undefined;
          if (agg && agg.total > 0) {
            Object.entries(agg.byCat).forEach(([cat, catAmt]) => {
              revenueByCat[cat] = (revenueByCat[cat] || 0) + Math.round(amount * (catAmt / agg.total));
            });
          } else {
            revenueByCat[OTHER_REVENUE] = (revenueByCat[OTHER_REVENUE] || 0) + amount;
          }
        } else if (e.type === "out") {
          const label = (e.label || "").toLowerCase();
          const category = (e.category || "").toLowerCase();
          // Coûts variables (prestations externes) — le reste est traité comme charge fixe déclarée
          if (label.includes("prestataire") || label.includes("freelance") || label.includes("cogs") || label.includes("variable") || category.includes("prestataire") || category.includes("variable")) {
            cogsSum += amount;
          }
        }
      });

      const revLines: RevenueLine[] = Object.entries(revenueByCat)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      setRevenueLines(revLines);
      setCogs(cogsSum);

      // 5. Charges fixes (éditables) depuis fixed_costs
      if (uOrg) {
        const { data: fc } = await supabase
          .schema("nafaflow")
          .from("fixed_costs")
          .select("id, label, amount, periodicity, active")
          .eq("org_id", uOrg)
          .eq("active", true)
          .order("amount", { ascending: false });

        setFixedCosts(
          (fc || []).map((f: { id: string; label?: string | null; amount?: number | null; periodicity?: string | null }) => {
            const amt = Number(f.amount) || 0;
            return {
              id: f.id,
              label: f.label || "Charge fixe",
              amount: amt,
              periodicity: f.periodicity || "monthly",
              monthly: Math.round(toMonthlyAmount(amt, f.periodicity)),
            };
          })
        );
      } else {
        setFixedCosts([]);
      }
    } catch (err) {
      console.error("Error loading P&L data:", err);
      setRevenueLines([]);
      setCogs(0);
      setFixedCosts([]);
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    loadPLData();
  }, [loadPLData]);

  const openEditor = () => {
    setDraft(
      fixedCosts.length > 0
        ? fixedCosts.map((f) => ({ id: f.id, label: f.label, amount: String(f.amount), periodicity: f.periodicity }))
        : [{ label: "", amount: "", periodicity: "monthly" }]
    );
    setEditOpen(true);
  };

  const handleSaveFixedCosts = async () => {
    if (!orgId) return;
    const cleaned = draft
      .map((d) => ({ ...d, label: d.label.trim(), amountNum: Math.round(Number(d.amount) || 0) }))
      .filter((d) => d.label !== "" && d.amountNum > 0);

    setSaving(true);
    try {
      const supabase = createBrowserClient();

      // Stratégie simple et fiable : on remplace l'ensemble des charges fixes actives.
      await supabase.schema("nafaflow").from("fixed_costs").delete().eq("org_id", orgId).eq("active", true);

      if (cleaned.length > 0) {
        const rows = cleaned.map((d) => ({
          id: crypto.randomUUID(),
          org_id: orgId,
          label: d.label,
          amount: d.amountNum,
          periodicity: d.periodicity || "monthly",
          active: true,
        }));
        const { error } = await supabase.schema("nafaflow").from("fixed_costs").insert(rows);
        if (error) throw error;
      }

      toast.success("Charges fixes mises à jour. Elles alimentent aussi l'alerte de trésorerie.");
      setEditOpen(false);
      loadPLData();
    } catch (err: unknown) {
      console.error(err);
      toast.error(`Erreur lors de l'enregistrement : ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium animate-pulse">Chargement du compte de résultat...</div>;
  }

  // Calculs
  const revenueTotal = revenueLines.reduce((sum, r) => sum + r.amount, 0);
  const grossMargin = revenueTotal - cogs;
  const fixedCostsTotal = fixedCosts.reduce((sum, f) => sum + f.monthly, 0);
  const result = grossMargin - fixedCostsTotal;
  const marginPercentage = revenueTotal > 0 ? (grossMargin / revenueTotal) * 100 : 0;
  const marginRate = revenueTotal > 0 ? grossMargin / revenueTotal : 0;
  const breakEvenPoint = marginRate > 0 ? fixedCostsTotal / marginRate : 0;
  const pct = (v: number) => (revenueTotal > 0 ? ((v / revenueTotal) * 100).toFixed(1) : "0.0");

  const isEmpty = revenueTotal === 0 && fixedCostsTotal === 0 && cogs === 0;

  return (
    <div className="space-y-6">
      {isEmpty && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 p-4 rounded-xl text-xs text-blue-800 shadow-sm">
          <TrendingUp className="h-5 w-5 text-blue-500 shrink-0" />
          <div className="flex-1">
            <span className="font-bold">Aucune donnée pour ce mois. </span>
            Vos revenus se répartiront automatiquement selon les catégories de vos services facturés. Renseignez vos charges fixes ci-dessous pour compléter votre compte de résultat.
          </div>
        </div>
      )}

      {/* Metrics Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="bg-white border-slate-100 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase">Résultat Net</span>
              <h3 className={`text-lg font-bold ${result >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {result >= 0 ? "+" : ""} <AmountFCFA amount={result} className={result >= 0 ? "text-emerald-600" : "text-rose-600"} />
              </h3>
            </div>
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center border ${
              result >= 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
            }`}>
              <Landmark className="h-4.5 w-4.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-100 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase">Produits (CA Total)</span>
              <h3 className="text-lg font-bold text-slate-800"><AmountFCFA amount={revenueTotal} highlight /></h3>
            </div>
            <div className="h-9 w-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 border border-blue-100">
              <TrendingUp className="h-4.5 w-4.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-100 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase">Taux Marge Brute</span>
              <h3 className="text-lg font-bold text-slate-800">{marginPercentage.toFixed(1)}%</h3>
            </div>
            <div className="h-9 w-9 bg-purple-50 rounded-lg flex items-center justify-center text-purple-650 border border-purple-100">
              <Percent className="h-4.5 w-4.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-100 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase">Seuil de Rentabilité</span>
              <h3 className="text-lg font-bold text-slate-800"><AmountFCFA amount={breakEvenPoint} highlight /></h3>
            </div>
            <div className="h-9 w-9 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 border border-amber-100">
              <Target className="h-4.5 w-4.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Structured Income Statement Table */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 border-b border-slate-100">
            <TableRow className="text-slate-400 text-[10px] tracking-wider uppercase font-bold hover:bg-slate-50">
              <TableHead className="py-3 px-6">Rubrique Comptable</TableHead>
              <TableHead className="py-3 px-6 text-right w-64">Montant du mois (FCFA)</TableHead>
              <TableHead className="py-3 px-6 text-right w-32">% Produits</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100 text-slate-700 text-sm">
            {/* 1. Chiffre d'affaires — par catégorie de service */}
            <TableRow className="bg-slate-50/20 font-bold text-slate-800 hover:bg-slate-50/20">
              <TableCell className="py-3 px-6 uppercase tracking-wide">1. Produits d&apos;exploitation (Chiffre d&apos;affaires)</TableCell>
              <TableCell className="py-3 px-6 text-right tabular-nums"><AmountFCFA amount={revenueTotal} /></TableCell>
              <TableCell className="py-3 px-6 text-right">100.0%</TableCell>
            </TableRow>
            {revenueLines.length > 0 ? (
              revenueLines.map((r) => (
                <TableRow key={r.category} className="hover:bg-slate-50/10">
                  <TableCell className="py-2.5 px-10 text-xs font-semibold text-slate-500">Chiffre d&apos;affaires — {r.category}</TableCell>
                  <TableCell className="py-2.5 px-6 text-right text-xs text-slate-600 tabular-nums"><AmountFCFA amount={r.amount} /></TableCell>
                  <TableCell className="py-2.5 px-6 text-right text-xs text-slate-400">{pct(r.amount)}%</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-slate-50/10">
                <TableCell colSpan={3} className="py-2.5 px-10 text-xs font-medium text-slate-400 italic">
                  Aucun encaissement ce mois-ci. Les revenus apparaîtront par catégorie de service dès vos premiers paiements.
                </TableCell>
              </TableRow>
            )}

            {/* 2. Charges variables */}
            <TableRow className="bg-slate-50/20 font-bold text-slate-800 hover:bg-slate-50/20">
              <TableCell className="py-3 px-6 uppercase tracking-wide">2. Charges Variables (Prestations Externes)</TableCell>
              <TableCell className="py-3 px-6 text-right text-rose-600 tabular-nums">- <AmountFCFA amount={cogs} className="text-rose-600" /></TableCell>
              <TableCell className="py-3 px-6 text-right text-rose-600 font-semibold">{pct(cogs)}%</TableCell>
            </TableRow>

            {/* 3. Marge brute */}
            <TableRow className="bg-slate-100/30 font-bold text-[#16A34A] hover:bg-slate-100/30">
              <TableCell className="py-3 px-6 uppercase tracking-wide">3. Marge Brute</TableCell>
              <TableCell className="py-3 px-6 text-right tabular-nums"><AmountFCFA amount={grossMargin} /></TableCell>
              <TableCell className="py-3 px-6 text-right">{marginPercentage.toFixed(1)}%</TableCell>
            </TableRow>

            {/* 4. Charges fixes — éditables */}
            <TableRow className="bg-slate-50/20 font-bold text-slate-800 hover:bg-slate-50/20">
              <TableCell className="py-3 px-6 uppercase tracking-wide">
                <div className="flex items-center gap-2">
                  <span>4. Charges Fixes d&apos;Exploitation</span>
                  <button
                    onClick={openEditor}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-[#16A34A] bg-[#F0FDF4] hover:bg-emerald-100 border border-[#16A34A]/20 px-2 py-0.5 rounded normal-case tracking-normal transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Modifier
                  </button>
                </div>
              </TableCell>
              <TableCell className="py-3 px-6 text-right text-rose-600 tabular-nums">- <AmountFCFA amount={fixedCostsTotal} className="text-rose-600" /></TableCell>
              <TableCell className="py-3 px-6 text-right text-rose-600 font-semibold">{pct(fixedCostsTotal)}%</TableCell>
            </TableRow>
            {fixedCosts.length > 0 ? (
              fixedCosts.map((f) => (
                <TableRow key={f.id} className="hover:bg-slate-50/10">
                  <TableCell className="py-2.5 px-10 text-xs font-semibold text-slate-500">
                    {f.label}
                    {f.periodicity !== "monthly" && (
                      <span className="ml-1.5 text-[10px] text-slate-400 font-medium">
                        ({f.periodicity === "yearly" ? "annuel" : f.periodicity === "quarterly" ? "trimestriel" : f.periodicity} → mensualisé)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5 px-6 text-right text-xs text-slate-600 tabular-nums"><AmountFCFA amount={f.monthly} /></TableCell>
                  <TableCell className="py-2.5 px-6 text-right text-xs text-slate-400">{pct(f.monthly)}%</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-slate-50/10">
                <TableCell colSpan={3} className="py-3 px-10 text-xs font-medium text-slate-400">
                  <button onClick={openEditor} className="inline-flex items-center gap-1.5 text-[#16A34A] font-semibold hover:underline underline-offset-2">
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter vos charges fixes (loyer, salaires, abonnements...)
                  </button>
                </TableCell>
              </TableRow>
            )}

            {/* 5. Résultat net */}
            <TableRow className={`font-extrabold border-t-2 ${
              result >= 0 ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-50" : "bg-rose-50 text-rose-800 hover:bg-rose-50"
            }`}>
              <TableCell className="py-3.5 px-6 uppercase tracking-wider">5. RÉSULTAT NET (EBITDA)</TableCell>
              <TableCell className="py-3.5 px-6 text-right text-base tabular-nums">
                <AmountFCFA amount={result} className={result >= 0 ? "text-emerald-700 font-extrabold text-base" : "text-rose-700 font-extrabold text-base"} />
              </TableCell>
              <TableCell className="py-3.5 px-6 text-right font-extrabold">{pct(result)}%</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Modal d'édition des charges fixes */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl bg-white rounded-xl shadow-xl border-slate-100 p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">Charges fixes d&apos;exploitation</DialogTitle>
            <p className="text-xs text-slate-400 font-medium">
              Ces charges alimentent votre compte de résultat et votre alerte de trésorerie.
            </p>
          </DialogHeader>

          <div className="space-y-3 my-4 max-h-80 overflow-y-auto pr-1">
            {/* En-têtes */}
            <div className="grid grid-cols-12 gap-2 px-1">
              <Label className="col-span-6 text-[10px] font-bold text-slate-400 uppercase">Libellé</Label>
              <Label className="col-span-3 text-[10px] font-bold text-slate-400 uppercase">Montant (F)</Label>
              <Label className="col-span-2 text-[10px] font-bold text-slate-400 uppercase">Fréquence</Label>
              <span className="col-span-1" />
            </div>

            {draft.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <Input
                  value={row.label}
                  onChange={(e) => setDraft((prev) => prev.map((r, i) => i === idx ? { ...r, label: e.target.value } : r))}
                  placeholder="ex: Loyer bureau"
                  className="col-span-6 h-9 rounded-lg border-slate-200 text-sm"
                />
                <Input
                  type="number"
                  min={0}
                  value={row.amount}
                  onChange={(e) => setDraft((prev) => prev.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r))}
                  placeholder="0"
                  className="col-span-3 h-9 rounded-lg border-slate-200 text-sm text-right"
                />
                <select
                  value={row.periodicity}
                  onChange={(e) => setDraft((prev) => prev.map((r, i) => i === idx ? { ...r, periodicity: e.target.value } : r))}
                  className="col-span-2 h-9 px-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 focus:outline-none focus:border-[#16A34A]"
                >
                  <option value="monthly">Mensuel</option>
                  <option value="quarterly">Trimestriel</option>
                  <option value="yearly">Annuel</option>
                </select>
                <button
                  type="button"
                  onClick={() => setDraft((prev) => prev.filter((_, i) => i !== idx))}
                  className="col-span-1 flex items-center justify-center text-slate-400 hover:text-red-500 h-9"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setDraft((prev) => [...prev, { label: "", amount: "", periodicity: "monthly" }])}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#16A34A] hover:bg-[#F0FDF4] px-2 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter une charge
            </button>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={saving} className="text-slate-500 font-semibold">
              Annuler
            </Button>
            <Button type="button" onClick={handleSaveFixedCosts} disabled={saving} className="bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold rounded-lg">
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
