"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Edit, ArrowLeft, Calendar, User, FileText, CheckCircle2, Save, AlertTriangle, Send, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { fetchOrgSettings, OrgSettings, normalizeWhatsAppNumber, errorMessage } from "@/lib/utils/orgProfile";
import { useRouter, useSearchParams } from "next/navigation";
import { generateDocumentPDF } from "@/lib/utils/pdf";
import StatusBadge from "@/components/shared/StatusBadge";
import AmountFCFA from "@/components/shared/AmountFCFA";
import DateDisplay from "@/components/shared/DateDisplay";
import ReminderPanel from "./ReminderPanel";
import { Label } from "@/components/ui/label";
import DevisLineEditor, { DevisLine } from "../devis/DevisLineEditor";
import { formatFCFA, formatDate } from "@/lib/utils/format";
import { createBrowserClient } from "@/lib/supabase/client";
import { useUnsavedChanges } from "@/lib/hooks/useUnsavedChanges";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface ClientItem {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface InvoicePayment {
  id: string;
  amount: number;
  date: string;
  method: string;
  note?: string;
}

interface InvoiceItem {
  id: string;
  invoiceRef: string;
  clientName: string;
  clientId: string;
  clientPhone: string;
  clientEmail: string;
  orgId: string;
  issueDate: string;
  dueDate: string;
  total: number;
  status: string;
  lines: DevisLine[];
  timeline: { status: string; date: string; comment?: string }[];
  payments: InvoicePayment[];
}

interface FactureDetailProps {
  invoiceId: string;
}

export default function FactureDetail({ invoiceId }: FactureDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryId = searchParams.get("id");
  const actualInvoiceId = (invoiceId === "modifier" && queryId) ? queryId : invoiceId;

  const [invoice, setInvoice] = useState<InvoiceItem | null>(null);
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states for edit mode
  const [editClient, setEditClient] = useState("");
  const [editIssueDate, setEditIssueDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editLines, setEditLines] = useState<DevisLine[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);

  // Send modal states
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sendChannel, setSendChannel] = useState<"email" | "whatsapp">("email");
  const [shouldMarkAsSent, setShouldMarkAsSent] = useState(false);
  const [attachPdf, setAttachPdf] = useState(true);

  // Payment registration modal states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("Virement");
  const [paymentNote, setPaymentNote] = useState("");
  const [deletePaymentCandidate, setDeletePaymentCandidate] = useState<InvoicePayment | null>(null);

  // Fetch clients from Supabase
  const loadClients = async () => {
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .schema("nafaflow")
        .from("clients")
        .select("id, name, whatsapp, email")
        .order("name", { ascending: true });

      if (error) throw error;
      if (data) {
        setClients(
          data.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.whatsapp || "",
            email: c.email || "",
          }))
        );
      }
    } catch (err) {
      console.error("Error loading clients:", err);
    }
  };

  useEffect(() => {
    fetchOrgSettings().then(setSettings);
    loadClients();
  }, []);

  const loadInvoice = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();

      // 1. Fetch parent invoice record
      const { data: invData, error: invErr } = await supabase
        .schema("nafaflow")
        .from("invoices")
        .select("*, clients(*)")
        .eq("id", actualInvoiceId)
        .single();

      if (invErr) throw invErr;

      // 2. Fetch invoice lines
      const { data: linesData, error: linesErr } = await supabase
        .schema("nafaflow")
        .from("invoice_lines")
        .select("*")
        .eq("invoice_id", actualInvoiceId);

      if (linesErr) throw linesErr;

      // 3. Fetch payments
      const { data: paymentsData, error: paymentsErr } = await supabase
        .schema("nafaflow")
        .from("payments")
        .select("*")
        .eq("invoice_id", actualInvoiceId)
        .order("paid_at", { ascending: true });

      if (paymentsErr) throw paymentsErr;

      if (invData) {
        // Status mapping (DB to frontend UI)
        let mappedStatus = invData.status || "draft";
        if (mappedStatus === "draft") mappedStatus = "brouillon";
        else if (mappedStatus === "sent") mappedStatus = "envoyée";
        else if (mappedStatus === "paid") mappedStatus = "payée";
        else if (mappedStatus === "partial") mappedStatus = "partiellement payée";
        else if (mappedStatus === "overdue") mappedStatus = "en retard";

        // Reference naming
        const year = new Date(invData.created_at).getFullYear();
        const shortId = invData.id.split("-")[0]?.slice(0, 4).toUpperCase();
        const invoiceRef = invData.number || `NF-${year}-${shortId}`;

        // Map database lines to DevisLine structure
        const lines: DevisLine[] = (linesData || []).map((line) => ({
          id: line.id,
          serviceId: line.service_id || null,
          description: line.description || "",
          quantity: Number(line.qty) || 1,
          unitPrice: Number(line.unit_price) || 0,
        }));

        // Map database payments to InvoicePayment structure
        const payments: InvoicePayment[] = (paymentsData || []).map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          date: p.paid_at,
          method: p.method || "Virement",
          note: p.note || undefined,
        }));

        // Generate dynamic timeline events
        const timeline = [];
        const issueDateStr = invData.issue_date || invData.created_at.slice(0, 10);
        
        timeline.push({
          status: "brouillon",
          date: issueDateStr,
          comment: "Facture créée",
        });

        if (mappedStatus !== "brouillon") {
          timeline.push({
            status: "envoyée",
            date: issueDateStr,
            comment: "Facture envoyée au client",
          });
        }

        let totalPaymentsSum = 0;
        payments.forEach((p) => {
          totalPaymentsSum += p.amount;
          const currentStatus = totalPaymentsSum >= Number(invData.total) ? "payée" : "partiellement payée";
          timeline.push({
            status: currentStatus,
            date: p.date,
            comment: `Paiement de ${p.amount.toLocaleString()} F CFA reçu (${p.method})`,
          });
        });

        if (mappedStatus === "en retard") {
          timeline.push({
            status: "en retard",
            date: invData.due_date,
            comment: "Date d'échéance dépassée",
          });
        }

        timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setInvoice({
          id: invData.id,
          invoiceRef,
          clientName: invData.clients?.name || "Client Inconnu",
          clientId: invData.client_id,
          clientPhone: invData.clients?.whatsapp || "",
          clientEmail: invData.clients?.email || "",
          orgId: invData.org_id,
          issueDate: issueDateStr,
          dueDate: invData.due_date || "",
          total: Math.round(Number(invData.total)),
          status: mappedStatus,
          lines,
          payments,
          timeline,
        });
      }
    } catch (err: unknown) {
      console.error(err);
      const message = errorMessage(err);
      toast.error(`Erreur de chargement : ${message}`);
    } finally {
      setLoading(false);
    }
  }, [actualInvoiceId]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  useEffect(() => {
    if (invoice) {
      setEditClient(invoice.clientId);
      setEditIssueDate(invoice.issueDate);
      setEditDueDate(invoice.dueDate);
      setEditLines(invoice.lines || []);
      setShouldMarkAsSent(invoice.status === "brouillon");
    }
  }, [invoice]);

  // Avertir avant de quitter en mode édition si des changements ne sont pas enregistrés
  const isDirtyEdit = invoiceId === "modifier" && !!invoice && (
    editClient !== invoice.clientId ||
    editIssueDate !== invoice.issueDate ||
    editDueDate !== invoice.dueDate ||
    JSON.stringify(editLines) !== JSON.stringify(invoice.lines || [])
  );
  useUnsavedChanges(isDirtyEdit);

  const applyVat = settings?.billing?.applyVat ?? true;
  const vatRate = settings?.billing?.vat ?? 18;

  const items = invoice?.lines || [];
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const vat = applyVat ? Math.round(subtotal * (vatRate / 100)) : 0;
  const total = subtotal + vat;

  const payments = invoice?.payments || [];
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = Math.max(0, total - totalPaid);
  const isOverdue = invoice?.status === "en retard";

  const handleDownloadPDF = async () => {
    if (!invoice) return;

    try {
      await generateDocumentPDF({
        id: invoice.invoiceRef,
        type: "facture",
        clientName: invoice.clientName,
        clientId: invoice.clientId,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        status: invoice.status,
        lines: invoice.lines,
        total: total,
        amountPaid: totalPaid,
        amountRemaining: remainingAmount,
      });
      toast.success(`Le PDF de la facture ${invoice.invoiceRef} a été généré et téléchargé.`);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors du téléchargement du PDF.");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!invoice) return;

    try {
      const supabase = createBrowserClient();
      
      // Map frontend status to DB status
      let dbStatus = "draft";
      if (newStatus === "brouillon") dbStatus = "draft";
      else if (newStatus === "envoyée") dbStatus = "sent";
      else if (newStatus === "payée") dbStatus = "paid";
      else if (newStatus === "partiellement payée") dbStatus = "partial";
      else if (newStatus === "en retard") dbStatus = "overdue";

      const { error } = await supabase
        .schema("nafaflow")
        .from("invoices")
        .update({ status: dbStatus })
        .eq("id", invoice.id);

      if (error) throw error;

      toast.success(`Statut mis à jour avec succès : ${newStatus}`);
      loadInvoice();
    } catch (err: unknown) {
      console.error(err);
      const message = errorMessage(err);
      toast.error(`Erreur lors du changement de statut : ${message}`);
    }
  };

  const handleSavePayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!invoice) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Veuillez saisir un montant de paiement valide.");
      return;
    }

    if (amount > remainingAmount) {
      toast.error(`Le montant ne peut pas dépasser le reste à payer (${remainingAmount.toLocaleString()} F)`);
      return;
    }

    try {
      const supabase = createBrowserClient();
      
      // Standardize primary key shared by payment and cash_entry
      const sharedId = crypto.randomUUID();

      // 1. Create matching cash entry in Treasury (nafaflow.cash_entries)
      const cashEntry = {
        id: sharedId,
        org_id: invoice.orgId,
        entry_date: paymentDate,
        type: "in",
        amount: amount,
        label: `Paiement facture ${invoice.invoiceRef} — ${invoice.clientName}`,
        category: "Ventes",
        link_type: "invoice",
        link_id: invoice.id,
      };

      const { error: cashErr } = await supabase
        .schema("nafaflow")
        .from("cash_entries")
        .insert(cashEntry);

      if (cashErr) throw cashErr;

      // 2. Create payment record (nafaflow.payments)
      const paymentRow = {
        id: sharedId,
        org_id: invoice.orgId,
        invoice_id: invoice.id,
        amount: amount,
        paid_at: paymentDate,
        method: paymentMethod,
        note: paymentNote.trim() || null,
      };

      const { error: payErr } = await supabase
        .schema("nafaflow")
        .from("payments")
        .insert(paymentRow);

      if (payErr) {
        // Rollback cash entry
        await supabase.schema("nafaflow").from("cash_entries").delete().eq("id", sharedId);
        throw payErr;
      }

      // 3. Recalculate status
      const newTotalPaid = totalPaid + amount;
      let newStatus = invoice.status;
      if (invoice.status !== "brouillon") {
        if (newTotalPaid >= total) {
          newStatus = "payée";
        } else if (newTotalPaid > 0) {
          newStatus = "partiellement payée";
        } else {
          newStatus = "envoyée";
        }
      }

      // Map frontend status to DB status
      let dbStatus = "draft";
      if (newStatus === "brouillon") dbStatus = "draft";
      else if (newStatus === "envoyée") dbStatus = "sent";
      else if (newStatus === "payée") dbStatus = "paid";
      else if (newStatus === "partiellement payée") dbStatus = "partial";
      else if (newStatus === "en retard") dbStatus = "overdue";

      const { error: invErr } = await supabase
        .schema("nafaflow")
        .from("invoices")
        .update({ status: dbStatus })
        .eq("id", invoice.id);

      if (invErr) throw invErr;

      toast.success("Paiement enregistré avec succès et trésorerie mise à jour.");
      setIsPaymentModalOpen(false);
      setPaymentAmount("");
      setPaymentNote("");
      loadInvoice();
    } catch (err: unknown) {
      console.error(err);
      const message = errorMessage(err);
      toast.error(`Erreur d'enregistrement du paiement : ${message}`);
    }
  };

  const handleMarkAsPaidShortcut = async () => {
    if (!invoice || remainingAmount <= 0) return;

    try {
      const supabase = createBrowserClient();
      const sharedId = crypto.randomUUID();
      const todayStr = new Date().toISOString().slice(0, 10);

      // 1. Create cash entry in treasury
      const cashEntry = {
        id: sharedId,
        org_id: invoice.orgId,
        entry_date: todayStr,
        type: "in",
        amount: remainingAmount,
        label: `Paiement facture ${invoice.invoiceRef} — ${invoice.clientName}`,
        category: "Ventes",
        link_type: "invoice",
        link_id: invoice.id,
      };

      const { error: cashErr } = await supabase
        .schema("nafaflow")
        .from("cash_entries")
        .insert(cashEntry);

      if (cashErr) throw cashErr;

      // 2. Add payment record
      const paymentRow = {
        id: sharedId,
        org_id: invoice.orgId,
        invoice_id: invoice.id,
        amount: remainingAmount,
        paid_at: todayStr,
        method: "Autre",
        note: "Paiement intégral rapide",
      };

      const { error: payErr } = await supabase
        .schema("nafaflow")
        .from("payments")
        .insert(paymentRow);

      if (payErr) {
        // Rollback cash entry
        await supabase.schema("nafaflow").from("cash_entries").delete().eq("id", sharedId);
        throw payErr;
      }

      // 3. Update invoice status
      const { error: invErr } = await supabase
        .schema("nafaflow")
        .from("invoices")
        .update({ status: "paid" })
        .eq("id", invoice.id);

      if (invErr) throw invErr;

      toast.success("Facture marquée comme payée. Trésorerie mise à jour.");
      loadInvoice();
    } catch (err: unknown) {
      console.error(err);
      const message = errorMessage(err);
      toast.error(`Erreur : ${message}`);
    }
  };

  const handleDeletePayment = async () => {
    if (!invoice || !deletePaymentCandidate) return;

    try {
      const supabase = createBrowserClient();
      const paymentToDelete = deletePaymentCandidate;

      // 1. Delete payment record (cascades or delete manually)
      const { error: payErr } = await supabase
        .schema("nafaflow")
        .from("payments")
        .delete()
        .eq("id", paymentToDelete.id);

      if (payErr) throw payErr;

      // 2. Delete matching cash entry using shared UUID
      const { error: cashErr } = await supabase
        .schema("nafaflow")
        .from("cash_entries")
        .delete()
        .eq("id", paymentToDelete.id);

      if (cashErr) throw cashErr;

      // 3. Recalculate status
      const newTotalPaid = totalPaid - paymentToDelete.amount;
      let newStatus = invoice.status;
      if (invoice.status !== "brouillon") {
        if (newTotalPaid >= total) {
          newStatus = "payée";
        } else if (newTotalPaid > 0) {
          newStatus = "partiellement payée";
        } else {
          newStatus = "envoyée";
        }
      }

      // Map frontend status to DB status
      let dbStatus = "draft";
      if (newStatus === "brouillon") dbStatus = "draft";
      else if (newStatus === "envoyée") dbStatus = "sent";
      else if (newStatus === "payée") dbStatus = "paid";
      else if (newStatus === "partiellement payée") dbStatus = "partial";
      else if (newStatus === "en retard") dbStatus = "overdue";

      const { error: invErr } = await supabase
        .schema("nafaflow")
        .from("invoices")
        .update({ status: dbStatus })
        .eq("id", invoice.id);

      if (invErr) throw invErr;

      toast.error("Paiement supprimé et écriture de caisse annulée.");
      setDeletePaymentCandidate(null);
      loadInvoice();
    } catch (err: unknown) {
      console.error(err);
      const message = errorMessage(err);
      toast.error(`Erreur lors de la suppression du paiement : ${message}`);
    }
  };

  const handleSaveChanges = async () => {
    if (!invoice) return;
    if (editLines.length === 0) {
      toast.error("Veuillez ajouter au moins une prestation.");
      return;
    }

    try {
      const supabase = createBrowserClient();
      const subtotal = editLines.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const editTotal = applyVat ? subtotal * (1 + vatRate / 100) : subtotal;

      // 1. Update invoice parent
      const { error: parentErr } = await supabase
        .schema("nafaflow")
        .from("invoices")
        .update({
          client_id: editClient,
          issue_date: editIssueDate,
          due_date: editDueDate,
          total: Math.round(editTotal),
        })
        .eq("id", invoice.id);

      if (parentErr) throw parentErr;

      // 2. Delete old lines
      const { error: delLinesErr } = await supabase
        .schema("nafaflow")
        .from("invoice_lines")
        .delete()
        .eq("invoice_id", invoice.id);

      if (delLinesErr) throw delLinesErr;

      // 3. Batch insert new lines (préserve le lien catalogue pour le P&L)
      const newLinesRows = editLines.map((line) => ({
        invoice_id: invoice.id,
        service_id: line.serviceId || null,
        description: line.description,
        qty: line.quantity,
        unit_price: line.unitPrice,
        total: line.quantity * line.unitPrice,
      }));

      const { error: insLinesErr } = await supabase
        .schema("nafaflow")
        .from("invoice_lines")
        .insert(newLinesRows);

      if (insLinesErr) throw insLinesErr;

      toast.success("Facture modifiée avec succès !");
      router.push(`/factures/${invoice.id}`);
      loadInvoice();
    } catch (err: unknown) {
      console.error(err);
      const message = errorMessage(err);
      toast.error(`Erreur de modification : ${message}`);
    }
  };

  const replaceTemplateVariables = (template: string) => {
    if (!invoice) return "";
    const formattedTotal = formatFCFA(total);
    const formattedDate = formatDate(invoice.dueDate);
    return template
      .replace(/\{\{prenom\}\}/g, invoice.clientName)
      .replace(/\{\{numero\}\}/g, invoice.invoiceRef)
      .replace(/\{\{montant\}\}/g, formattedTotal)
      .replace(/\{\{date\}\}/g, formattedDate);
  };

  const handleExecuteSend = async () => {
    if (!invoice) return;

    const emailTemplate = settings?.templates?.emailTemplateFr || "Bonjour {{prenom}},\n\nVous trouverez ci-joint la facture {{numero}} d'un montant de {{montant}}, payable avant le {{date}}.\n\nCordialement.";
    const whatsappTemplate = settings?.templates?.whatsappTemplateFr || "Bonjour {{prenom}}, nous vous informons que la facture {{numero}} d'un montant de {{montant}} est disponible. Merci de régler avant le {{date}}.";

    const emailBody = replaceTemplateVariables(emailTemplate);
    const whatsappBody = replaceTemplateVariables(whatsappTemplate);

    if (sendChannel === "email" && !invoice.clientEmail) {
      toast.error("Ce client n'a pas d'adresse email. Ajoutez-la dans sa fiche client.");
      return;
    }
    if (sendChannel === "whatsapp" && !normalizeWhatsAppNumber(invoice.clientPhone)) {
      toast.error("Ce client n'a pas de numéro WhatsApp valide. Ajoutez-le dans sa fiche client.");
      return;
    }

    // WhatsApp et mailto ne permettent pas de joindre un fichier automatiquement :
    // on télécharge le PDF juste avant, prêt à être glissé dans la conversation.
    if (attachPdf) {
      try {
        await generateDocumentPDF({
          id: invoice.invoiceRef,
          type: "facture",
          clientName: invoice.clientName,
          clientId: invoice.clientId,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          status: invoice.status,
          lines: invoice.lines,
          total: total,
          amountPaid: totalPaid,
          amountRemaining: remainingAmount,
        });
      } catch (err) {
        console.error(err);
        toast.error("Le PDF n'a pas pu être généré, l'envoi continue sans pièce jointe.");
      }
    }

    if (sendChannel === "email") {
      const subject = `Facture ${invoice.invoiceRef}${settings?.company?.name ? ` - ${settings.company.name}` : ""}`;
      const mailtoUrl = `mailto:${invoice.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
      window.open(mailtoUrl, "_blank");
      toast.success(
        attachPdf
          ? "E-mail ouvert. Le PDF a été téléchargé : joignez-le à votre message."
          : "Client d'e-mail ouvert avec succès !"
      );
    } else {
      const formattedPhone = normalizeWhatsAppNumber(invoice.clientPhone);
      const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(whatsappBody)}`;
      window.open(waUrl, "_blank");
      toast.success(
        attachPdf
          ? "WhatsApp ouvert vers le numéro du client. Le PDF a été téléchargé : joignez-le à la conversation (trombone ➜ Document)."
          : "Lien WhatsApp ouvert avec succès !"
      );
    }

    if (shouldMarkAsSent && invoice.status !== "payée") {
      handleStatusChange("envoyée");
    }

    setIsSendModalOpen(false);
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Chargement de la facture...</div>;
  }

  if (!invoice) {
    return <div className="p-8 text-center text-slate-550 font-bold">Erreur : Facture introuvable.</div>;
  }

  const isEditing = invoiceId === "modifier";

  if (isEditing) {
    const editSubtotal = editLines.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const editVat = applyVat ? Math.round(editSubtotal * (vatRate / 100)) : 0;
    const editTotal = editSubtotal + editVat;
    const isBrouillon = invoice.status === "brouillon";

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => router.push(`/factures/${invoice.id}`)}
            className="h-9 w-9 rounded-lg border-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Modifier la facture {invoice.invoiceRef}
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Édition du contenu et des prestations
            </p>
          </div>
        </div>

        {/* Warning Banner if not Brouillon */}
        {!isBrouillon && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-800">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold">Attention</h4>
              <p className="mt-0.5">Cette facture a déjà été envoyée ou payée (Statut actuel: <span className="font-extrabold uppercase text-amber-700">{invoice.status}</span>). Êtes-vous sûr de vouloir modifier son contenu ?</p>
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

                  {/* Date d'échéance */}
                  <div className="space-y-1.5">
                    <Label htmlFor="due-date" className="text-[10px] font-bold text-slate-500 uppercase">
                      Date d&apos;échéance
                    </Label>
                    <input
                      id="due-date"
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
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
                    onClick={() => router.push(`/factures/${invoice.id}`)}
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
    <div className="space-y-6 pb-20">
      {/* Detail Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg border-slate-200 shrink-0"
          >
            <Link href="/factures">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">{invoice.invoiceRef}</h2>
              
              {/* Dropdown status selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm cursor-pointer group active:scale-95">
                    <span className="text-[10px] font-bold text-slate-400 mr-1 uppercase">Statut :</span>
                    <StatusBadge status={invoice.status} className="border-0 p-0 text-[10px]" />
                    <span className="text-[9px] text-slate-400 font-bold group-hover:text-slate-600 transition-colors ml-0.5">▼</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-white border border-slate-100 shadow-lg rounded-xl p-1 text-slate-700 min-w-32 z-50">
                  <DropdownMenuItem
                    onClick={() => handleStatusChange("brouillon")}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span>Brouillon</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleStatusChange("envoyée")}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span>Envoyée</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleStatusChange("en retard")}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span>En retard</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Détails et historique de l&apos;état de facturation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {remainingAmount > 0 && (
            <Button
              type="button"
              onClick={() => {
                setPaymentAmount(String(remainingAmount));
                setIsPaymentModalOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 rounded-lg text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-700/10"
            >
              <Plus className="h-4 w-4" />
              <span>Enregistrer un paiement</span>
            </Button>
          )}

          <Button
            type="button"
            onClick={() => setIsSendModalOpen(true)}
            className="bg-[#16A34A] hover:bg-[#15803D] text-white font-bold h-9 rounded-lg text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-700/10"
          >
            <Send className="h-4 w-4" />
            <span>Envoyer</span>
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

          <Button
            asChild
            variant="outline"
            size="sm"
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold border-slate-200 h-9 rounded-lg text-xs flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <Link href={`/factures/modifier?id=${invoice.id}`}>
              <Edit className="h-4 w-4 text-slate-400" />
              <span>Modifier</span>
            </Link>
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
                  <span className="block text-slate-800 font-bold truncate">{invoice.clientName}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 uppercase tracking-wide text-[9px]">Émis le</span>
                  <span className="block text-slate-700 font-bold">
                    <DateDisplay date={invoice.issueDate} />
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 uppercase tracking-wide text-[9px]">Échéance</span>
                  <span className="block text-slate-700 font-bold">
                    <DateDisplay date={invoice.dueDate} />
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 uppercase tracking-wide text-[9px]">Délai</span>
                  <span className="block text-slate-700 font-bold flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>30 jours</span>
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
                    <p className="text-slate-700 font-medium">Raison Sociale: {invoice.clientName}</p>
                    <p className="text-slate-450 text-[10px]">Identifiant Client: {invoice.clientId}</p>
                  </div>
                </div>

                {/* Legal information */}
                <div className="flex gap-2">
                  <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">Identifiants Légaux</span>
                    <p className="text-slate-700 font-medium">Pays: Sénégal (UEMOA)</p>
                    <p className="text-slate-450 text-[10px]">TVA: {applyVat ? `${vatRate}%` : "Non applicable"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Invoice Lines/Items */}
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
                  
                  {/* Financial Link Details */}
                  <div className="h-px bg-slate-250/50 my-1" />
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span>DÉJÀ PAYÉ</span>
                    <span className="tabular-nums text-slate-700 font-bold"><AmountFCFA amount={totalPaid} /></span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span>RESTE À PAYER</span>
                    <span className={`tabular-nums font-bold ${remainingAmount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      <AmountFCFA amount={remainingAmount} />
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Columns: Warning panel (1/3 width) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Payments summary and shortcut */}
          <Card className="bg-white border-slate-100 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-50">
              <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">Suivi des Règlements</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Progression</span>
                  <span className="font-bold text-slate-700">
                    {total > 0 ? Math.round((totalPaid / total) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${total > 0 ? Math.min(100, (totalPaid / total) * 100) : 0}%` }}
                  />
                </div>
              </div>

              {/* Payments History List */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Historique des paiements</span>
                {payments.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden bg-slate-50/20">
                    {payments.map((p) => (
                      <div key={p.id} className="p-3 text-xs flex justify-between items-start hover:bg-slate-50 transition-all group">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-700"><AmountFCFA amount={p.amount} /></span>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-150 border border-slate-200/50 rounded text-slate-500 uppercase tracking-wider">{p.method}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            <DateDisplay date={p.date} />
                            {p.note && <span className="block italic text-slate-500 mt-0.5">&ldquo;{p.note}&rdquo;</span>}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletePaymentCandidate(p)}
                          className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-450 italic text-center py-4 bg-slate-50 rounded-lg border border-slate-100">
                    Aucun paiement enregistré.
                  </p>
                )}
              </div>

              {/* Sidebar Quick Actions */}
              {remainingAmount > 0 && (
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setPaymentAmount(String(remainingAmount));
                      setIsPaymentModalOpen(true);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 rounded-lg active:scale-95 transition-all shadow"
                  >
                    Enregistrer un paiement
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleMarkAsPaidShortcut}
                    className="w-full border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs h-9 rounded-lg active:scale-95 transition-all"
                  >
                    Marquer comme payée (intégral)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Progression Flow / Alert Info */}
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-50">
              <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">Timeline Facturation</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="relative pl-6 border-l border-slate-200 space-y-5 ml-1">
                {invoice.timeline && invoice.timeline.map((node, index) => (
                  <div key={index} className="relative text-xs">
                    <span className="absolute -left-[29px] h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                    <div className="font-bold text-slate-800 uppercase text-[9px]"><StatusBadge status={node.status} className="border-0 p-0 text-[9px]" /></div>
                    <span className="block text-[10px] text-slate-400 mt-0.5">{node.comment} le {node.date}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Conditional Overdue Reminder Panel */}
          {isOverdue && (
            <ReminderPanel
              invoiceId={invoice.invoiceRef}
              clientName={invoice.clientName}
              clientPhone={invoice.clientPhone}
              clientEmail={invoice.clientEmail}
              amountTTC={invoice.total}
            />
          )}

          {/* Payment info static card if fully paid */}
          {invoice.status === "payée" && (
            <Card className="bg-emerald-50/50 border-emerald-100 shadow-sm p-5 flex gap-3 text-xs">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <h4 className="font-bold text-emerald-800">Paiement reçu</h4>
                <p className="text-emerald-700 mt-0.5">Cette facture a été réglée en totalité. Aucun rappel n&apos;est requis.</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog for Send Options */}
      <Dialog open={isSendModalOpen} onOpenChange={setIsSendModalOpen}>
        <DialogContent className="bg-white border-slate-100 shadow-xl rounded-2xl p-6 max-w-md text-slate-700">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Send className="h-5 w-5 text-[#16A34A]" />
              <span>Envoyer la facture {invoice.invoiceRef}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 my-4">
            {/* Channel Selection Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSendChannel("email")}
                className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition-all ${
                  sendChannel === "email"
                    ? "border-[#16A34A] bg-[#F0FDF4] text-[#16A34A] shadow-sm"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <span className="text-base">📧</span>
                <span>Par E-mail</span>
                <span className={`text-[10px] font-medium truncate max-w-full ${invoice.clientEmail ? "text-slate-400" : "text-red-500"}`}>
                  {invoice.clientEmail || "Aucun email enregistré"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSendChannel("whatsapp")}
                className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition-all ${
                  sendChannel === "whatsapp"
                    ? "border-[#16A34A] bg-[#F0FDF4] text-[#16A34A] shadow-sm"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <span className="text-base">💬</span>
                <span>Par WhatsApp</span>
                <span className={`text-[10px] font-medium truncate max-w-full ${normalizeWhatsAppNumber(invoice.clientPhone) ? "text-slate-400" : "text-red-500"}`}>
                  {normalizeWhatsAppNumber(invoice.clientPhone)
                    ? `+${normalizeWhatsAppNumber(invoice.clientPhone)}`
                    : "Aucun numéro enregistré"}
                </span>
              </button>
            </div>

            {/* Missing contact warning */}
            {((sendChannel === "email" && !invoice.clientEmail) ||
              (sendChannel === "whatsapp" && !normalizeWhatsAppNumber(invoice.clientPhone))) && (
              <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg text-[11px] text-red-700 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {sendChannel === "email"
                    ? "Ce client n'a pas d'adresse email. Complétez sa fiche dans la page Clients avant l'envoi."
                    : "Ce client n'a pas de numéro WhatsApp. Complétez sa fiche dans la page Clients avant l'envoi."}
                </span>
              </div>
            )}

            {/* Message Preview Box */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Aperçu du message</span>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600 font-semibold whitespace-pre-wrap max-h-40 overflow-y-auto">
                {sendChannel === "email"
                  ? replaceTemplateVariables(settings?.templates?.emailTemplateFr || "Bonjour {{prenom}},\n\nVous trouverez ci-joint la facture {{numero}} d'un montant de {{montant}}, payable avant le {{date}}.\n\nCordialement.")
                  : replaceTemplateVariables(settings?.templates?.whatsappTemplateFr || "Bonjour {{prenom}}, nous vous informons que la facture {{numero}} d'un montant de {{montant}} est disponible. Merci de régler avant le {{date}}.")}
              </div>
            </div>

            {/* Attach PDF Option */}
            <div className="flex items-start gap-2.5 p-2 bg-[#F8FAFC] border border-slate-100 rounded-lg">
              <input
                type="checkbox"
                id="attach-pdf-check"
                checked={attachPdf}
                onChange={(e) => setAttachPdf(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#16A34A] focus:ring-[#16A34A]"
              />
              <div className="space-y-0.5">
                <label htmlFor="attach-pdf-check" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Télécharger le PDF de la facture avant l&apos;envoi
                </label>
                <p className="text-[10px] text-slate-400 font-medium">
                  WhatsApp et l&apos;email ne peuvent pas joindre un fichier automatiquement : le PDF sera téléchargé, il ne vous restera qu&apos;à le glisser dans la conversation.
                </p>
              </div>
            </div>

            {/* Change Status Checkbox Option */}
            {invoice.status !== "payée" && (
              <div className="flex items-start gap-2.5 p-2 bg-[#F8FAFC] border border-slate-100 rounded-lg">
                <input
                  type="checkbox"
                  id="mark-sent-check"
                  checked={shouldMarkAsSent}
                  onChange={(e) => setShouldMarkAsSent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#16A34A] focus:ring-[#16A34A]"
                />
                <div className="space-y-0.5">
                  <label htmlFor="mark-sent-check" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Marquer le statut de la facture comme &quot;Envoyée&quot;
                  </label>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Met à jour le badge de statut et l&apos;historique de la facture.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSendModalOpen(false)}
              className="rounded-lg border-slate-200 text-xs font-bold"
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleExecuteSend}
              className="bg-[#16A34A] hover:bg-[#15803D] text-white font-bold rounded-lg text-xs"
            >
              Confirmer et Ouvrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Recording a Payment */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="bg-white border-slate-100 shadow-xl rounded-2xl p-6 max-w-md text-slate-700">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">
              Enregistrer un paiement
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSavePayment} className="space-y-4 my-2">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Montant Reçu (FCFA) *
              </Label>
              <input
                id="pay-amount"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Entrez le montant"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-slate-700 font-semibold"
                required
              />
              <p className="text-[10px] text-slate-400 font-medium">
                Reste à payer : <span className="font-bold text-slate-600">{remainingAmount.toLocaleString()} F</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pay-date" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Date de paiement *
                </Label>
                <input
                  id="pay-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-slate-700 font-semibold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-method" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Moyen de paiement
                </Label>
                <select
                  id="pay-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-slate-700 font-semibold"
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Virement">Virement</option>
                  <option value="Wave">Wave</option>
                  <option value="Orange Money">Orange Money</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-note" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Note / Commentaire (optionnel)
              </Label>
              <input
                id="pay-note"
                type="text"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="Ex: Acompte, virement Wave reçu, etc."
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-slate-700 font-semibold"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-6 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPaymentModalOpen(false)}
                className="rounded-lg border-slate-200 text-xs font-bold"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs"
              >
                Valider le paiement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for Deleting a Payment */}
      <Dialog open={deletePaymentCandidate !== null} onOpenChange={(open) => !open && setDeletePaymentCandidate(null)}>
        <DialogContent className="bg-white border-slate-100 shadow-xl rounded-2xl p-6 max-w-sm text-slate-700">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <span>Annuler ce paiement ?</span>
            </DialogTitle>
          </DialogHeader>

          <div className="my-2 space-y-2 text-xs text-slate-600">
            <p>
              Êtes-vous sûr de vouloir supprimer le paiement de{" "}
              <span className="font-bold text-slate-800">
                {deletePaymentCandidate ? deletePaymentCandidate.amount.toLocaleString() : 0} F
              </span>{" "}
              enregistré le{" "}
              <span className="font-semibold text-slate-700">
                {deletePaymentCandidate ? deletePaymentCandidate.date : ""}
              </span>{" "}
              ?
            </p>
            <p className="bg-red-50 text-red-700 border border-red-100 p-2.5 rounded-lg font-medium">
              Cette action supprimera également l&apos;encaissement correspondant de trésorerie et recalculera le statut de la facture.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletePaymentCandidate(null)}
              className="rounded-lg border-slate-200 text-xs font-bold"
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleDeletePayment}
              className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs"
            >
              Supprimer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
