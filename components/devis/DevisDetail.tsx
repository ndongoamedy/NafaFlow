"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, ArrowLeft, Calendar, User, FileText, CheckCircle2, ArrowRightLeft, CheckSquare, Edit, Save, AlertTriangle } from "lucide-react";
import Link from "next/link";
import StatusBadge from "@/components/shared/StatusBadge";
import AmountFCFA from "@/components/shared/AmountFCFA";
import DateDisplay from "@/components/shared/DateDisplay";
import ConvertToInvoicesModal from "./ConvertToInvoicesModal";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClientItem, DevisItem } from "@/lib/utils/state";
import { fetchOrgSettings, OrgSettings } from "@/lib/utils/orgProfile";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { generateDocumentPDF } from "@/lib/utils/pdf";
import { Label } from "@/components/ui/label";
import DevisLineEditor, { DevisLine } from "./DevisLineEditor";

interface DevisDetailProps {
  quoteId: string;
}

export default function DevisDetail({ quoteId }: DevisDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryId = searchParams.get("id");
  const actualQuoteId = (quoteId === "modifier" && queryId) ? queryId : quoteId;

  const [quote, setQuote] = useState<DevisItem | null>(null);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states for edit mode
  const [editClient, setEditClient] = useState("");
  const [editIssueDate, setEditIssueDate] = useState("");
  const [editValidityDays, setEditValidityDays] = useState("15");
  const [editLines, setEditLines] = useState<DevisLine[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      
      // 1. Fetch Clients
      const { data: clientsData, error: clientsErr } = await supabase
        .schema("nafaflow")
        .from("clients")
        .select("*")
        .order("name", { ascending: true });

      if (clientsErr) throw clientsErr;
      
      const mappedClients: ClientItem[] = (clientsData || []).map((c) => {
        const item = c as { id: string; name: string; email?: string | null; whatsapp?: string | null; sector?: string | null; address?: string | null; tax_id?: string | null };
        return {
          id: item.id,
          name: item.name,
          email: item.email || "",
          phone: item.whatsapp || "",
          sector: item.sector || "",
          address: item.address || "",
          ninea: item.tax_id ? item.tax_id.split("|")[0] || "" : "",
          rc: item.tax_id ? item.tax_id.split("|")[1] || "" : "",
        };
      });
      setClients(mappedClients);

      // 2. Fetch the quote
      const { data: quoteData, error: quoteErr } = await supabase
        .schema("nafaflow")
        .from("quotes")
        .select("*, clients(name)")
        .eq("id", actualQuoteId)
        .maybeSingle();

      if (quoteErr) throw quoteErr;

      if (quoteData) {
        // 3. Fetch quote lines
        const { data: linesData, error: linesErr } = await supabase
          .schema("nafaflow")
          .from("quote_lines")
          .select("*")
          .eq("quote_id", actualQuoteId);

        if (linesErr) throw linesErr;

        const mappedLines: DevisLine[] = (linesData || []).map((l) => {
          const line = l as { id: string; description?: string | null; qty?: number | null; unit_price?: number | null };
          return {
            id: line.id,
            description: line.description || "",
            quantity: Number(line.qty) || 1,
            unitPrice: Math.round(Number(line.unit_price)) || 0,
          };
        });

        const qData = quoteData as { id: string; client_id: string; created_at: string; valid_until?: string | null; total: number; status?: string | null; clients?: { name: string } | null };

        let mappedStatus = qData.status || "brouillon";
        if (mappedStatus === "draft") mappedStatus = "brouillon";
        else if (mappedStatus === "sent") mappedStatus = "envoyée";
        else if (mappedStatus === "rejected") mappedStatus = "refusé";

        setQuote({
          id: qData.id,
          clientName: qData.clients?.name || "Client Inconnu",
          clientId: qData.client_id,
          issueDate: qData.created_at ? qData.created_at.slice(0, 10) : "",
          validityDays: qData.valid_until ? Math.ceil((new Date(qData.valid_until).getTime() - new Date(qData.created_at).getTime()) / (1000 * 3600 * 24)) : 15,
          total: Math.round(Number(qData.total)),
          status: mappedStatus,
          lines: mappedLines,
        });
      } else {
        toast.error("Devis introuvable.");
        router.push("/devis");
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur lors du chargement : ${message}`);
    } finally {
      setLoading(false);
    }
  }, [actualQuoteId, router]);

  useEffect(() => {
    fetchOrgSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (actualQuoteId) {
      loadData();
    }
  }, [actualQuoteId, loadData]);

  useEffect(() => {
    if (quote) {
      setEditClient(quote.clientId);
      setEditIssueDate(quote.issueDate);
      setEditValidityDays(String(quote.validityDays ?? 15));
      setEditLines(quote.lines || []);
    }
  }, [quote]);

  const handleDownloadPDF = async () => {
    if (!quote) return;

    try {
      const year = new Date(quote.issueDate).getFullYear();
      const shortId = quote.id.split("-")[0]?.slice(0, 4).toUpperCase() || quote.id.slice(0, 4).toUpperCase();
      const quoteRef = `D-${year}-${shortId}`;

      await generateDocumentPDF({
        id: quoteRef,
        type: "devis",
        clientName: quote.clientName,
        clientId: quote.clientId,
        issueDate: quote.issueDate,
        validityDays: quote.validityDays,
        status: quote.status,
        lines: quote.lines,
        total: total,
      });
      toast.success(`Le PDF du devis ${quoteRef} a été généré et téléchargé.`);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors du téléchargement du PDF.");
    }
  };

  const handleSaveChanges = async () => {
    if (!quote) return;
    if (editLines.length === 0) {
      toast.error("Veuillez ajouter au moins une prestation.");
      return;
    }

    const subtotal = editLines.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const applyVat = settings?.billing?.applyVat ?? true;
    const vatRate = settings?.billing?.vat ?? 18;
    const editTotal = applyVat ? subtotal * (1 + vatRate / 100) : subtotal;

    try {
      const supabase = createBrowserClient();
      
      // Update quote
      const { error: quoteUpdateErr } = await supabase
        .schema("nafaflow")
        .from("quotes")
        .update({
          client_id: editClient,
          valid_until: new Date(new Date(editIssueDate).getTime() + (Number(editValidityDays) || 15) * 24 * 3600 * 1000).toISOString().slice(0, 10),
          total: Math.round(editTotal),
        })
        .eq("id", quote.id);

      if (quoteUpdateErr) throw quoteUpdateErr;

      // Delete existing lines
      const { error: deleteLinesErr } = await supabase
        .schema("nafaflow")
        .from("quote_lines")
        .delete()
        .eq("quote_id", quote.id);

      if (deleteLinesErr) throw deleteLinesErr;

      // Insert new lines
      const linesToInsert = editLines.map((line) => {
        // Check if catalog ID (uuid-like or starting with S-)
        const isCatalogService = line.id && (line.id.startsWith("S-") || line.id.length > 20);
        return {
          quote_id: quote.id,
          service_id: isCatalogService ? line.id : null,
          description: line.description,
          qty: line.quantity,
          unit_price: Math.round(line.unitPrice),
          total: Math.round(line.quantity * line.unitPrice),
        };
      });

      const { error: insertLinesErr } = await supabase
        .schema("nafaflow")
        .from("quote_lines")
        .insert(linesToInsert);

      if (insertLinesErr) throw insertLinesErr;

      toast.success("Devis modifié avec succès !");
      router.push(`/devis/${quote.id}`);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur lors de la sauvegarde : ${message}`);
    }
  };

  const handleAcceptQuote = async () => {
    if (!quote) return;

    try {
      const supabase = createBrowserClient();
      const { error } = await supabase
        .schema("nafaflow")
        .from("quotes")
        .update({ status: "accepted" })
        .eq("id", quote.id);

      if (error) throw error;

      toast.success(`Le devis a été accepté.`);
      loadData();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur lors de l'acceptation : ${message}`);
    }
  };

  const handleConvertSuccess = () => {
    router.push("/factures");
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Chargement du devis...</div>;
  }

  if (!quote) {
    return <div className="p-8 text-center text-slate-500 font-medium">Devis introuvable.</div>;
  }

  const applyVat = settings?.billing?.applyVat ?? true;
  const vatRate = settings?.billing?.vat ?? 18;

  const items = quote.lines || [];
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const vat = applyVat ? Math.round(subtotal * (vatRate / 100)) : 0;
  const total = subtotal + vat;

  const year = quote ? new Date(quote.issueDate).getFullYear() : 0;
  const shortId = quote ? (quote.id.split("-")[0]?.slice(0, 4).toUpperCase() || quote.id.slice(0, 4).toUpperCase()) : "";
  const quoteRef = quote ? `D-${year}-${shortId}` : "";

  const isEditing = quoteId === "modifier";

  if (isEditing) {
    const editSubtotal = editLines.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const editVat = applyVat ? Math.round(editSubtotal * (vatRate / 100)) : 0;
    const editTotal = editSubtotal + editVat;
    const isBrouillon = quote.status === "brouillon";

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => router.push(`/devis/${quote.id}`)}
            className="h-9 w-9 rounded-lg border-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Modifier le devis {quoteRef}
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Édition du contenu et des lignes de prestations
            </p>
          </div>
        </div>

        {/* Warning Banner if not Brouillon */}
        {!isBrouillon && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-800">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold">Attention</h4>
              <p className="mt-0.5">Ce devis a déjà été envoyé ou accepté (Statut actuel: <span className="font-extrabold uppercase text-amber-700">{quote.status}</span>). Êtes-vous sûr de vouloir modifier son contenu ?</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Edit Panel (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardContent className="p-6 space-y-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-3">
                  Informations Générales
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Client Selector */}
                  <div className="space-y-1.5">
                    <Label htmlFor="client-select" className="text-[10px] font-bold text-slate-500 uppercase">
                      Client
                    </Label>
                    <select
                      id="client-select"
                      value={editClient}
                      onChange={(e) => setEditClient(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] text-slate-700 font-semibold"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date d'émission */}
                  <div className="space-y-1.5">
                    <Label htmlFor="issue-date" className="text-[10px] font-bold text-slate-500 uppercase">
                      Date d&apos;émission
                    </Label>
                    <input
                      id="issue-date"
                      type="date"
                      value={editIssueDate}
                      onChange={(e) => setEditIssueDate(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] text-slate-700 font-semibold"
                    />
                  </div>

                  {/* Validity Days */}
                  <div className="space-y-1.5">
                    <Label htmlFor="validity-days" className="text-[10px] font-bold text-slate-500 uppercase">
                      Durée de validité (jours)
                    </Label>
                    <input
                      id="validity-days"
                      type="number"
                      value={editValidityDays}
                      onChange={(e) => setEditValidityDays(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] text-slate-700 font-semibold"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line items editor */}
            <Card className="bg-white border-slate-100 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Prestations & Articles
                  </h3>
                </div>
                <DevisLineEditor lines={editLines} onChange={setEditLines} />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar calculations & actions (1/3 width) */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-3">
                  Récapitulatif & Actions
                </h3>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span>SOUS-TOTAL HT</span>
                    <span className="tabular-nums"><AmountFCFA amount={editSubtotal} /></span>
                  </div>
                  {applyVat && (
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                      <span>TVA ({vatRate}%)</span>
                      <span className="tabular-nums"><AmountFCFA amount={editVat} /></span>
                    </div>
                  )}
                  <div className="h-px bg-slate-100" />
                  <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                    <span>MONTANT TTC</span>
                    <span className="text-base font-extrabold text-[#16A34A] tabular-nums">
                      <AmountFCFA amount={editTotal} highlight />
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-4">
                  <Button
                    type="button"
                    onClick={handleSaveChanges}
                    className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-bold h-10 rounded-lg text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-700/10"
                  >
                    <Save className="h-4 w-4" />
                    <span>Enregistrer les modifications</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/devis/${quote.id}`)}
                    className="w-full rounded-lg border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 h-10"
                  >
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Detail Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg border-slate-200 shrink-0"
          >
            <Link href="/devis">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">{quoteRef}</h2>
              <StatusBadge status={quote.status} />
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Détails du devis et facturation des jalons
            </p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2 shrink-0">
          {quote.status !== "accepted" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAcceptQuote}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border-emerald-200 h-9 rounded-lg text-xs flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <CheckSquare className="h-4 w-4" />
              <span>Marquer Accepté</span>
            </Button>
          )}

          {quote.status === "accepted" && (
            <Button
              type="button"
              onClick={() => setIsConvertOpen(true)}
              className="bg-[#16A34A] hover:bg-[#15803D] text-white font-bold h-9 rounded-lg text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-700/10"
            >
              <ArrowRightLeft className="h-4 w-4" />
              <span>Facturer par jalons</span>
            </Button>
          )}

          <Button
            asChild
            variant="outline"
            size="sm"
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold border-slate-200 h-9 rounded-lg text-xs flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <Link href={`/devis/modifier?id=${quote.id}`}>
              <Edit className="h-4 w-4 text-slate-400" />
              <span>Modifier</span>
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold border-slate-200 h-9 rounded-lg text-xs flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <FileDown className="h-4 w-4" />
            <span>Télécharger PDF</span>
          </Button>
        </div>
      </div>

      {/* Main Details Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns: Invoice items + client metadata (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Client Metadata & Dates */}
          <Card className="bg-white border-slate-100 shadow-sm overflow-hidden">
            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Single compact row of key metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold border-b border-slate-100 pb-4">
                <div className="space-y-0.5">
                  <span className="text-slate-400 uppercase tracking-wide text-[9px]">Client</span>
                  <span className="block text-slate-800 font-bold truncate">{quote.clientName}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 uppercase tracking-wide text-[9px]">Émis le</span>
                  <span className="block text-slate-700 font-bold">
                    <DateDisplay date={quote.issueDate} />
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 uppercase tracking-wide text-[9px]">Validité</span>
                  <span className="block text-slate-700 font-bold">
                    {quote.validityDays} jours
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 uppercase tracking-wide text-[9px]">TVA Applicable</span>
                  <span className="block text-slate-700 font-bold flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{applyVat ? `${vatRate}%` : "Non applicable"}</span>
                  </span>
                </div>
              </div>

              {/* Sub-details (addresses) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Client Address */}
                <div className="flex gap-2">
                  <User className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">Dossier Client</span>
                    <p className="text-slate-700 font-medium">Raison Sociale: {quote.clientName}</p>
                    <p className="text-slate-450 text-[10px]">Identifiant Client: {quote.clientId}</p>
                  </div>
                </div>

                {/* Legal information */}
                <div className="flex gap-2">
                  <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">Informations Fiscales</span>
                    <p className="text-slate-700 font-medium">Zone Fiscale: Sénégal (UEMOA)</p>
                    <p className="text-slate-450 text-[10px]">Devise: FCFA</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Quote Lines/Items */}
          <Card className="bg-white border-slate-100 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] tracking-wider uppercase font-bold">
                    <th className="py-3 px-6">Description</th>
                    <th className="py-3 px-6 text-center w-24">Quantité</th>
                    <th className="py-3 px-6 text-right w-36">Prix Unitaire</th>
                    <th className="py-3 px-6 text-right w-36">Total HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/20">
                      <td className="py-3.5 px-6 font-semibold text-slate-800">
                        {item.description}
                      </td>
                      <td className="py-3.5 px-6 text-center tabular-nums">
                        {item.quantity}
                      </td>
                      <td className="py-3.5 px-6 text-right tabular-nums">
                        <AmountFCFA amount={item.unitPrice} />
                      </td>
                      <td className="py-3.5 px-6 text-right font-bold text-slate-800 tabular-nums">
                        <AmountFCFA amount={item.quantity * item.unitPrice} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total calculations block */}
              <div className="flex justify-end p-6 border-t border-slate-100 bg-slate-50/20">
                <div className="w-80 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span>SOUS-TOTAL HT</span>
                    <span className="tabular-nums"><AmountFCFA amount={subtotal} /></span>
                  </div>
                  {applyVat && (
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                      <span>TVA ({vatRate}%)</span>
                      <span className="tabular-nums"><AmountFCFA amount={vat} /></span>
                    </div>
                  )}
                  <div className="h-px bg-slate-200" />
                  <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                    <span>MONTANT TTC</span>
                    <span className="text-base font-extrabold text-[#16A34A] tabular-nums">
                      <AmountFCFA amount={total} highlight />
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Columns: Info block */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-55">
              <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider">Timeline Devis</CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-xs text-slate-600 space-y-4">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-semibold text-slate-800">Créé le {quote.issueDate}</span>
              </div>
              {quote.status === "envoyée" && (
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-semibold text-slate-800">Envoyé au client</span>
                </div>
              )}
              {quote.status === "accepted" && (
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-semibold text-slate-800">Devis accepté ! Prêt pour facturation de jalon.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {quote.status === "accepted" && (
            <Card className="bg-emerald-50/50 border-emerald-100 shadow-sm p-5 flex gap-3 text-xs">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <h4 className="font-bold text-emerald-800">Prêt à facturer</h4>
                <p className="text-emerald-700 mt-0.5">Le devis a été validé. Cliquez sur &quot;Facturer par jalons&quot; ci-dessus pour générer les factures d&apos;acompte et de solde correspondantes.</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Convert to Milestone Invoices Dialog */}
      <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
        <ConvertToInvoicesModal
          quoteId={quote.id}
          quoteTotal={total}
          onClose={() => setIsConvertOpen(false)}
          onSuccess={handleConvertSuccess}
        />
      </Dialog>
    </div>
  );
}
