"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Save, Send, ShieldAlert, UserPlus } from "lucide-react";
import DevisLineEditor, { DevisLine, DISCOUNT_LABEL } from "@/components/devis/DevisLineEditor";
import { toast } from "sonner";
import { ClientItem } from "@/lib/utils/state";
import { fetchOrgSettings, OrgSettings, errorMessage } from "@/lib/utils/orgProfile";
import { createBrowserClient } from "@/lib/supabase/client";
import { useUnsavedChanges } from "@/lib/hooks/useUnsavedChanges";
import { Switch } from "@/components/ui/switch";

// Création d'une facture directe, sans passer par un devis.
export default function FactureForm() {
  const router = useRouter();

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [client, setClient] = useState("");
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDays, setDueDays] = useState("30");
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<DevisLine[]>([
    { id: "1", description: "", quantity: 1, unitPrice: 0 },
  ]);

  // New Client Inline Modal
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .schema("nafaflow")
          .from("users")
          .select("org_id")
          .eq("id", user.id)
          .single();
        if (userData?.org_id) setOrgId(userData.org_id);
      }

      const { data: clientsData, error: clientsErr } = await supabase
        .schema("nafaflow")
        .from("clients")
        .select("*")
        .order("name", { ascending: true });

      if (clientsErr) throw clientsErr;

      const mappedClients: ClientItem[] = (clientsData || []).map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email || "",
        phone: c.whatsapp || "",
        sector: c.sector || "",
        address: c.address || "",
        ninea: c.tax_id ? c.tax_id.split("|")[0] || "" : "",
        rc: c.tax_id ? c.tax_id.split("|")[1] || "" : "",
      }));

      setClients(mappedClients);
      if (mappedClients.length > 0) setClient(mappedClients[0].id);
    } catch (err: unknown) {
      console.error(err);
      toast.error(`Erreur lors du chargement des données : ${errorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // TVA appliquée à cette facture (par défaut : réglage de l'organisation)
  const [applyVat, setApplyVat] = useState(true);

  useEffect(() => {
    fetchOrgSettings().then((s) => {
      setSettings(s);
      setApplyVat(s?.billing.applyVat ?? true);
      if (s?.billing?.paymentTerm) setDueDays(String(s.billing.paymentTerm));
    });
    loadInitialData();
  }, []);

  // Calculations
  const vatRate = settings?.billing.vat ?? 18;
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const clampedDiscount = Math.max(0, Math.min(discount, subtotal));
  const netHT = subtotal - clampedDiscount;
  const vatAmount = applyVat ? Math.round(netHT * (vatRate / 100)) : 0;
  const totalTTC = netHT + vatAmount;

  // Avertir avant de quitter si des prestations ont été saisies
  const [saved, setSaved] = useState(false);
  useUnsavedChanges(!saved && lines.some((l) => l.description.trim() !== "" || l.unitPrice > 0));

  const handleClientSelectChange = (val: string) => {
    if (val === "new_client") {
      setIsNewClientOpen(true);
    } else {
      setClient(val);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      toast.error("Le nom du client est requis.");
      return;
    }

    try {
      const supabase = createBrowserClient();
      if (!orgId) throw new Error("Organisation introuvable.");

      const { data, error } = await supabase
        .schema("nafaflow")
        .from("clients")
        .insert({
          org_id: orgId,
          name: newClientName.trim(),
          email: newClientEmail.trim() || null,
          whatsapp: newClientPhone.trim() || null,
          sector: "",
          address: "",
          tax_id: "|",
          notes: "",
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newClientItem: ClientItem = {
          id: data.id,
          name: data.name,
          email: data.email || "",
          phone: data.whatsapp || "",
          sector: "",
          address: "",
          ninea: "",
          rc: "",
        };
        setClients((prev) => [...prev, newClientItem].sort((a, b) => a.name.localeCompare(b.name)));
        setClient(data.id);
        setNewClientName("");
        setNewClientEmail("");
        setNewClientPhone("");
        setIsNewClientOpen(false);
        toast.success("Nouveau client créé à la volée !");
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error(`Erreur lors de la création du client : ${errorMessage(err)}`);
    }
  };

  // Numéro de facture : PREFIX-ANNÉE-XXX (séquence par organisation)
  const buildInvoiceNumber = async (supabase: ReturnType<typeof createBrowserClient>, activeOrgId: string) => {
    const prefix = (settings?.billing.numberingPrefix || "NF").replace(/[-\s]+$/, "");
    const { count } = await supabase
      .schema("nafaflow")
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("org_id", activeOrgId);
    return `${prefix}-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, "0")}`;
  };

  const saveInvoice = async (dbStatus: "draft" | "sent") => {
    const validLines = lines.filter((l) => l.description.trim() !== "" && l.unitPrice > 0);
    if (validLines.length === 0) {
      toast.error("Veuillez ajouter au moins une prestation avec une description et un prix.");
      return;
    }
    if (!client) {
      toast.error("Veuillez sélectionner un client.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createBrowserClient();
      if (!orgId) throw new Error("Organisation introuvable.");

      const dueDateObj = new Date(new Date(issueDate).getTime() + (Number(dueDays) || 30) * 24 * 3600 * 1000);
      const dueDate = dueDateObj.toISOString().slice(0, 10);
      const number = await buildInvoiceNumber(supabase, orgId);

      // 1. Facture parente
      const { data: invoiceResult, error: invErr } = await supabase
        .schema("nafaflow")
        .from("invoices")
        .insert({
          org_id: orgId,
          client_id: client,
          quote_id: null,
          number,
          status: dbStatus,
          issue_date: issueDate,
          due_date: dueDate,
          total: Math.round(totalTTC),
          notes: "Facture directe",
        })
        .select()
        .single();

      if (invErr) throw invErr;
      if (!invoiceResult) throw new Error("La facture n'a pas pu être créée.");

      // 2. Lignes de facture (service_id vient de serviceId, jamais de l'id de ligne)
      const linesToInsert = validLines.map((line) => {
        return {
          invoice_id: invoiceResult.id,
          service_id: line.serviceId || null,
          description: line.description,
          qty: line.quantity,
          unit_price: Math.round(line.unitPrice),
          total: Math.round(line.quantity * line.unitPrice),
        };
      });

      // Remise éventuelle : ligne à montant négatif.
      if (clampedDiscount > 0) {
        linesToInsert.push({
          invoice_id: invoiceResult.id,
          service_id: null,
          description: DISCOUNT_LABEL,
          qty: 1,
          unit_price: -Math.round(clampedDiscount),
          total: -Math.round(clampedDiscount),
        });
      }

      const { error: linesErr } = await supabase
        .schema("nafaflow")
        .from("invoice_lines")
        .insert(linesToInsert);

      if (linesErr) throw linesErr;

      toast.success(
        dbStatus === "draft"
          ? `Facture ${number} créée en brouillon.`
          : `Facture ${number} créée et marquée comme envoyée.`
      );
      setSaved(true);
      router.push(`/factures/${invoiceResult.id}`);
    } catch (err: unknown) {
      console.error(err);
      toast.error(`Erreur lors de la création de la facture : ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Chargement des données de la facture...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white border-slate-100 shadow-sm">
        <CardContent className="p-6 space-y-6">
          {/* Header Form Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-slate-100 pb-6">
            {/* Client Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="client" className="text-xs font-bold text-slate-500 uppercase">
                Client
              </Label>
              <div className="flex gap-2">
                <select
                  id="client"
                  value={client}
                  onChange={(e) => handleClientSelectChange(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] text-slate-700 font-semibold"
                >
                  {clients.length === 0 && <option value="">Aucun client — créez-en un →</option>}
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  {clients.length > 0 && (
                    <option value="new_client" className="text-[#16A34A] font-bold bg-[#F0FDF4]">
                      + Nouveau client...
                    </option>
                  )}
                </select>
                <Button
                  type="button"
                  onClick={() => setIsNewClientOpen(true)}
                  title="Nouveau client"
                  className="h-10 w-10 shrink-0 bg-[#F0FDF4] hover:bg-emerald-100 text-[#16A34A] border border-[#16A34A]/20 rounded-lg flex items-center justify-center"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Issue Date */}
            <div className="space-y-1.5">
              <Label htmlFor="issueDate" className="text-xs font-bold text-slate-500 uppercase">
                Date d&apos;émission
              </Label>
              <Input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
              />
            </div>

            {/* Due days */}
            <div className="space-y-1.5">
              <Label htmlFor="dueDays" className="text-xs font-bold text-slate-500 uppercase">
                Échéance de paiement (jours)
              </Label>
              <Input
                id="dueDays"
                type="number"
                min={0}
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value)}
                className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
              />
              <p className="text-[10px] text-slate-400 font-medium">
                Par défaut : votre délai standard configuré dans Paramètres.
              </p>
            </div>
          </div>

          {/* Toggle TVA pour cette facture */}
          <div className="flex items-center justify-between bg-slate-50/60 border border-slate-100 rounded-xl px-4 py-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-600 uppercase">Appliquer la TVA ({vatRate}%)</span>
              <p className="text-[11px] text-slate-400 font-medium">
                Inclure ou non la TVA sur cette facture. Par défaut : votre réglage dans Paramètres.
              </p>
            </div>
            <Switch checked={applyVat} onCheckedChange={setApplyVat} />
          </div>

          {/* Prestataires Line Editor */}
          <DevisLineEditor lines={lines} onChange={setLines} applyVat={applyVat} discount={discount} onDiscountChange={setDiscount} />
        </CardContent>
      </Card>

      {/* Action triggers bottom row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
          <ShieldAlert className="h-4.5 w-4.5 text-slate-300" />
          {applyVat
            ? `TVA de ${vatRate}% appliquée à cette facture.`
            : "TVA non appliquée à cette facture."}
        </span>

        <div className="flex items-center gap-3 shrink-0 self-end">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => saveInvoice("draft")}
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold border-slate-200 h-10 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all text-sm disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            <span>Sauvegarder brouillon</span>
          </Button>

          <Button
            type="button"
            disabled={saving}
            onClick={() => saveInvoice("sent")}
            className="bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold h-10 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all text-sm shadow-md shadow-emerald-700/10 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            <span>{saving ? "Création..." : "Créer la facture"}</span>
          </Button>
        </div>
      </div>

      {/* Inline Add Client Dialog */}
      <Dialog open={isNewClientOpen} onOpenChange={setIsNewClientOpen}>
        <DialogContent className="max-w-md bg-white rounded-xl shadow-xl border-slate-100 p-6">
          <form onSubmit={handleCreateClient} className="space-y-4">
            <DialogHeader className="flex flex-row items-center gap-2 border-b border-slate-100 pb-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                <UserPlus className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base font-bold text-slate-800">
                Créer un nouveau client à la volée
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 my-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-c-name" className="text-xs font-bold text-slate-500 uppercase">
                  Raison Sociale / Nom *
                </Label>
                <Input
                  id="new-c-name"
                  placeholder="ex: Jokkolabs Dakar"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-c-email" className="text-xs font-bold text-slate-500 uppercase">
                  Adresse E-mail
                </Label>
                <Input
                  id="new-c-email"
                  type="email"
                  placeholder="ex: accounting@client.sn"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-c-phone" className="text-xs font-bold text-slate-500 uppercase">
                  Numéro WhatsApp
                </Label>
                <Input
                  id="new-c-phone"
                  placeholder="ex: +221773918239"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A]"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 border-t border-slate-100 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsNewClientOpen(false)}
                className="text-slate-500 hover:bg-slate-50 font-semibold"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                className="bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold rounded-lg"
              >
                Créer et Sélectionner
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
