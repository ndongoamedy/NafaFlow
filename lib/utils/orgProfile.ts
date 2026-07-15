"use client";

import { createBrowserClient } from "@/lib/supabase/client";

// Profil complet de l'organisation, chargé depuis Supabase (nafaflow.orgs).
// Remplace l'ancien getSettings() basé sur le localStorage : les infos saisies
// dans Paramètres sont ainsi les mêmes partout (écrans, PDF, envois).

export interface OrgCompanyInfo {
  name: string;
  address: string;
  logo: string;
  ninea: string;
  rc: string;
  phone: string;
  email: string;
  bank: string;
}

export interface OrgBillingInfo {
  vat: number;
  paymentTerm: number;
  numberingPrefix: string;
  applyVat: boolean;
}

export interface OrgTreasuryInfo {
  cashSafetyMonths: number;
  monthlyCharges: number;
  fixedCostId: string | null;
}

export interface OrgTemplatesInfo {
  whatsappTemplateFr: string;
  whatsappTemplateEn: string;
  emailTemplateFr: string;
  emailTemplateEn: string;
}

export interface OrgSettings {
  orgId: string;
  company: OrgCompanyInfo;
  billing: OrgBillingInfo;
  treasury: OrgTreasuryInfo;
  templates: OrgTemplatesInfo;
}

// La colonne orgs.tax_id stocke plusieurs informations légales séparées
// par des barres verticales : NINEA | RC | Téléphone | Email | Coordonnées bancaires.
// (Le schéma de la base ne peut pas être modifié depuis l'application.)
export function parseOrgTaxId(taxId: string | null | undefined): {
  ninea: string;
  rc: string;
  phone: string;
  email: string;
  bank: string;
} {
  const parts = (taxId || "").split("|");
  return {
    ninea: (parts[0] || "").trim(),
    rc: (parts[1] || "").trim(),
    phone: (parts[2] || "").trim(),
    email: (parts[3] || "").trim(),
    bank: (parts[4] || "").trim(),
  };
}

export function buildOrgTaxId(info: {
  ninea: string;
  rc: string;
  phone: string;
  email: string;
  bank: string;
}): string {
  return [info.ninea, info.rc, info.phone, info.email, info.bank]
    .map((p) => (p || "").trim().replace(/\|/g, "/"))
    .join("|");
}

const DEFAULT_TEMPLATES: OrgTemplatesInfo = {
  whatsappTemplateFr:
    "Bonjour {{prenom}}, nous vous informons que la facture {{numero}} d'un montant de {{montant}} est disponible. Merci de régler avant le {{date}}.",
  whatsappTemplateEn:
    "Hello {{prenom}}, we inform you that invoice {{numero}} for {{montant}} is available. Please settle before {{date}}.",
  emailTemplateFr:
    "Bonjour {{prenom}},\n\nVous trouverez ci-joint la facture {{numero}} d'un montant de {{montant}}, payable avant le {{date}}.\n\nCordialement,\nL'équipe.",
  emailTemplateEn:
    "Hello {{prenom}},\n\nPlease find attached invoice {{numero}} for {{montant}}, due on {{date}}.\n\nBest regards,\nThe team.",
};

// Les templates de relance sont édités dans Paramètres et stockés dans le
// localStorage sous ces clés. Cette fonction est l'unique point de lecture.
export function getReminderTemplates(): OrgTemplatesInfo {
  if (typeof window === "undefined") return DEFAULT_TEMPLATES;
  return {
    whatsappTemplateFr: localStorage.getItem("waTemplateFr") || DEFAULT_TEMPLATES.whatsappTemplateFr,
    whatsappTemplateEn: localStorage.getItem("waTemplateEn") || DEFAULT_TEMPLATES.whatsappTemplateEn,
    emailTemplateFr: localStorage.getItem("emailTemplateFr") || DEFAULT_TEMPLATES.emailTemplateFr,
    emailTemplateEn: localStorage.getItem("emailTemplateEn") || DEFAULT_TEMPLATES.emailTemplateEn,
  };
}

