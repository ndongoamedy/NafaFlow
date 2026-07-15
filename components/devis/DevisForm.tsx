"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Save, Send, ShieldAlert, ArrowRightLeft, UserPlus } from "lucide-react";
import DevisLineEditor, { DevisLine } from "./DevisLineEditor";
import ConvertToInvoicesModal from "./ConvertToInvoicesModal";
import { toast } from "sonner";
import { ClientItem } from "@/lib/utils/state";
import { fetchOrgSettings, OrgSettings } from "@/lib/utils/orgProfile";
import { createBrowserClient } from "@/lib/supabase/client";

export default function DevisForm() {
  const router = useRouter();
  
  // Clients state loaded from store
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [client, setClient] = useState("");
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      
      // 1. Get orgId
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .schema("nafaflow")
          .from("users")
          .select("org_id")
          .eq("id", user.id)
          .single();
        if (userData?.org_id) {
          setOrgId(userData.org_id);
        }
      }

      // 2. Load Clients
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
      if (mappedClients.length > 0) {
        setClient(mappedClients[0].id);
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur lors du chargement des données: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgSettings().then(setSettings);
    loadInitialData();
  }, []);

  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [validityDays, setValidityDays] = useState("15");
  const [lines, setLines] = useState<DevisLine[]>([
    {
      id: "1",
      description: "Développement Application Web (Next.js)",
      quantity: 1,
      unitPrice: 3500000,
    },
  ]);
  
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  
  // New Client Inline Modal
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");

  // Calculations
  const applyVat = settings?.billing.applyVat ?? true;
  const vatRate = settings?.billing.vat ?? 18;
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const totalTTC = applyVat ? subtotal * (1 + vatRate / 100) : subtotal;

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
      
      // Find orgId if not loaded
      let activeOrgId = orgId;
      if (!activeOrgId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase
            .schema("nafaflow")
            .from("users")
            .select("org_id")
            .eq("id", user.id)
            .single();
          if (userData?.org_id) {
            activeOrgId = userData.org_id;
            setOrgId(activeOrgId);
          }
        }
      }

      if (!activeOrgId) {
        throw new Error("Impossible de trouver l'organisation de l'utilisateur.");
      }

      const newClientRow = {
        org_id: activeOrgId,
        name: newClientName,
        email: newClientEmail || "contact@client.sn",
        whatsapp: newClientPhone || "+221770000000",
        sector: "Services / Conseil",
        address: "Dakar, Sénégal",
        tax_id: "|", // empty tax id placeholder
        notes: "",
      };

      const { data, error } = await supabase
        .schema("nafaflow")
        .from("clients")
        .insert(newClientRow)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newClientItem: ClientItem = {
          id: data.id,
          name: data.name,
          email: data.email || "",
          phone: data.whatsapp || "",
          sector: data.sector || "",
          address: data.address || "",
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
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur lors de la création du client: ${message}`);
    }
  };

  const saveQuoteToDb = async (frontendStatus: string) => {
    if (lines.length === 0) {
      toast.error("Veuillez ajouter au moins une prestation.");
      return;
    }

    try {
      const supabase = createBrowserClient();
      
      // Get orgId
      let activeOrgId = orgId;
      let userId = null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        if (!activeOrgId) {
          const { data: userData } = await supabase
            .schema("nafaflow")
            .from("users")
            .select("org_id")
            .eq("id", user.id)
            .single();
          if (userData?.org_id) {
            activeOrgId = userData.org_id;
            setOrgId(activeOrgId);
          }
        }
      }

      if (!activeOrgId) {
        throw new Error("Impossible de trouver l'organisation de l'utilisateur.");
      }

      // Calculate valid_until
      const validityDaysNum = Number(validityDays) || 15;
      const validUntilDate = new Date(new Date(issueDate).getTime() + validityDaysNum * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);

      // Map frontend status to database constraint status
      const dbStatus = frontendStatus === "brouillon" ? "draft" :
                       frontendStatus === "envoyée" ? "sent" :
                       frontendStatus === "accepted" ? "accepted" :
                       frontendStatus === "refusé" ? "rejected" :
                       frontendStatus;

      // 1. Insert parent Quote
      const newQuoteRow = {
        org_id: activeOrgId,
        client_id: client,
        status: dbStatus,
        valid_until: validUntilDate,
        total: Math.round(totalTTC),
        created_by: userId,
        created_at: new Date(issueDate).toISOString(),
      };

      const { data: quoteResult, error: quoteInsertErr } = await supabase
        .schema("nafaflow")
        .from("quotes")
        .insert(newQuoteRow)
        .select()
        .single();

      if (quoteInsertErr) throw quoteInsertErr;
      if (!quoteResult) throw new Error("Le devis n'a pas pu être créé.");

      // 2. Insert quote lines
      const quoteId = quoteResult.id;
      const linesToInsert = lines.map((line) => {
        const isCatalogService = line.id && (line.id.startsWith("S-") || line.id.length > 20);
        return {
          quote_id: quoteId,
          service_id: isCatalogService ? line.id : null,
          description: line.description,
          qty: line.quantity,
          unit_price: Math.round(line.unitPrice),
          total: Math.round(line.quantity * line.unitPrice),
        };
      });

      const { error: linesInsertErr } = await supabase
        .schema("nafaflow")
        .from("quote_lines")
        .insert(linesToInsert);

      if (linesInsertErr) throw linesInsertErr;

      toast.success(frontendStatus === "brouillon" ? "Brouillon du devis sauvegardé avec succès." : "Devis envoyé au client par e-mail.");
      router.push("/devis");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur lors de l'enregistrement : ${message}`);
    }
  };

  const handleSaveDraft = () => {
    saveQuoteToDb("brouillon");
  };

  const handleSend = () => {
    saveQuoteToDb("envoyée");
  };

  const handleConvertSuccess = () => {
    router.push("/factures");
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Chargement des données du devis...</div>;
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
              <select
                id="client"
                value={client}
                onChange={(e) => handleClientSelectChange(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] text-slate-700 font-semibold"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="new_client" className="text-[#16A34A] font-bold bg-[#F0FDF4]">
                  + Nouveau client...
                </option>
              </select>
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

            {/* Validity Days */}
            <div className="space-y-1.5">
              <Label htmlFor="validity" className="text-xs font-bold text-slate-500 uppercase">
                Durée de validité (jours)
              </Label>
              <Input
                id="validity"
                type="number"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
              />
            </div>
          </div>

          {/* Prestataires Line Editor */}
          <DevisLineEditor lines={lines} onChange={setLines} />
        </CardContent>
      </Card>

      {/* Action triggers bottom row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Warning Banner */}
        <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
          <ShieldAlert className="h-4.5 w-4.5 text-slate-300" />
          Assurez-vous de vérifier les lignes de calcul de TVA (18%) avant de convertir.
        </span>

        <div className="flex items-center gap-3 shrink-0 self-end">
          {/* Draft button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold border-slate-200 h-10 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all text-sm"
          >
            <Save className="h-4 w-4" />
            <span>Sauvegarder brouillon</span>
          </Button>

          {/* Conversion Button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (lines.length === 0 || totalTTC === 0) {
                toast.error("Veuillez d&apos;abord ajouter des prestations.");
                return;
              }
              setIsConvertModalOpen(true);
            }}
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold border-slate-200 h-10 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all text-sm"
          >
            <ArrowRightLeft className="h-4 w-4 text-[#16A34A]" />
            <span>Convertir en factures</span>
          </Button>

          {/* Send Button */}
          <Button
            type="button"
            onClick={handleSend}
            className="bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold h-10 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all text-sm shadow-md shadow-emerald-700/10"
          >
            <Send className="h-4 w-4" />
            <span>Envoyer le devis</span>
          </Button>
        </div>
      </div>

      {/* Convert to Milestone Invoices Dialog */}
      <Dialog open={isConvertModalOpen} onOpenChange={setIsConvertModalOpen}>
        <ConvertToInvoicesModal
          quoteId="D-2026-Nouveau"
          quoteTotal={totalTTC}
          onClose={() => setIsConvertModalOpen(false)}
          onSuccess={handleConvertSuccess}
        />
      </Dialog>

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
