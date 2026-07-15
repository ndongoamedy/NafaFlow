"use client";

import { useState, useEffect } from "react";
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import AmountFCFA from "@/components/shared/AmountFCFA";
import { toast } from "sonner";
import { Plus, Trash2, CalendarDays, FileText, SplitSquareHorizontal } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/utils/orgProfile";

interface Milestone {
  id: string;
  label: string;
  percent: number;
  dueDateDays: number;
}

interface ConvertToInvoicesModalProps {
  quoteId: string;
  quoteTotal: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ConvertToInvoicesModal({
  quoteId,
  quoteTotal,
  onClose,
  onSuccess,
}: ConvertToInvoicesModalProps) {
  // Par défaut : une seule facture pour tout le devis (cas le plus courant).
  // Le paiement en plusieurs échéances reste disponible comme option avancée.
  const [mode, setMode] = useState<"single" | "installments">("single");
  const [singleDueDays, setSingleDueDays] = useState(30);
  const [template, setTemplate] = useState<"50-50" | "40-40-20" | "custom">("50-50");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [converting, setConverting] = useState(false);

  // Récupère le délai de paiement standard configuré dans Paramètres
  useEffect(() => {
    const supabase = createBrowserClient();
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: userData } = await supabase
          .schema("nafaflow")
          .from("users")
          .select("org_id")
          .eq("id", user.id)
          .single();
        if (!userData?.org_id) return;
        const { data: org } = await supabase
          .schema("nafaflow")
          .from("orgs")
          .select("payment_terms_days")
          .eq("id", userData.org_id)
          .single();
        if (org?.payment_terms_days) setSingleDueDays(org.payment_terms_days);
      } catch {
        // Valeur par défaut conservée
      }
    })();
  }, []);

  // Calculate default milestones based on selected template
  useEffect(() => {
    if (template === "50-50") {
      setMilestones([
        { id: "1", label: "Acompte à la commande", percent: 50, dueDateDays: 0 },
        { id: "2", label: "Solde à la livraison", percent: 50, dueDateDays: 30 },
      ]);
    } else if (template === "40-40-20") {
      setMilestones([
        { id: "1", label: "Acompte à la signature", percent: 40, dueDateDays: 0 },
        { id: "2", label: "Facture intermédiaire", percent: 40, dueDateDays: 30 },
        { id: "3", label: "Solde de fin de projet", percent: 20, dueDateDays: 60 },
      ]);
    } else if (template === "custom" && milestones.length === 0) {
      setMilestones([
        { id: "1", label: "Échéance 1", percent: 100, dueDateDays: 30 },
      ]);
    }
  }, [template, milestones.length]);

  const handlePercentChange = (id: string, newPercent: number) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, percent: newPercent } : m))
    );
  };

  const handleLabelChange = (id: string, newLabel: string) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, label: newLabel } : m))
    );
  };

  const handleDueDateChange = (id: string, newDays: number) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, dueDateDays: newDays } : m))
    );
  };

  const addMilestone = () => {
    const totalCurrentPercent = milestones.reduce((sum, m) => sum + m.percent, 0);
    const remaining = Math.max(0, 100 - totalCurrentPercent);
    const newId = (milestones.length + 1).toString();
    setMilestones((prev) => [
      ...prev,
      { id: newId, label: `Échéance ${newId}`, percent: remaining, dueDateDays: 30 * milestones.length },
    ]);
  };

  const removeMilestone = (id: string) => {
    if (milestones.length === 1) {
      toast.error("Au moins une échéance est requise.");
      return;
    }
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  };

  // Génère un numéro de facture lisible : PREFIX-ANNÉE-XXX
  const buildInvoiceNumber = (prefix: string, year: number, seq: number) => {
    const cleanPrefix = (prefix || "NF").replace(/[-\s]+$/, "");
    return `${cleanPrefix}-${year}-${String(seq).padStart(3, "0")}`;
  };

  const handleConvert = async () => {
    if (mode === "installments") {
      const totalPercent = milestones.reduce((sum, m) => sum + m.percent, 0);
      if (totalPercent !== 100) {
        toast.error(`Le total des échéances doit faire 100% (actuel : ${totalPercent}%).`);
        return;
      }
    }

    setConverting(true);
    try {
      const supabase = createBrowserClient();

      // 1. Fetch quote details
      const { data: quoteData, error: quoteErr } = await supabase
        .schema("nafaflow")
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .single();

      if (quoteErr) throw quoteErr;
      if (!quoteData) throw new Error("Devis introuvable dans la base de données.");

      const year = new Date().getFullYear();
      const shortId = quoteData.id.split("-")[0]?.slice(0, 4).toUpperCase() || quoteData.id.slice(0, 4).toUpperCase();
      const quoteRef = `D-${new Date(quoteData.created_at).getFullYear()}-${shortId}`;

      // Préfixe + numéro séquentiel depuis les paramètres de l'organisation
      const [{ data: org }, { count: invoiceCount }] = await Promise.all([
        supabase.schema("nafaflow").from("orgs").select("invoice_prefix").eq("id", quoteData.org_id).single(),
        supabase
          .schema("nafaflow")
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("org_id", quoteData.org_id),
      ]);
      const prefix = org?.invoice_prefix || "NF";
      const seq = (invoiceCount || 0) + 1;

      const issueDate = new Date().toISOString().slice(0, 10);

      if (mode === "single") {
        // 2a. Facture unique : reprend fidèlement les lignes du devis
        const dueDateObj = new Date();
        dueDateObj.setDate(dueDateObj.getDate() + (Number(singleDueDays) || 30));
        const dueDate = dueDateObj.toISOString().slice(0, 10);

        const { data: invoiceResult, error: invoiceInsertErr } = await supabase
          .schema("nafaflow")
          .from("invoices")
          .insert({
            org_id: quoteData.org_id,
            client_id: quoteData.client_id,
            quote_id: quoteData.id,
            number: buildInvoiceNumber(prefix, year, seq),
            status: "draft",
            issue_date: issueDate,
            due_date: dueDate,
            total: quoteTotal,
            notes: `Facture issue du devis ${quoteRef}`,
          })
          .select()
          .single();

        if (invoiceInsertErr) throw invoiceInsertErr;
        if (!invoiceResult) throw new Error("La facture n'a pas pu être créée.");

        // Copier les lignes du devis
        const { data: quoteLines, error: qlErr } = await supabase
          .schema("nafaflow")
          .from("quote_lines")
          .select("*")
          .eq("quote_id", quoteData.id);

        if (qlErr) throw qlErr;

        const linesToInsert = (quoteLines || []).length > 0
          ? (quoteLines || []).map((l) => ({
              invoice_id: invoiceResult.id,
              service_id: l.service_id || null,
              description: l.description || "",
              qty: l.qty || 1,
              unit_price: l.unit_price || 0,
              total: l.total || 0,
            }))
          : [{
              invoice_id: invoiceResult.id,
              service_id: null,
              description: `Prestations du devis ${quoteRef}`,
              qty: 1,
              unit_price: quoteTotal,
              total: quoteTotal,
            }];

        const { error: lineInsertErr } = await supabase
          .schema("nafaflow")
          .from("invoice_lines")
          .insert(linesToInsert);

        if (lineInsertErr) throw lineInsertErr;
      } else {
        // 2b. Paiement en plusieurs échéances
        for (let idx = 0; idx < milestones.length; idx++) {
          const m = milestones[idx];
          const amount = Math.round((quoteTotal * m.percent) / 100);

          const dueDateObj = new Date();
          dueDateObj.setDate(dueDateObj.getDate() + m.dueDateDays);
          const dueDate = dueDateObj.toISOString().slice(0, 10);

          const { data: invoiceResult, error: invoiceInsertErr } = await supabase
            .schema("nafaflow")
            .from("invoices")
            .insert({
              org_id: quoteData.org_id,
              client_id: quoteData.client_id,
              quote_id: quoteData.id,
              number: buildInvoiceNumber(prefix, year, seq + idx),
              status: "draft",
              issue_date: issueDate,
              due_date: dueDate,
              total: amount,
              notes: `Échéance de paiement (${m.percent}%) du devis ${quoteRef}`,
            })
            .select()
            .single();

          if (invoiceInsertErr) throw invoiceInsertErr;
          if (!invoiceResult) throw new Error("La facture d'échéance n'a pas pu être créée.");

          // Insert line
          const { error: lineInsertErr } = await supabase
            .schema("nafaflow")
            .from("invoice_lines")
            .insert({
              invoice_id: invoiceResult.id,
              description: `${m.label} (${m.percent}% du devis ${quoteRef})`,
              qty: 1,
              unit_price: amount,
              total: amount,
              milestone_tag: m.label,
            });

          if (lineInsertErr) throw lineInsertErr;
        }
      }

      // 3. Mark the quote as accepted
      const { error: quoteUpdateErr } = await supabase
        .schema("nafaflow")
        .from("quotes")
        .update({ status: "accepted" })
        .eq("id", quoteId);

      if (quoteUpdateErr) throw quoteUpdateErr;

      toast.success(
        mode === "single"
          ? `Le devis ${quoteRef} a été converti en facture.`
          : `Le devis ${quoteRef} a été converti en ${milestones.length} factures d'échéance.`
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error("Conversion error details:", err);
      toast.error(`Erreur lors de la conversion : ${errorMessage(err)}`);
    } finally {
      setConverting(false);
    }
  };

  // Projected dates calculator helper
  const getProjectedDateString = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl border-slate-100 p-6">
      <DialogHeader>
        <DialogTitle className="text-lg font-bold text-slate-800">
          Convertir le devis en facture
        </DialogTitle>
        <p className="text-xs text-slate-400 font-medium">
          Le devis sera marqué comme accepté et la ou les factures seront créées en brouillon.
        </p>
      </DialogHeader>

      <div className="space-y-6 my-4">
        {/* Quote Total Header Banner */}
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center justify-between">
          <span className="text-xs text-slate-400 font-bold uppercase">Montant total du devis</span>
          <span className="text-xl font-extrabold text-slate-800">
            <AmountFCFA amount={quoteTotal} highlight />
          </span>
        </div>

        {/* Mode Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`p-4 rounded-xl border text-left transition-all ${
              mode === "single"
                ? "border-[#16A34A] bg-[#F0FDF4]/60 shadow-sm"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <FileText className={`h-4 w-4 ${mode === "single" ? "text-[#16A34A]" : "text-slate-400"}`} />
              <span className={`text-sm font-bold ${mode === "single" ? "text-[#16A34A]" : "text-slate-700"}`}>
                Facture unique
              </span>
              <span className="text-[9px] font-bold uppercase bg-[#16A34A]/10 text-[#15803D] px-1.5 py-0.5 rounded">
                Recommandé
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Une seule facture pour la totalité du devis. Simple et rapide.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setMode("installments")}
            className={`p-4 rounded-xl border text-left transition-all ${
              mode === "installments"
                ? "border-[#16A34A] bg-[#F0FDF4]/60 shadow-sm"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <SplitSquareHorizontal className={`h-4 w-4 ${mode === "installments" ? "text-[#16A34A]" : "text-slate-400"}`} />
              <span className={`text-sm font-bold ${mode === "installments" ? "text-[#16A34A]" : "text-slate-700"}`}>
                Paiement en plusieurs fois
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Ex. : 50% d&apos;acompte à la commande, 50% à la livraison.
            </p>
          </button>
        </div>

        {/* Single invoice options */}
        {mode === "single" && (
          <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <span className="text-sm font-semibold text-slate-800">Facture de la totalité du devis</span>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Les lignes du devis seront reprises telles quelles sur la facture.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Label htmlFor="single-due" className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">
                Échéance à
              </Label>
              <div className="relative flex items-center bg-white border border-slate-200 rounded-lg px-2 py-1 w-24">
                <input
                  id="single-due"
                  type="number"
                  min={0}
                  value={singleDueDays}
                  onChange={(e) => setSingleDueDays(parseInt(e.target.value) || 0)}
                  className="bg-transparent border-0 outline-0 text-xs font-semibold w-full text-center focus:ring-0 focus:outline-none"
                />
                <span className="text-[10px] font-bold text-slate-400">jours</span>
              </div>
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 whitespace-nowrap">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                {getProjectedDateString(singleDueDays)}
              </span>
            </div>
          </div>
        )}

        {/* Installments options */}
        {mode === "installments" && (
          <>
            {/* Template Select Radio */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase">Répartition des échéances</Label>
              <RadioGroup
                value={template}
                onValueChange={(val: "50-50" | "40-40-20" | "custom") => {
                  setTemplate(val);
                  if (val !== "custom") {
                    setMilestones([]);
                  }
                }}
                className="grid grid-cols-3 gap-3"
              >
                <div
                  onClick={() => {
                    setTemplate("50-50");
                    setMilestones([]);
                  }}
                  className={`flex items-center space-x-2 border p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${
                    template === "50-50" ? "border-[#16A34A] bg-[#F0FDF4]/50" : "border-slate-200/80"
                  }`}
                >
                  <RadioGroupItem value="50-50" id="r1" className="text-[#16A34A] focus:ring-[#16A34A]" />
                  <Label htmlFor="r1" className="cursor-pointer text-sm font-semibold text-slate-700">50% / 50%</Label>
                </div>

                <div
                  onClick={() => {
                    setTemplate("40-40-20");
                    setMilestones([]);
                  }}
                  className={`flex items-center space-x-2 border p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${
                    template === "40-40-20" ? "border-[#16A34A] bg-[#F0FDF4]/50" : "border-slate-200/80"
                  }`}
                >
                  <RadioGroupItem value="40-40-20" id="r2" className="text-[#16A34A] focus:ring-[#16A34A]" />
                  <Label htmlFor="r2" className="cursor-pointer text-sm font-semibold text-slate-700">40/40/20</Label>
                </div>

                <div
                  onClick={() => {
                    setTemplate("custom");
                    setMilestones([]);
                  }}
                  className={`flex items-center space-x-2 border p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${
                    template === "custom" ? "border-[#16A34A] bg-[#F0FDF4]/50" : "border-slate-200/80"
                  }`}
                >
                  <RadioGroupItem value="custom" id="r3" className="text-[#16A34A] focus:ring-[#16A34A]" />
                  <Label htmlFor="r3" className="cursor-pointer text-sm font-semibold text-slate-700">Personnalisé</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Milestones Editor Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-500 uppercase">Aperçu des factures à créer</Label>
                {template === "custom" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addMilestone}
                    className="text-xs font-semibold text-[#16A34A] hover:bg-[#F0FDF4] h-7 px-2 flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Ajouter une échéance</span>
                  </Button>
                )}
              </div>

              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {milestones.map((m) => {
                  const amount = (quoteTotal * m.percent) / 100;
                  return (
                    <div
                      key={m.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100 group"
                    >
                      {/* Milestone Label */}
                      <div className="flex-1">
                        {template === "custom" ? (
                          <Input
                            value={m.label}
                            onChange={(e) => handleLabelChange(m.id, e.target.value)}
                            className="h-8 text-sm font-medium rounded-lg bg-white"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-slate-800">{m.label}</span>
                        )}
                      </div>

                      {/* Percentage Input */}
                      <div className="w-24 flex items-center gap-1 shrink-0">
                        {template === "custom" ? (
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            value={m.percent}
                            onChange={(e) => handlePercentChange(m.id, parseInt(e.target.value) || 0)}
                            className="h-8 text-center text-sm font-semibold rounded-lg bg-white w-16"
                          />
                        ) : (
                          <span className="text-sm font-bold text-[#16A34A] bg-[#F0FDF4] px-2.5 py-0.5 rounded-lg border border-[#16A34A]/20">
                            {m.percent}%
                          </span>
                        )}
                        {template === "custom" && <span className="text-xs font-bold text-slate-400">%</span>}
                      </div>

                      {/* Days/Dates Selector */}
                      <div className="w-32 flex items-center gap-2 shrink-0">
                        {template === "custom" ? (
                          <div className="relative flex items-center bg-white border border-slate-200 rounded-lg px-2 py-0.5 w-full">
                            <input
                              type="number"
                              value={m.dueDateDays}
                              onChange={(e) => handleDueDateChange(m.id, parseInt(e.target.value) || 0)}
                              className="bg-transparent border-0 outline-0 text-xs font-semibold w-full text-center focus:ring-0 focus:outline-none"
                            />
                            <span className="text-[10px] font-bold text-slate-400">Jours</span>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                            {getProjectedDateString(m.dueDateDays)}
                          </span>
                        )}
                      </div>

                      {/* calculated Amount FCFA Preview */}
                      <div className="w-28 text-right font-bold text-slate-800 shrink-0">
                        <AmountFCFA amount={amount} highlight />
                      </div>

                      {/* Delete Button (custom only) */}
                      {template === "custom" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMilestone(m.id)}
                          className="h-7 w-7 text-slate-400 hover:text-red-500 rounded-lg shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={converting}
          className="text-slate-500 hover:bg-slate-50 font-semibold"
        >
          Annuler
        </Button>
        <Button
          type="button"
          onClick={handleConvert}
          disabled={converting}
          className="bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold rounded-lg"
        >
          {converting
            ? "Génération..."
            : mode === "single"
            ? "Créer la facture"
            : `Créer ${milestones.length} factures`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