// Convertit une charge fixe en équivalent mensuel selon sa périodicité.
export function toMonthlyAmount(amount: number, periodicity: string | null | undefined): number {
  const p = (periodicity || "monthly").toLowerCase();
  if (p.startsWith("year") || p.startsWith("annu")) return amount / 12;
  if (p.startsWith("quart") || p.startsWith("trim")) return amount / 3;
  return amount;
}

export async function fetchOrgSettings(): Promise<OrgSettings | null> {
  try {
    const supabase = createBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: userData } = await supabase
      .schema("nafaflow")
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!userData?.org_id) return null;

    const [{ data: org }, { data: fixedCosts }] = await Promise.all([
      supabase.schema("nafaflow").from("orgs").select("*").eq("id", userData.org_id).single(),
      supabase
        .schema("nafaflow")
        .from("fixed_costs")
        .select("*")
        .eq("org_id", userData.org_id)
        .eq("active", true),
    ]);

    if (!org) return null;

    const legal = parseOrgTaxId(org.tax_id);
    const monthlyCharges = (fixedCosts || []).reduce(
      (sum, fc) => sum + toMonthlyAmount(Number(fc.amount) || 0, fc.periodicity),
      0
    );

    return {
      orgId: org.id,
      company: {
        name: org.name || "",
        address: org.address || "",
        logo: org.logo_url || "",
        ninea: legal.ninea,
        rc: legal.rc,
        phone: legal.phone,
        email: legal.email,
        bank: legal.bank,
      },
      billing: {
        vat: Number(org.vat_rate) || 18,
        paymentTerm: org.payment_terms_days ?? 30,
        numberingPrefix: org.invoice_prefix || "NF",
        applyVat: org.vat_enabled ?? true,
      },
      treasury: {
        cashSafetyMonths: org.cash_safety_months ?? 1,
        monthlyCharges: Math.round(monthlyCharges),
        fixedCostId: fixedCosts && fixedCosts.length > 0 ? fixedCosts[0].id : null,
      },
      templates: getReminderTemplates(),
    };
  } catch (err) {
    console.error("fetchOrgSettings error:", err);
    return null;
  }
}

export interface ClientProfile {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  address: string;
  ninea: string;
  rc: string;
}

export async function fetchClientProfile(clientId: string): Promise<ClientProfile | null> {
  try {
    const supabase = createBrowserClient();
    const { data } = await supabase
      .schema("nafaflow")
      .from("clients")
      .select("id, name, email, whatsapp, address, tax_id")
      .eq("id", clientId)
      .maybeSingle();

    if (!data) return null;
    const legal = parseOrgTaxId(data.tax_id);
    return {
      id: data.id,
      name: data.name || "",
      email: (data.email || "").trim(),
      whatsapp: (data.whatsapp || "").trim(),
      address: data.address || "",
      ninea: legal.ninea,
      rc: legal.rc,
    };
  } catch (err) {
    console.error("fetchClientProfile error:", err);
    return null;
  }
}

// Normalise un numéro pour wa.me : chiffres uniquement, indicatif 221 ajouté
// pour les numéros sénégalais saisis en local (9 chiffres commençant par 7 ou 3).
export function normalizeWhatsAppNumber(raw: string | null | undefined): string | null {
  let digits = (raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9 && (digits.startsWith("7") || digits.startsWith("3"))) {
    digits = "221" + digits;
  }
  return digits.length >= 8 ? digits : null;
}

// Message d'erreur lisible, quel que soit le type d'erreur (Error, PostgrestError, etc.).
// Évite les toasts « [object Object] ».
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [e.message, e.details].filter(Boolean);
    if (parts.length > 0) return parts.join(" — ");
    try {
      return JSON.stringify(err);
    } catch {
      return "Erreur inconnue";
    }
  }
  return String(err);
}
