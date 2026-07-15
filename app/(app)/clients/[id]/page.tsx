"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, User, Mail, Phone, MapPin, FileText, Landmark, BarChart3 } from "lucide-react";
import Link from "next/link";
import AmountFCFA from "@/components/shared/AmountFCFA";
import ClientHistory from "@/components/clients/ClientHistory";
import { ClientItem, DevisItem, InvoiceItem } from "@/lib/utils/state";
import { createBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface ClientDetailPageProps {
  params: {
    id: string;
  };
}

const formatError = (err: unknown): string => {
  console.error("Supabase operation error detail:", err);
  if (err && typeof err === "object") {
    const errorObj = err as { message?: string; details?: string };
    if (errorObj.message) {
      return `${errorObj.message}${errorObj.details ? " : " + errorObj.details : ""}`;
    }
  }
  return String(err);
};

interface ExtendedInvoiceItem extends InvoiceItem {
  realId: string;
}

interface PaymentLog {
  id: string;
  date: string;
  amount: number;
  method: string;
  invoiceId: string;
}

export default function ClientDetailPage({ params }: ClientDetailPageProps) {
  const clientId = params.id;
  const [client, setClient] = useState<ClientItem | null>(null);
  const [quotes, setQuotes] = useState<DevisItem[]>([]);
  const [invoices, setInvoices] = useState<ExtendedInvoiceItem[]>([]);
  const [payments, setPayments] = useState<PaymentLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = `Fiche Client | NafaFlow`;

    const loadData = async () => {
      setLoading(true);
      const supabase = createBrowserClient();
      try {
        // 1. Fetch client details
        const { data: clientData, error: clientErr } = await supabase
          .schema("nafaflow")
          .from("clients")
          .select("*")
          .eq("id", clientId)
          .maybeSingle();

        if (clientErr) throw clientErr;

        if (clientData) {
          const [ninea, rc] = (clientData.tax_id || "").split("|");
          setClient({
            id: clientData.id,
            name: clientData.name,
            email: clientData.email || "",
            phone: clientData.whatsapp || "",
            sector: clientData.sector || "Technologie",
            address: clientData.address || "",
            ninea: ninea || "",
            rc: rc || "",
          });
          document.title = `Fiche Client ${clientData.name} | NafaFlow`;
        } else {
          setClient({
            id: clientId,
            name: "Client Inconnu",
            email: "contact@client.sn",
            phone: "+221770000000",
            sector: "Technologie",
            address: "Dakar, Sénégal",
            ninea: "",
            rc: "",
          });
        }

        // 2. Fetch quotes
        const { data: quotesData, error: quotesErr } = await supabase
          .schema("nafaflow")
          .from("quotes")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false });

        if (quotesErr) throw quotesErr;

        if (quotesData) {
          const mappedQuotes: DevisItem[] = quotesData.map((q) => {
            const year = new Date(q.created_at).getFullYear();
            const shortId = q.id.split("-")[0]?.slice(0, 4).toUpperCase() || q.id.slice(0, 4).toUpperCase();
            return {
              id: `D-${year}-${shortId}`,
              clientId: q.client_id,
              clientName: clientData?.name || "Client",
              issueDate: q.created_at,
              validityDays: q.valid_until ? Math.ceil((new Date(q.valid_until).getTime() - new Date(q.created_at).getTime()) / (1000 * 3600 * 24)) : 30,
              status: q.status || "draft",
              total: Number(q.total),
              lines: [],
            };
          });
          setQuotes(mappedQuotes);
        }

        // 3. Fetch invoices
        const { data: invoicesData, error: invoicesErr } = await supabase
          .schema("nafaflow")
          .from("invoices")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false });

        if (invoicesErr) throw invoicesErr;

        let mappedInvoices: ExtendedInvoiceItem[] = [];
        if (invoicesData) {
          mappedInvoices = invoicesData.map((i) => {
            const year = new Date(i.created_at).getFullYear();
            const shortId = i.id.split("-")[0]?.slice(0, 4).toUpperCase() || i.id.slice(0, 4).toUpperCase();
            const invoiceRef = i.number || `NF-${year}-${shortId}`;
            return {
              id: invoiceRef,
              realId: i.id, // keep the real uuid
              clientId: i.client_id,
              clientName: clientData?.name || "Client",
              quoteId: i.quote_id || "",
              status: i.status || "draft",
              issueDate: i.issue_date || i.created_at,
              dueDate: i.due_date || "",
              total: Number(i.total),
              lines: [],
              payments: [],
              timeline: [],
            };
          });
          setInvoices(mappedInvoices);
        }

        // 4. Fetch payments linked to client invoices
        const invoiceIds = invoicesData?.map((i) => i.id) || [];
        if (invoiceIds.length > 0) {
          const { data: paymentsData, error: paymentsErr } = await supabase
            .schema("nafaflow")
            .from("payments")
            .select("*")
            .in("invoice_id", invoiceIds)
            .order("paid_at", { ascending: false });

          if (paymentsErr) throw paymentsErr;

          if (paymentsData) {
            const mappedPayments = paymentsData.map((p) => {
              const relatedInvoice = mappedInvoices.find((inv) => inv.realId === p.invoice_id);
              const invoiceRef = relatedInvoice ? relatedInvoice.id : "Facture";
              const shortPayId = p.id.split("-")[0]?.slice(0, 4).toUpperCase() || p.id.slice(0, 4).toUpperCase();
              return {
                id: `PAY-${shortPayId}`,
                date: p.paid_at || p.created_at,
                amount: Number(p.amount),
                method: p.method || "Virement",
                invoiceId: invoiceRef,
              };
            });
            setPayments(mappedPayments);
          }
        }
      } catch (err: unknown) {
        toast.error("Erreur lors du chargement des détails : " + formatError(err));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [clientId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-1 rounded-xl" />
          <Skeleton className="h-64 lg:col-span-2 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!client) {
    return <div className="p-8 text-center text-slate-500 font-medium">Chargement du client...</div>;
  }

  // Financial Stats Calculations
  const totalSales = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const outstanding = invoices
    .filter((inv) => ["sent", "envoyée", "overdue", "en retard", "partial", "partiellement payée"].includes(inv.status.trim().toLowerCase()))
    .reduce((sum, inv) => sum + inv.total, 0);

  const totalQuotes = quotes.length;
  const acceptedQuotes = quotes.filter((q) => ["accepted", "accepté"].includes(q.status.trim().toLowerCase())).length;
  const acceptanceRate = totalQuotes > 0 ? `${Math.round((acceptedQuotes / totalQuotes) * 100)}%` : "0%";

  // Logs mapping for ClientHistory component
  const quoteLogs = quotes.map((q) => ({
    id: q.id,
    date: q.issueDate,
    total: q.total,
    status: q.status,
  }));

  const invoiceLogs = invoices.map((i) => ({
    id: i.id,
    date: i.issueDate,
    total: i.total,
    status: i.status,
  }));

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-lg border-slate-200 shrink-0"
        >
          <Link href="/clients">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">{client.name}</h2>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
              {client.sector}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Fiche détaillée client
          </p>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total revenue */}
        <Card className="bg-white border-slate-100 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase">Chiffre d&apos;Affaires Cumulé</span>
              <h3 className="text-lg font-bold text-slate-800">
                <AmountFCFA amount={totalSales} highlight />
              </h3>
            </div>
            <div className="h-9 w-9 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
              <Landmark className="h-4.5 w-4.5" />
            </div>
          </CardContent>
        </Card>

        {/* Outstanding (due) balance */}
        <Card className="bg-white border-slate-100 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase">Encours (Non payé)</span>
              <h3 className="text-lg font-bold text-slate-800">
                <AmountFCFA amount={outstanding} highlight />
              </h3>
            </div>
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center border shrink-0 ${
              outstanding > 0 ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-slate-50 text-slate-400 border-slate-100"
            }`}>
              <FileText className="h-4.5 w-4.5" />
            </div>
          </CardContent>
        </Card>

        {/* Acceptance Quote Rate */}
        <Card className="bg-white border-slate-100 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase">Taux d&apos;acceptation</span>
              <h3 className="text-lg font-bold text-slate-800">{acceptanceRate}</h3>
            </div>
            <div className="h-9 w-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
              <BarChart3 className="h-4.5 w-4.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details Card Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Client profile metadata details */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-2">
                <User className="h-3.5 w-3.5" />
                <span>Informations de contact</span>
              </h3>
              
              <div className="space-y-3.5 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-slate-500 block text-[10px] uppercase">E-mail</span>
                    <span className="font-semibold text-slate-800 break-all">{client.email}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Phone className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-500 block text-[10px] uppercase">WhatsApp</span>
                    <span className="font-semibold text-slate-800 tabular-nums">{client.phone}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-500 block text-[10px] uppercase">Adresse</span>
                    <span className="font-semibold text-slate-800 leading-snug">{client.address}</span>
                  </div>
                </div>
              </div>

              {/* Tax metadata IDs */}
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-50 pt-2 pb-2">
                <FileText className="h-3.5 w-3.5" />
                <span>Identifiants Administratifs</span>
              </h3>

              <div className="space-y-3.5 text-xs text-slate-600">
                <div>
                  <span className="font-bold text-slate-500 block text-[10px] uppercase">NINEA</span>
                  <span className="font-bold text-slate-800 tabular-nums">{client.ninea || "Non fourni"}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block text-[10px] uppercase">Registre du Commerce</span>
                  <span className="font-bold text-slate-800 tabular-nums">{client.rc || "Non fourni"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Tab logs history (2/3 width) */}
        <div className="lg:col-span-2">
          <ClientHistory
            quotes={quoteLogs}
            invoices={invoiceLogs}
            payments={payments}
          />
        </div>
      </div>
    </div>
  );
}
