"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Receipt, MessageSquare, Users, Save, Upload, Plus, Trash2, HelpCircle, Edit, KeyRound, Copy, AlertCircle, CreditCard, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ConfirmDeleteModal from "@/components/shared/ConfirmDeleteModal";
import { createBrowserClient } from "@/lib/supabase/client";
import { parseOrgTaxId, buildOrgTaxId, errorMessage, toMonthlyAmount } from "@/lib/utils/orgProfile";
import { fetchSubscription, SubscriptionState, PLANS } from "@/lib/utils/subscription";
import { formatFCFA } from "@/lib/utils/format";

// Mapped types for settings
interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Collaborateur" | "Lecture seule";
}

type UIRole = "Admin" | "Collaborateur" | "Lecture seule";

const ROLE_DB_TO_UI: Record<string, UIRole> = {
  ADMIN: "Admin",
  EDITOR: "Collaborateur",
  VIEWER: "Lecture seule",
};

function ParametresContent() {
  const searchParams = useSearchParams();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Onglet actif (pilotable par ?tab= pour les liens du menu profil)
  const [activeTab, setActiveTab] = useState("societe");
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && ["societe", "facturation", "templates", "equipe", "abonnement"].includes(t)) {
      setActiveTab(t);
    }
  }, [searchParams]);

  // Abonnement
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  useEffect(() => {
    fetchSubscription().then(setSubscription);
  }, []);

  // Form States
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [companyNinea, setCompanyNinea] = useState("");
  const [companyRc, setCompanyRc] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyBank, setCompanyBank] = useState("");

  const [billingVat, setBillingVat] = useState(18);
  const [billingPaymentTerm, setBillingPaymentTerm] = useState(30);
  const [billingPrefix, setBillingPrefix] = useState("FAC-");
  const [billingApplyVat, setBillingApplyVat] = useState(true);

  // Alerte de trésorerie (total dérivé de nafaflow.fixed_costs, édité dans le P&L)
  const [monthlyCharges, setMonthlyCharges] = useState(0);
  const [cashSafetyMonths, setCashSafetyMonths] = useState(1);

  // Relance templates (Stored locally in LocalStorage)
  const [waTemplateFr, setWaTemplateFr] = useState("");
  const [waTemplateEn, setWaTemplateEn] = useState("");
  const [emailTemplateFr, setEmailTemplateFr] = useState("");
  const [emailTemplateEn, setEmailTemplateEn] = useState("");

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Add Member State
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<UIRole>("Collaborateur");
  const [addingMember, setAddingMember] = useState(false);

  // Mot de passe temporaire du membre créé (affiché une seule fois)
  const [createdMemberInfo, setCreatedMemberInfo] = useState<{ name: string; email: string; tempPassword: string } | null>(null);

  // Edit Member Modal State
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<UIRole>("Collaborateur");

  // Deletion Confirmation State
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);

  // Fetch settings from database on mount
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
          .schema("nafaflow")
          .from("users")
          .select("org_id")
          .eq("id", user.id)
          .single();

        if (userData?.org_id) {
          const uOrgId = userData.org_id;
          setOrgId(uOrgId);

          // 1. Fetch organization details
          const { data: orgData } = await supabase
            .schema("nafaflow")
            .from("orgs")
            .select("*")
            .eq("id", uOrgId)
            .single();

          if (orgData) {
            setCompanyName(orgData.name || "");
            setCompanyAddress(orgData.address || "");
            setCompanyLogo(orgData.logo_url || "");
            setBillingVat(Number(orgData.vat_rate) ?? 18);
            setBillingPaymentTerm(orgData.payment_terms_days ?? 30);
            setBillingPrefix(orgData.invoice_prefix ?? "FAC-");
            setBillingApplyVat(orgData.vat_enabled ?? true);
            setCashSafetyMonths(orgData.cash_safety_months ?? 1);

            const legal = parseOrgTaxId(orgData.tax_id);
            setCompanyNinea(legal.ninea);
            setCompanyRc(legal.rc);
            setCompanyPhone(legal.phone);
            setCompanyEmail(legal.email);
            setCompanyBank(legal.bank);
          }

          // 2. Charges fixes pour l'alerte de trésorerie
          const { data: fixedCosts } = await supabase
            .schema("nafaflow")
            .from("fixed_costs")
            .select("*")
            .eq("org_id", uOrgId)
            .eq("active", true);

          if (fixedCosts && fixedCosts.length > 0) {
            const total = fixedCosts.reduce(
              (sum, fc) => sum + toMonthlyAmount(Number(fc.amount) || 0, fc.periodicity),
              0
            );
            setMonthlyCharges(Math.round(total));
          }

          // 3. Fetch team members
          const { data: usersData } = await supabase
            .schema("nafaflow")
            .from("users")
            .select("*")
            .eq("org_id", uOrgId)
            .order("created_at", { ascending: true });

          if (usersData) {
            setTeamMembers(
              usersData.map((u) => ({
                id: u.id,
                name: u.full_name || "",
                email: u.email || "",
                role: ROLE_DB_TO_UI[u.role] || "Collaborateur",
              }))
            );
          }
        }

        // 4. Load relance templates from LocalStorage
        setWaTemplateFr(localStorage.getItem("waTemplateFr") || "Bonjour {{prenom}}, nous vous contactons pour régulariser la facture {{numero}} d'un montant de {{montant}} F en attente.");
        setWaTemplateEn(localStorage.getItem("waTemplateEn") || "Hello {{prenom}}, we are contacting you regarding invoice {{numero}} of {{montant}} F which is due.");
        setEmailTemplateFr(localStorage.getItem("emailTemplateFr") || "Bonjour {{prenom}},\n\nNous vous prions de bien vouloir trouver ci-joint la relance de la facture {{numero}}.\n\nCordialement.");
        setEmailTemplateEn(localStorage.getItem("emailTemplateEn") || "Hello {{prenom}},\n\nPlease find attached the reminder for invoice {{numero}}.\n\nBest regards.");

      } catch (err) {
        console.error("Error fetching settings:", err);
        toast.error(`Erreur lors du chargement des paramètres : ${errorMessage(err)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        toast.error("Le logo est trop lourd. Maximum 1 Mo.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyLogo(reader.result as string);
        toast.success("Logo chargé.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || addingMember) return;

    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      toast.error("Nom et email requis pour ajouter un membre.");
      return;
    }

    setAddingMember(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMemberName.trim(),
          email: newMemberEmail.trim(),
          role: newMemberRole,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || `Erreur serveur (${res.status})`);
      }

      setTeamMembers((prev) => [
        ...prev,
        {
          id: payload.member.id,
          name: payload.member.name,
          email: payload.member.email,
          role: payload.member.role,
        },
      ]);
      setCreatedMemberInfo({
        name: payload.member.name,
        email: payload.member.email,
        tempPassword: payload.tempPassword,
      });
      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberRole("Collaborateur");
      toast.success("Membre d'équipe ajouté.");
    } catch (err: unknown) {
      console.error(err);
      toast.error(`Erreur d'ajout membre : ${errorMessage(err)}`);
    } finally {
      setAddingMember(false);
    }
  };

  const handleStartEdit = (member: TeamMember) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditEmail(member.email);
    setEditRole(member.role);
  };

  const handleSaveEditMember = async () => {
    if (!editingMember || !orgId) return;
    if (!editName.trim() || !editEmail.trim()) {
      toast.error("Nom et email requis.");
      return;
    }

    if (editingMember.role === "Admin" && editRole !== "Admin") {
      const adminsCount = teamMembers.filter((m) => m.role === "Admin").length;
      if (adminsCount <= 1) {
        toast.error("L'organisation doit toujours avoir au moins un Admin.");
        return;
      }
    }

    try {
      const res = await fetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingMember.id,
          name: editName.trim(),
          email: editEmail.trim(),
          role: editRole,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || `Erreur serveur (${res.status})`);
      }

      setTeamMembers((prev) =>
        prev.map((m) =>
          m.id === editingMember.id
            ? { ...m, name: editName.trim(), email: editEmail.trim(), role: editRole }
            : m
        )
      );
      setEditingMember(null);
      toast.success("Membre d'équipe modifié.");
    } catch (err: unknown) {
      console.error(err);
      toast.error(`Erreur de modification membre : ${errorMessage(err)}`);
    }
  };

  const handleRemoveMemberClick = (member: TeamMember) => {
    if (member.role === "Admin") {
      const adminsCount = teamMembers.filter((m) => m.role === "Admin").length;
      if (adminsCount <= 1) {
        toast.error("Impossible de supprimer le seul administrateur.");
        return;
      }
    }
    setMemberToDelete(member);
  };

  const handleConfirmDeleteMember = async () => {
    if (!memberToDelete || !orgId) return;
    try {
      const res = await fetch("/api/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memberToDelete.id }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || `Erreur serveur (${res.status})`);
      }

      setTeamMembers((prev) => prev.filter((m) => m.id !== memberToDelete.id));
      setMemberToDelete(null);
      toast.success("Membre retiré de l'équipe.");
    } catch (err: unknown) {
      console.error(err);
      toast.error(`Erreur de suppression membre : ${errorMessage(err)}`);
    }
  };

  const handleSave = async () => {
    if (!orgId) return;

    try {
      const supabase = createBrowserClient();
      const combinedTaxId = buildOrgTaxId({
        ninea: companyNinea,
        rc: companyRc,
        phone: companyPhone,
        email: companyEmail,
        bank: companyBank,
      });

      // 1. Save org details in Supabase
      const { error } = await supabase
        .schema("nafaflow")
        .from("orgs")
        .update({
          name: companyName.trim(),
          address: companyAddress.trim(),
          logo_url: companyLogo,
          tax_id: combinedTaxId,
          vat_rate: Number(billingVat),
          payment_terms_days: Number(billingPaymentTerm),
          invoice_prefix: billingPrefix.trim(),
          vat_enabled: billingApplyVat,
          cash_safety_months: Number(cashSafetyMonths) || 1,
        })
        .eq("id", orgId);

      if (error) throw error;

      // Les charges fixes détaillées sont gérées depuis le P&L (table fixed_costs),
      // source unique partagée avec l'alerte de trésorerie.

      // 3. Save relance templates in LocalStorage
      localStorage.setItem("waTemplateFr", waTemplateFr);
      localStorage.setItem("waTemplateEn", waTemplateEn);
      localStorage.setItem("emailTemplateFr", emailTemplateFr);
      localStorage.setItem("emailTemplateEn", emailTemplateEn);

      toast.success("Paramètres enregistrés avec succès ! Ils s'appliquent désormais aux devis, factures et PDF.");
    } catch (err: unknown) {
      console.error(err);
      toast.error(`Erreur lors de la sauvegarde : ${errorMessage(err)}`);
    }
  };

  const handleCopyTempPassword = async () => {
    if (!createdMemberInfo) return;
    try {
      await navigator.clipboard.writeText(
        `NafaFlow — Accès pour ${createdMemberInfo.name}\nEmail : ${createdMemberInfo.email}\nMot de passe temporaire : ${createdMemberInfo.tempPassword}`
      );
      toast.success("Identifiants copiés dans le presse-papiers.");
    } catch {
      toast.error("Impossible de copier automatiquement. Sélectionnez le texte manuellement.");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium animate-pulse">Chargement des paramètres...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Paramètres Généraux</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Configurez votre entreprise, vos options de facturation et gérez vos collaborateurs.
          </p>
        </div>

        <Button
          onClick={handleSave}
          className="bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold h-9 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-700/10 self-end sm:self-auto"
        >
          <Save className="h-4 w-4" />
          <span>Enregistrer les modifications</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Side Tab Navigation */}
        <TabsList className="flex flex-row lg:flex-col w-full lg:w-64 bg-white border border-slate-100 rounded-xl p-1.5 shadow-sm space-y-0 lg:space-y-1 overflow-x-auto lg:overflow-x-visible">
          <TabsTrigger
            value="societe"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg justify-start text-xs font-bold text-slate-500 hover:text-slate-800 data-[state=active]:bg-[#F0FDF4] data-[state=active]:text-[#16A34A] transition-all w-full shrink-0"
          >
            <Building2 className="h-4 w-4" />
            <span>Section Société</span>
          </TabsTrigger>
          <TabsTrigger
            value="facturation"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg justify-start text-xs font-bold text-slate-500 hover:text-slate-800 data-[state=active]:bg-[#F0FDF4] data-[state=active]:text-[#16A34A] transition-all w-full shrink-0"
          >
            <Receipt className="h-4 w-4" />
            <span>Facturation & Trésorerie</span>
          </TabsTrigger>
          <TabsTrigger
            value="templates"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg justify-start text-xs font-bold text-slate-500 hover:text-slate-800 data-[state=active]:bg-[#F0FDF4] data-[state=active]:text-[#16A34A] transition-all w-full shrink-0"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Templates de relance</span>
          </TabsTrigger>
          <TabsTrigger
            value="equipe"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg justify-start text-xs font-bold text-slate-500 hover:text-slate-800 data-[state=active]:bg-[#F0FDF4] data-[state=active]:text-[#16A34A] transition-all w-full shrink-0"
          >
            <Users className="h-4 w-4" />
            <span>Gestion de l&apos;équipe</span>
          </TabsTrigger>
          <TabsTrigger
            value="abonnement"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg justify-start text-xs font-bold text-slate-500 hover:text-slate-800 data-[state=active]:bg-[#F0FDF4] data-[state=active]:text-[#16A34A] transition-all w-full shrink-0"
          >
            <CreditCard className="h-4 w-4" />
            <span>Abonnement</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Panels */}
        <div className="flex-1 w-full">
          {/* Section Société */}
          <TabsContent value="societe" className="space-y-4 outline-none">
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardContent className="p-6 space-y-6">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
                  Informations de la Société
                </h3>
                <p className="text-[11px] text-slate-400 font-medium -mt-3">
                  Ces informations apparaissent sur vos devis et factures (PDF inclus).
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {/* Company Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="comp-name" className="text-xs font-bold text-slate-500 uppercase">
                        Nom commercial / Raison sociale
                      </Label>
                      <Input
                        id="comp-name"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="ex: Nafa Corp"
                        className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
                      />
                    </div>

                    {/* Address */}
                    <div className="space-y-1.5">
                      <Label htmlFor="comp-addr" className="text-xs font-bold text-slate-500 uppercase">
                        Adresse du siège
                      </Label>
                      <textarea
                        id="comp-addr"
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        placeholder="ex: Keur Gorgui, Dakar, Sénégal"
                        rows={3}
                        className="w-full text-sm font-semibold text-slate-700 p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Téléphone */}
                      <div className="space-y-1.5">
                        <Label htmlFor="comp-phone" className="text-xs font-bold text-slate-500 uppercase">
                          Téléphone
                        </Label>
                        <Input
                          id="comp-phone"
                          type="tel"
                          value={companyPhone}
                          onChange={(e) => setCompanyPhone(e.target.value)}
                          placeholder="ex: +221 77 123 45 67"
                          className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
                        />
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <Label htmlFor="comp-email" className="text-xs font-bold text-slate-500 uppercase">
                          Email de contact
                        </Label>
                        <Input
                          id="comp-email"
                          type="email"
                          value={companyEmail}
                          onChange={(e) => setCompanyEmail(e.target.value)}
                          placeholder="ex: contact@nafa.sn"
                          className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Logo Uploader */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase">Logo de l&apos;entreprise</Label>
                      <div className="flex items-center gap-4 border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50">
                        <div className="size-20 bg-white rounded-lg border border-slate-100 shadow-inner flex items-center justify-center overflow-hidden relative shrink-0">
                          {companyLogo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={companyLogo} alt="Logo" className="object-contain size-full p-2" />
                          ) : (
                            <Building2 className="h-8 w-8 text-slate-300" />
                          )}
                        </div>
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <label className="bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-200 px-3 py-1.5 rounded-lg text-xs cursor-pointer flex items-center gap-1.5 w-fit active:scale-95 transition-all shadow-sm">
                            <Upload className="h-3.5 w-3.5" />
                            <span>Charger un logo</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="hidden"
                            />
                          </label>
                          <p className="text-[10px] text-slate-400">PNG, JPG de moins de 1 Mo</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* NINEA */}
                      <div className="space-y-1.5">
                        <Label htmlFor="comp-ninea" className="text-xs font-bold text-slate-500 uppercase">
                          NINEA
                        </Label>
                        <Input
                          id="comp-ninea"
                          value={companyNinea}
                          onChange={(e) => setCompanyNinea(e.target.value)}
                          placeholder="ex: 009823192G1"
                          className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
                        />
                      </div>

                      {/* RC */}
                      <div className="space-y-1.5">
                        <Label htmlFor="comp-rc" className="text-xs font-bold text-slate-500 uppercase">
                          Régistre du Commerce (RC)
                        </Label>
                        <Input
                          id="comp-rc"
                          value={companyRc}
                          onChange={(e) => setCompanyRc(e.target.value)}
                          placeholder="ex: SN-DKR-2025-B-1234"
                          className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Section Facturation & Trésorerie */}
          <TabsContent value="facturation" className="space-y-4 outline-none">
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardContent className="p-6 space-y-6">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
                  Paramètres de Facturation
                </h3>

                <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-5">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase">
                      Appliquer la TVA
                    </Label>
                    <p className="text-[11px] text-slate-450 font-medium">
                      Activer ou désactiver l&apos;application de la TVA sur les devis et factures
                    </p>
                  </div>
                  <Switch
                    checked={billingApplyVat}
                    onCheckedChange={setBillingApplyVat}
                    id="apply-vat-toggle"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* VAT */}
                  <div className="space-y-1.5">
                    <Label htmlFor="bill-vat" className={`text-xs font-bold uppercase transition-colors ${billingApplyVat ? 'text-slate-500' : 'text-slate-300'}`}>
                      Taux de TVA par défaut (%)
                    </Label>
                    <Input
                      id="bill-vat"
                      type="number"
                      value={billingVat}
                      onChange={(e) => setBillingVat(Number(e.target.value))}
                      placeholder="18"
                      disabled={!billingApplyVat}
                      className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700 disabled:opacity-40 disabled:bg-slate-50"
                    />
                  </div>

                  {/* Payment Term */}
                  <div className="space-y-1.5">
                    <Label htmlFor="bill-term" className="text-xs font-bold text-slate-500 uppercase">
                      Délai de paiement standard (jours)
                    </Label>
                    <Input
                      id="bill-term"
                      type="number"
                      value={billingPaymentTerm}
                      onChange={(e) => setBillingPaymentTerm(Number(e.target.value))}
                      placeholder="30"
                      className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
                    />
                  </div>

                  {/* Numbering Prefix */}
                  <div className="space-y-1.5">
                    <Label htmlFor="bill-prefix" className="text-xs font-bold text-slate-500 uppercase">
                      Préfixe de numérotation
                    </Label>
                    <Input
                      id="bill-prefix"
                      value={billingPrefix}
                      onChange={(e) => setBillingPrefix(e.target.value)}
                      placeholder="FAC-"
                      className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
                    />
                  </div>
                </div>

                {/* Coordonnées bancaires */}
                <div className="space-y-1.5 border-t border-slate-100 pt-5">
                  <Label htmlFor="bill-bank" className="text-xs font-bold text-slate-500 uppercase">
                    Coordonnées bancaires (affichées sur les factures)
                  </Label>
                  <Input
                    id="bill-bank"
                    value={companyBank}
                    onChange={(e) => setCompanyBank(e.target.value)}
                    placeholder="ex: SGBS — RIB : SN012 03456 000012345678 90"
                    className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
                  />
                  <p className="text-[10px] text-slate-400 font-medium">
                    Laissez vide pour ne rien afficher dans le pied de page des PDF.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Alerte de trésorerie */}
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardContent className="p-6 space-y-6">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
                  Alerte de Trésorerie
                </h3>

                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-lg p-3 text-[11px] text-blue-700 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    L&apos;alerte se déclenche quand votre solde de trésorerie passe sous&nbsp;:
                    <span className="font-bold"> charges mensuelles × mois de sécurité</span>.
                    Si les charges ne sont pas renseignées, aucune alerte n&apos;est affichée.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-500 uppercase">
                      Charges d&apos;exploitation mensuelles (F CFA)
                    </Label>
                    <div className="h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center px-3 font-bold text-slate-700 tabular-nums">
                      {monthlyCharges.toLocaleString()} F
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Total de vos charges fixes. Détaillez-les (loyer, salaires, abonnements...) dans le{" "}
                      <a href="/pl" className="font-semibold text-[#16A34A] hover:underline underline-offset-2">Compte de résultat (P&amp;L)</a>.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="treso-months" className="text-xs font-bold text-slate-500 uppercase">
                      Mois de sécurité souhaités
                    </Label>
                    <Input
                      id="treso-months"
                      type="number"
                      min={1}
                      max={12}
                      value={cashSafetyMonths}
                      onChange={(e) => setCashSafetyMonths(Number(e.target.value))}
                      placeholder="1"
                      className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
                    />
                    <p className="text-[10px] text-slate-400 font-medium">
                      Nombre de mois de charges que vous voulez toujours garder en réserve.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Section Templates */}
          <TabsContent value="templates" className="space-y-4 outline-none">
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Messages de Relance Clients
                  </h3>
                  <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1 text-[11px] text-blue-700 font-semibold">
                    <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Variables disponibles : {"{{prenom}}"}, {"{{numero}}"}, {"{{montant}}"}, {"{{date}}"}</span>
                  </div>
                </div>

                <Tabs defaultValue="fr" className="w-full flex flex-col gap-4">
                  <TabsList className="grid grid-cols-2 w-48 bg-slate-100 rounded-lg p-0.5 border border-slate-200/50">
                    <TabsTrigger value="fr" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-slate-800">
                      Français (FR)
                    </TabsTrigger>
                    <TabsTrigger value="en" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-slate-800">
                      Anglais (EN)
                    </TabsTrigger>
                  </TabsList>

                  {/* FR Templates */}
                  <TabsContent value="fr" className="space-y-4 outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <Label htmlFor="wa-fr" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                          <span className="text-emerald-500 font-bold">WhatsApp</span>
                          <span>- Relance standard (FR)</span>
                        </Label>
                        <textarea
                          id="wa-fr"
                          value={waTemplateFr}
                          onChange={(e) => setWaTemplateFr(e.target.value)}
                          rows={4}
                          className="w-full text-xs font-medium text-slate-700 p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="mail-fr" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                          <span className="text-[#16A34A] font-bold">Email</span>
                          <span>- Relance standard (FR)</span>
                        </Label>
                        <textarea
                          id="mail-fr"
                          value={emailTemplateFr}
                          onChange={(e) => setEmailTemplateFr(e.target.value)}
                          rows={4}
                          className="w-full text-xs font-medium text-slate-700 p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A]"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* EN Templates */}
                  <TabsContent value="en" className="space-y-4 outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <Label htmlFor="wa-en" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                          <span className="text-emerald-500 font-bold">WhatsApp</span>
                          <span>- Relance standard (EN)</span>
                        </Label>
                        <textarea
                          id="wa-en"
                          value={waTemplateEn}
                          onChange={(e) => setWaTemplateEn(e.target.value)}
                          rows={4}
                          className="w-full text-xs font-medium text-slate-700 p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="mail-en" className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                          <span className="text-[#16A34A] font-bold">Email</span>
                          <span>- Relance standard (EN)</span>
                        </Label>
                        <textarea
                          id="mail-en"
                          value={emailTemplateEn}
                          onChange={(e) => setEmailTemplateEn(e.target.value)}
                          rows={4}
                          className="w-full text-xs font-medium text-slate-700 p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A]"
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Section Équipe */}
          <TabsContent value="equipe" className="space-y-4 outline-none">
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardContent className="p-6 space-y-6">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
                  Gestion de l&apos;Équipe
                </h3>
                <p className="text-[11px] text-slate-400 font-medium -mt-3">
                  Chaque membre reçoit un compte de connexion NafaFlow. Un mot de passe temporaire vous sera remis à transmettre au collaborateur.
                </p>

                {/* Add member form */}
                <form onSubmit={handleAddMember} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <div className="space-y-1.5">
                    <Label htmlFor="user-name" className="text-[10px] font-bold text-slate-400 uppercase">
                      Nom complet
                    </Label>
                    <Input
                      id="user-name"
                      placeholder="ex: Alioune Badara"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      className="h-9 rounded-lg bg-white border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="user-email" className="text-[10px] font-bold text-slate-400 uppercase">
                      Adresse Email
                    </Label>
                    <Input
                      id="user-email"
                      type="email"
                      placeholder="ex: alioune@nafa.sn"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      className="h-9 rounded-lg bg-white border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="user-role" className="text-[10px] font-bold text-slate-400 uppercase">
                      Rôle d&apos;accès
                    </Label>
                    <select
                      id="user-role"
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value as UIRole)}
                      className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] text-slate-700 font-semibold"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Collaborateur">Collaborateur</option>
                      <option value="Lecture seule">Lecture seule</option>
                    </select>
                  </div>
                  <Button
                    type="submit"
                    disabled={addingMember}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-semibold h-9 rounded-lg flex items-center justify-center gap-1.5 self-end disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{addingMember ? "Ajout..." : "Ajouter"}</span>
                  </Button>
                </form>

                {/* Team members list */}
                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="text-slate-400 text-[10px] tracking-wider uppercase font-bold hover:bg-slate-50">
                        <TableHead className="py-2.5 px-4">Utilisateur</TableHead>
                        <TableHead className="py-2.5 px-4">Adresse Email</TableHead>
                        <TableHead className="py-2.5 px-4 text-center">Rôle</TableHead>
                        <TableHead className="py-2.5 px-4 w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100 text-slate-700 text-sm">
                      {teamMembers.length > 0 ? (
                        teamMembers.map((member) => (
                          <TableRow key={member.id} className="hover:bg-slate-50/20">
                            <TableCell className="p-3 font-semibold text-slate-800">{member.name || <span className="text-slate-400 italic font-medium">Sans nom</span>}</TableCell>
                            <TableCell className="p-3 text-slate-500 font-medium">{member.email}</TableCell>
                            <TableCell className="p-3 text-center">
                              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                                member.role === "Admin"
                                  ? "bg-purple-50 text-purple-700 border border-purple-100"
                                  : member.role === "Collaborateur"
                                  ? "bg-blue-50 text-blue-700 border border-blue-100"
                                  : "bg-slate-50 text-slate-500 border border-slate-150"
                              }`}>
                                {member.role}
                              </span>
                            </TableCell>
                            <TableCell className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleStartEdit(member)}
                                  className="h-7 w-7 text-slate-400 hover:text-[#16A34A] rounded-lg shrink-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveMemberClick(member)}
                                  className="h-7 w-7 text-slate-400 hover:text-red-500 rounded-lg shrink-0"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                            Aucun utilisateur d&apos;équipe.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Abonnement */}
          <TabsContent value="abonnement" className="space-y-4 outline-none">
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardContent className="p-6 space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Mon abonnement</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    Gérez votre formule NafaFlow et votre facturation.
                  </p>
                </div>

                {(() => {
                  const inTrial = subscription?.inTrial;
                  const isActive = subscription?.isActive;
                  const planLabel = subscription
                    ? (PLANS[subscription.plan as keyof typeof PLANS]?.label
                        || (isActive ? "Abonnement actif" : inTrial ? "Essai gratuit" : "Aucun abonnement actif"))
                    : "—";
                  const badgeClass = isActive
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : inTrial
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-rose-50 text-rose-700 border-rose-200";
                  const statusText = isActive
                    ? "Actif"
                    : inTrial
                    ? `Essai — ${subscription?.trialDaysLeft ?? 0} jour(s) restant(s)`
                    : "Inactif";
                  return (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-xl bg-[#F0FDF4] flex items-center justify-center shrink-0">
                            <CreditCard className="h-5 w-5 text-[#16A34A]" />
                          </div>
                          <div>
                            <span className="block text-base font-bold text-slate-800">{planLabel}</span>
                            <span className="text-xs text-slate-400 font-medium">Formule actuelle</span>
                          </div>
                        </div>
                        <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${badgeClass}`}>
                          {statusText}
                        </span>
                      </div>

                      {isActive && subscription?.currentPeriodEnd && (
                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          Prochaine échéance : {subscription.currentPeriodEnd.toLocaleDateString("fr-FR")}
                        </p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        {/* Offre gratuite / essai */}
                        <div className={`rounded-xl border p-4 ${inTrial ? "border-[#16A34A] bg-[#F0FDF4]/50" : "border-slate-200 bg-white"}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-800">Gratuit</span>
                            {inTrial && <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />}
                          </div>
                          <span className="text-lg font-extrabold text-slate-900">0 F</span>
                          <span className="text-xs text-slate-400 font-medium"> · essai 14 j</span>
                        </div>
                        {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((key) => {
                          const plan = PLANS[key];
                          const current = subscription?.plan === key && isActive;
                          return (
                            <div
                              key={key}
                              className={`rounded-xl border p-4 ${current ? "border-[#16A34A] bg-[#F0FDF4]/50" : "border-slate-200 bg-white"}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-800">{plan.label}</span>
                                {current && <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />}
                              </div>
                              <span className="text-lg font-extrabold text-slate-900">{formatFCFA(plan.price)}</span>
                              <span className="text-xs text-slate-400 font-medium"> / mois</span>
                            </div>
                          );
                        })}
                      </div>

                      <Button
                        asChild
                        className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-bold h-11 rounded-lg text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-700/10"
                      >
                        <Link href="/abonnement">
                          <CreditCard className="h-4 w-4" />
                          <span>{isActive ? "Gérer mon abonnement" : "Choisir un abonnement"}</span>
                        </Link>
                      </Button>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      {/* ConfirmDeleteModal for Team Member */}
      <ConfirmDeleteModal
        isOpen={memberToDelete !== null}
        onClose={() => setMemberToDelete(null)}
        onConfirm={handleConfirmDeleteMember}
        title="Retirer le membre de l'équipe ?"
        message={`Retirer ${memberToDelete?.name} de l'équipe ? Cette personne perdra tout accès.`}
      />

      {/* Dialog : mot de passe temporaire du nouveau membre */}
      <Dialog open={createdMemberInfo !== null} onOpenChange={(open) => { if (!open) setCreatedMemberInfo(null); }}>
        <DialogContent className="max-w-md bg-white rounded-xl shadow-xl border-slate-100 p-6 text-slate-700">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#16A34A]" />
              <span>Membre ajouté avec succès</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-2 text-xs">
            <p className="text-slate-500 font-medium">
              Transmettez ces identifiants à <span className="font-bold text-slate-700">{createdMemberInfo?.name}</span>.
              Le mot de passe ne sera <span className="font-bold">plus jamais affiché</span> — copiez-le maintenant.
            </p>
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-1.5 font-semibold text-slate-700">
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 uppercase text-[10px] font-bold">Email</span>
                <span>{createdMemberInfo?.email}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 uppercase text-[10px] font-bold">Mot de passe temporaire</span>
                <span className="font-mono text-[#16A34A] font-bold">{createdMemberInfo?.tempPassword}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreatedMemberInfo(null)}
              className="rounded-lg border-slate-200 text-xs font-bold"
            >
              Fermer
            </Button>
            <Button
              type="button"
              onClick={handleCopyTempPassword}
              className="bg-[#16A34A] hover:bg-[#15803D] text-white font-bold rounded-lg text-xs flex items-center gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copier les identifiants</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Team Member Dialog */}
      <Dialog open={editingMember !== null} onOpenChange={(open) => { if (!open) setEditingMember(null); }}>
        <DialogContent className="max-w-lg bg-white rounded-xl shadow-xl border-slate-100 p-6 text-slate-700">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-[#16A34A]" />
              <span>Modifier le membre d&apos;équipe</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-user-name" className="text-[10px] font-bold text-slate-500 uppercase">
                  Nom complet
                </Label>
                <Input
                  id="edit-user-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-user-email" className="text-[10px] font-bold text-slate-500 uppercase">
                  Adresse Email
                </Label>
                <Input
                  id="edit-user-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="h-10 rounded-lg border-slate-200 focus:border-[#16A34A] focus:ring-[#16A34A] font-semibold text-slate-700"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-user-role" className="text-[10px] font-bold text-slate-500 uppercase">
                Rôle d&apos;accès
              </Label>
              <select
                id="edit-user-role"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UIRole)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] text-slate-700 font-semibold"
              >
                <option value="Admin">Admin</option>
                <option value="Collaborateur">Collaborateur</option>
                <option value="Lecture seule">Lecture seule</option>
              </select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingMember(null)}
              className="rounded-lg border-slate-200 text-xs font-bold"
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleSaveEditMember}
              className="bg-[#16A34A] hover:bg-[#15803D] text-white font-bold rounded-lg text-xs"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ParametresPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium">Chargement des paramètres...</div>}>
      <ParametresContent />
    </Suspense>
  );
}
