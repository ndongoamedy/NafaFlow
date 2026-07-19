"use client";

import { useState, useEffect } from "react";
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AmountFCFA from "@/components/shared/AmountFCFA";
import { toast } from "sonner";
import { CalendarDays, FileText, Wallet } from "lucide-react";
import { Label } from "@/components/ui/label";
import { createBrowserClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/utils/orgProfile";

interface ConvertToInvoicesModalProps {
  quoteId: string;
  quoteTotal: number;
  onClose: () => void;
  onSuccess: () => void;
}

// Une seule facture est créée pour la totalité du devis. Les paiements en
// plusieurs fois (jalons) se gèrent ensuite depuis la fiche facture, via des
// encaissements partiels qui réduisent le solde dû jusqu'à 0.
export default function ConvertToInvoicesModal({
  quoteId,
  quoteTotal,
  onClose,
  onSuccess,
}: ConvertToInvoicesModalProps) {
  const [singleDueDays, setSingleDueDays] = useState(30);
  const [converting, setConverting] = useState(false);

  // Acompte / premier jalon éventuellement déjà versé par le client
  const [hasDeposit, setHasDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("Virement");

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

  // Génère un numéro de facture lisible : PREFIX-ANNÉE-XXX
  const buildInvoiceNumber = (prefix: string, year: number, seq: number) => {
    const cleanPrefix = (prefix || "NF").replace(/[-\s]+$/, "");
    return `${cleanPrefix}-${year}-${String(seq).padStart(3, "0")}`;
  };

  const depositValue = hasDeposit ? Math.max(0, Math.round(parseFloat(depositAmount) || 0)) : 0;

  const handleConvert = async () => {
    if (depositValue > quoteTotal) {
      toast.error(`L'acompte ne peut pas dépasser le total de la facture (${quoteTotal.toLocaleString()} F).`);
      return;
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

      // 2. Facture unique : reprend fidèlement les lignes du devis (remise incluse)
      const dueDateObj = new Date();
      dueDateObj.setDate(dueDateObj.getDate() + (Number(singleDueDays) || 30));
      const dueDate = dueDateObj.toISOString().slice(0, 10);

      // Statut initial : si un acompte est saisi, la facture est envoyée puis
      // marquée partiellement/entièrement payée selon le montant.
      const initialStatus =
        depositValue <= 0 ? "draft" :
        depositValue >= quoteTotal ? "paid" : "partial";

      const invoiceNumber = buildInvoiceNumber(prefix, year, seq);
      const { data: invoiceResult, error: invoiceInsertErr } = await supabase
        .schema("nafaflow")
        .from("invoices")
        .insert({
          org_id: quoteData.org_id,
          client_id: quoteData.client_id,
          quote_id: quoteData.id,
          number: invoiceNumber,
          status: initialStatus,
          issue_date: issueDate,
          due_date: dueDate,
          total: quoteTotal,
          notes: `Facture issue du devis ${quoteRef}`,
        })
        .select()
        .single();

      if (invoiceInsertErr) throw invoiceInsertErr;
      if (!invoiceResult) throw new Error("La facture n'a pas pu être créée.");

      // Copier les lignes du devis (y compris la ligne de remise si présente)
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

      // 2b. Acompte (premier jalon) : encaissement partiel + écriture de caisse
      if (depositValue > 0) {
        const sharedId = crypto.randomUUID();
        const { error: cashErr } = await supabase
          .schema("nafaflow")
          .from("cash_entries")
          .insert({
            id: sharedId,
            org_id: quoteData.org_id,
            entry_date: issueDate,
            type: "in",
            amount: depositValue,
            label: `Acompte facture ${invoiceNumber} — devis ${quoteRef}`,
            category: "Ventes",
            link_type: "invoice",
            link_id: invoiceResult.id,
          });
        if (cashErr) throw cashErr;

        const { error: payErr } = await supabase
          .schema("nafaflow")
          .from("payments")
          .insert({
            id: sharedId,
            org_id: quoteData.org_id,
            invoice_id: invoiceResult.id,
            amount: depositValue,
            paid_at: issueDate,
            method: depositMethod,
            note: "Acompte à la commande",
          });
        if (payErr) {
          await supabase.schema("nafaflow").from("cash_entries").delete().eq("id", sharedId);
          throw payErr;
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
        depositValue > 0
          ? `Facture créée avec un acompte de ${depositValue.toLocaleString()} F enregistré.`
          : `Le devis ${quoteRef} a été converti en facture.`
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

  // Projected date helper
  const getProjectedDateString = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl border-slate-100 p-6">
      <DialogHeader>
        <DialogTitle className="text-lg font-bold text-slate-800">
          Convertir le devis en facture
        </DialogTitle>
        <p className="text-xs text-slate-400 font-medium">
          Le devis sera marqué comme accepté et une facture sera créée en brouillon.
        </p>
      </DialogHeader>

      <div className="space-y-5 my-4">
        {/* Quote Total Header Banner */}
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center justify-between">
          <span className="text-xs text-slate-400 font-bold uppercase">Montant total du devis</span>
          <span className="text-xl font-extrabold text-slate-800">
            <AmountFCFA amount={quoteTotal} highlight />
          </span>
        </div>

        {/* Single invoice — the only mode */}
        <div className="flex items-start gap-3 p-4 rounded-xl border border-[#16A34A]/30 bg-[#F0FDF4]/50">
          <FileText className="h-5 w-5 text-[#16A34A] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="text-sm font-bold text-slate-800">Facture unique de la totalité du devis</span>
            <p className="text-[11px] text-slate-500 font-medium">
              Les lignes du devis (remise incluse) seront reprises telles quelles sur la facture.
            </p>
          </div>
        </div>

        {/* Due date */}
        <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <span className="text-sm font-semibold text-slate-800">Échéance de paiement</span>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Date limite de règlement de la facture.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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

        {/* Jalons / paiements partiels : acompte optionnel à la commande */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasDeposit}
              onChange={(e) => setHasDeposit(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#16A34A] focus:ring-[#16A34A]"
            />
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-slate-400" />
                Paiement en plusieurs fois (jalons)
              </span>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Le client a déjà versé un acompte ? Enregistrez-le ici. Les jalons
                suivants s&apos;ajouteront depuis la fiche facture — le solde et le
                statut se mettent à jour automatiquement.
              </p>
            </div>
          </label>

          {hasDeposit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 pl-7">
              <div className="space-y-1">
                <Label htmlFor="deposit-amount" className="text-[10px] font-bold text-slate-400 uppercase">
                  Acompte reçu (FCFA)
                </Label>
                <input
                  id="deposit-amount"
                  type="number"
                  min={0}
                  max={quoteTotal}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Ex : 50000"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="deposit-method" className="text-[10px] font-bold text-slate-400 uppercase">
                  Moyen de paiement
                </Label>
                <select
                  id="deposit-method"
                  value={depositMethod}
                  onChange={(e) => setDepositMethod(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A]"
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Virement">Virement</option>
                  <option value="Wave">Wave</option>
                  <option value="Orange Money">Orange Money</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              {depositValue > 0 && (
                <p className="sm:col-span-2 text-[11px] font-semibold text-slate-500">
                  Reste à payer après acompte :{" "}
                  <span className="text-slate-800 font-bold">
                    {Math.max(0, quoteTotal - depositValue).toLocaleString()} F
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
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
          {converting ? "Génération..." : "Créer la facture"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
