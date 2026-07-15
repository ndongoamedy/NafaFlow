"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Mail, FileWarning, Check } from "lucide-react";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";

interface TodoItem {
  id: string;
  type: "reminder" | "quote" | "payment";
  title: string;
  subtitle: string;
  dueDate: string;
  actionText: string;
  actionType: "whatsapp" | "email" | "validate" | "call";
  phone?: string;
  email?: string;
  message?: string;
}

export default function TodoPanel() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTodos = async () => {
      setLoading(true);
      try {
        const supabase = createBrowserClient();
        
        // 1. Fetch overdue invoices
        const { data: overdueInvoices, error: overdueErr } = await supabase
          .schema("nafaflow")
          .from("invoices")
          .select("*, clients(name, whatsapp, email)")
          .eq("status", "overdue");

        // 2. Fetch sent quotes
        const { data: sentQuotes, error: sentErr } = await supabase
          .schema("nafaflow")
          .from("quotes")
          .select("*, clients(name, whatsapp, email)")
          .eq("status", "sent");

        // 3. Fetch accepted quotes
        const { data: acceptedQuotes, error: accErr } = await supabase
          .schema("nafaflow")
          .from("quotes")
          .select("*, clients(name, whatsapp, email)")
          .eq("status", "accepted");

        // 4. Fetch invoices to filter out quotes already converted
        const { data: allInvoices } = await supabase
          .schema("nafaflow")
          .from("invoices")
          .select("quote_id");

        if (overdueErr) throw overdueErr;
        if (sentErr) throw sentErr;
        if (accErr) throw accErr;

        const dynamicList: TodoItem[] = [];

        // Add overdue invoice tasks
        if (overdueInvoices) {
          overdueInvoices.forEach((inv) => {
            const formattedTotal = Math.round(Number(inv.total)).toLocaleString();
            const clientName = inv.clients?.name || "Client Inconnu";
            const invoiceRef = inv.number || `FAC-${inv.id.slice(0, 4).toUpperCase()}`;

            dynamicList.push({
              id: `inv-${inv.id}`,
              type: "reminder",
              title: `Relance Facture ${invoiceRef}`,
              subtitle: `${clientName} (Retard) • ${formattedTotal} F`,
              dueDate: "Aujourd'hui",
              actionText: "Relancer WhatsApp",
              actionType: "whatsapp",
              phone: inv.clients?.whatsapp || "+221770000000",
              message: `Bonjour, nous vous informons que la facture ${invoiceRef} d'un montant de ${formattedTotal} F est en retard. Merci de bien vouloir régulariser. Cordialement.`,
            });
          });
        }

        // Add sent quote tasks
        if (sentQuotes) {
          sentQuotes.forEach((q) => {
            const formattedTotal = Math.round(Number(q.total)).toLocaleString();
            const clientName = q.clients?.name || "Client Inconnu";
            const quoteRef = q.number || `DEV-${q.id.slice(0, 4).toUpperCase()}`;

            dynamicList.push({
              id: `quote-sent-${q.id}`,
              type: "quote",
              title: `Relancer Devis ${quoteRef}`,
              subtitle: `${clientName} (En attente) • ${formattedTotal} F`,
              dueDate: "Demain",
              actionText: "Envoyer e-mail",
              actionType: "email",
              email: q.clients?.email || "client@nafa.sn",
              message: `Bonjour, le devis ${quoteRef} d'un montant de ${formattedTotal} F vous a été envoyé. Merci de nous faire part de vos retours. Cordialement.`,
            });
          });
        }

        // Add accepted quote tasks (only if not converted to invoices yet)
        if (acceptedQuotes) {
          const convertedQuoteIds = new Set(
            (allInvoices || []).map((i) => i.quote_id).filter(Boolean)
          );

          acceptedQuotes.forEach((q) => {
            if (convertedQuoteIds.has(q.id)) return;

            const clientName = q.clients?.name || "Client Inconnu";
            const quoteRef = q.number || `DEV-${q.id.slice(0, 4).toUpperCase()}`;

            dynamicList.push({
              id: `quote-acc-${q.id}`,
              type: "payment",
              title: `Facturer l'acompte`,
              subtitle: `${clientName} • Devis ${quoteRef} signé`,
              dueDate: "À faire",
              actionText: "Facturer",
              actionType: "validate",
            });
          });
        }

        // Uniquement les vraies tâches de l'organisation (aucune donnée de démo)
        setTodos(dynamicList);
      } catch (err) {
        console.error("Error loading todos list:", err);
        setTodos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTodos();
  }, []);

  const handleAction = (item: TodoItem) => {
    if (item.actionType === "whatsapp") {
      const number = item.phone?.replace(/\+/g, "") || "221770000000";
      const text = encodeURIComponent(item.message || "Bonjour, nous vous contactons concernant votre facture.");
      window.open(`https://wa.me/${number}?text=${text}`, "_blank");
      toast.success("Redirection vers WhatsApp...");
    } else if (item.actionType === "email") {
      const mail = item.email || "client@nafa.sn";
      const subject = encodeURIComponent("NafaFlow - Relance document");
      const body = encodeURIComponent(item.message || "Bonjour, merci de consulter le devis en attente.");
      window.open(`mailto:${mail}?subject=${subject}&body=${body}`, "_self");
      toast.success("Ouverture du client de messagerie...");
    } else if (item.actionType === "call") {
      window.open(`tel:${item.phone || "+221770000000"}`, "_self");
      toast.success(`Lancement de l'appel vers ${item.phone || "le client"}...`);
    } else if (item.actionType === "validate") {
      toast.success(`Opération enregistrée : ${item.title}`);
      // Remove item to simulate validation success
      setTodos((prev) => prev.filter((t) => t.id !== item.id));
    }
  };

  return (
    <Card className="bg-white border border-slate-100 shadow-sm flex flex-col h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">À faire aujourd&apos;hui</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Relances en attente et devis à traiter
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-0 flex-1 flex flex-col justify-between">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="animate-pulse flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-50">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-24"></div>
                  <div className="h-3 bg-slate-200 rounded w-48"></div>
                </div>
                <div className="h-8 bg-slate-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : todos.length > 0 ? (
          <div className="space-y-3">
            {todos.map((item) => {
              const isOverdue = item.dueDate === "Retard" || item.dueDate === "Aujourd'hui";
              return (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      {item.type === "reminder" ? (
                        <FileWarning className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      ) : item.type === "quote" ? (
                        <Mail className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                      <span>{item.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-450 font-semibold">{item.subtitle}</p>
                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      isOverdue ? "bg-red-50 text-red-650" : "bg-slate-100 text-slate-500"
                    }`}>
                      {item.dueDate}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(item)}
                    className="h-8 text-[10px] font-bold border-slate-200 text-slate-650 hover:text-slate-800 hover:bg-white px-2 rounded-lg shrink-0 select-none"
                  >
                    {item.actionText}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2 flex-1">
            <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Check className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-slate-500">Tout est à jour ! 🎉</p>
            <p className="text-[10px] text-slate-400">Aucune relance ou facture en attente.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
