"use client";

// Types
export interface ServiceItem {
  id: string;
  name: string;
  category: string;
  price: number;
  isRecurrent: boolean;
  isActive: boolean;
  included: string[];
  excluded: string[];
}

export interface ClientItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  sector: string;
  address: string;
  ninea: string;
  rc: string;
}

export interface DevisLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface DevisItem {
  id: string;
  clientName: string;
  clientId: string;
  issueDate: string;
  validityDays: number;
  total: number;
  status: "brouillon" | "envoyée" | "accepted" | "refusé" | string;
  lines: DevisLine[];
}

export interface InvoicePayment {
  id: string;
  amount: number;
  date: string;
  method: "Espèces" | "Virement" | "Wave" | "Orange Money" | "Chèque" | "Autre" | string;
  note?: string;
  cashEntryId: string;
}

export interface InvoiceItem {
  id: string;
  clientName: string;
  clientId: string;
  issueDate: string;
  dueDate: string;
  total: number;
  status: "payée" | "partiellement payée" | "envoyée" | "brouillon" | "en retard" | string;
  lines: DevisLine[];
  timeline: { status: string; date: string; comment?: string }[];
  payments?: InvoicePayment[];
}

export interface CashEntry {
  id: string;
  date: string;
  type: "in" | "out";
  amount: number;
  label: string;
  category: string;
  linkType?: "invoice" | string;
  linkId?: string;
}

export interface CompanySettings {
  name: string;
  address: string;
  logo: string;
  ninea: string;
  rc: string;
}

export interface BillingSettings {
  vat: number;
  paymentTerm: number;
  numberingPrefix: string;
  applyVat: boolean;
}

export interface TemplateSettings {
  whatsappTemplateFr: string;
  whatsappTemplateEn: string;
  emailTemplateFr: string;
  emailTemplateEn: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Collaborateur" | "Lecture seule";
  permissions?: Record<string, boolean>;
}

export const ALL_PERMISSIONS = [
  // Devis
  { key: "devis_voir", label: "Voir", group: "DEVIS" },
  { key: "devis_creer", label: "Créer", group: "DEVIS" },
  { key: "devis_modifier", label: "Modifier", group: "DEVIS" },
  { key: "devis_supprimer", label: "Supprimer", group: "DEVIS" },
  { key: "devis_envoyer", label: "Envoyer", group: "DEVIS" },
  // Factures
  { key: "factures_voir", label: "Voir", group: "FACTURES" },
  { key: "factures_creer", label: "Créer", group: "FACTURES" },
  { key: "factures_modifier", label: "Modifier", group: "FACTURES" },
  { key: "factures_supprimer", label: "Supprimer", group: "FACTURES" },
  { key: "factures_changer_statut", label: "Changer statut", group: "FACTURES" },
  { key: "factures_envoyer", label: "Envoyer", group: "FACTURES" },
  // Clients
  { key: "clients_voir", label: "Voir", group: "CLIENTS" },
  { key: "clients_creer", label: "Créer", group: "CLIENTS" },
  { key: "clients_modifier", label: "Modifier", group: "CLIENTS" },
  { key: "clients_supprimer", label: "Supprimer", group: "CLIENTS" },
  // Catalogue
  { key: "catalogue_voir", label: "Voir", group: "CATALOGUE" },
  { key: "catalogue_creer", label: "Créer", group: "CATALOGUE" },
  { key: "catalogue_modifier", label: "Modifier", group: "CATALOGUE" },
  { key: "catalogue_supprimer", label: "Supprimer", group: "CATALOGUE" },
  // Trésorerie
  { key: "tresorerie_voir", label: "Voir", group: "TRÉSORERIE" },
  { key: "tresorerie_ajouter", label: "Ajouter une entrée", group: "TRÉSORERIE" },
  // P&L
  { key: "pl_voir", label: "Voir", group: "P&L" },
  // Paramètres
  { key: "parametres_voir", label: "Voir", group: "PARAMÈTRES" },
  { key: "parametres_modifier_societe", label: "Modifier société", group: "PARAMÈTRES" },
  { key: "parametres_gerer_equipe", label: "Gérer l'équipe", group: "PARAMÈTRES" },
];

export const PERMISSION_GROUPS: Record<string, { key: string; label: string }[]> = {
  "DEVIS": [
    { key: "devis_voir", label: "Voir" },
    { key: "devis_creer", label: "Créer" },
    { key: "devis_modifier", label: "Modifier" },
    { key: "devis_supprimer", label: "Supprimer" },
    { key: "devis_envoyer", label: "Envoyer" },
  ],
  "FACTURES": [
    { key: "factures_voir", label: "Voir" },
    { key: "factures_creer", label: "Créer" },
    { key: "factures_modifier", label: "Modifier" },
    { key: "factures_supprimer", label: "Supprimer" },
    { key: "factures_changer_statut", label: "Changer statut" },
    { key: "factures_envoyer", label: "Envoyer" },
  ],
  "CLIENTS": [
    { key: "clients_voir", label: "Voir" },
    { key: "clients_creer", label: "Créer" },
    { key: "clients_modifier", label: "Modifier" },
    { key: "clients_supprimer", label: "Supprimer" },
  ],
  "CATALOGUE": [
    { key: "catalogue_voir", label: "Voir" },
    { key: "catalogue_creer", label: "Créer" },
    { key: "catalogue_modifier", label: "Modifier" },
    { key: "catalogue_supprimer", label: "Supprimer" },
  ],
  "TRÉSORERIE": [
    { key: "tresorerie_voir", label: "Voir" },
    { key: "tresorerie_ajouter", label: "Ajouter une entrée" },
  ],
  "P&L": [
    { key: "pl_voir", label: "Voir P&L" },
  ],
  "PARAMÈTRES": [
    { key: "parametres_voir", label: "Voir" },
    { key: "parametres_modifier_societe", label: "Modifier société" },
    { key: "parametres_gerer_equipe", label: "Gérer l'équipe" },
  ],
};

export function getDefaultPermissions(role: "Admin" | "Collaborateur" | "Lecture seule"): Record<string, boolean> {
  const perms: Record<string, boolean> = {};
  
  ALL_PERMISSIONS.forEach((p) => {
    if (role === "Admin") {
      perms[p.key] = true;
    } else if (role === "Collaborateur") {
      if (
        p.key === "devis_supprimer" ||
        p.key === "factures_supprimer" ||
        p.key === "clients_supprimer" ||
        p.key === "catalogue_supprimer" ||
        p.key === "parametres_modifier_societe" ||
        p.key === "parametres_gerer_equipe"
      ) {
        perms[p.key] = false;
      } else {
        perms[p.key] = true;
      }
    } else {
      if (
        p.key === "devis_voir" ||
        p.key === "factures_voir" ||
        p.key === "clients_voir" ||
        p.key === "catalogue_voir" ||
        p.key === "tresorerie_voir" ||
        p.key === "pl_voir" ||
        p.key === "parametres_voir"
      ) {
        perms[p.key] = true;
      } else {
        perms[p.key] = false;
      }
    }
  });

  return perms;
}

export function isPermissionsCustomized(role: "Admin" | "Collaborateur" | "Lecture seule", currentPerms?: Record<string, boolean>): boolean {
  if (!currentPerms) return false;
  if (role === "Admin") return false;
  
  const defaults = getDefaultPermissions(role);
  return ALL_PERMISSIONS.some((p) => {
    const currentVal = currentPerms[p.key] ?? defaults[p.key];
    return currentVal !== defaults[p.key];
  });
}

export interface AppSettings {
  company: CompanySettings;
  billing: BillingSettings;
  templates: TemplateSettings;
  team: TeamMember[];
}

// Default Seed Data
const DEFAULT_CLIENTS: ClientItem[] = [
  {
    id: "C-001",
    name: "Jokkolabs Dakar",
    email: "contact@jokkolabs.sn",
    phone: "+221773918239",
    sector: "Technologie",
    address: "Rue 10, Dakar, Sénégal",
    ninea: "001238918G1",
    rc: "SN-DKR-2023-B-8902",
  },
  {
    id: "C-002",
    name: "Dakar Studio",
    email: "accounting@dakarstudio.com",
    phone: "+221771234567",
    sector: "Services / Conseil",
    address: "Mermoz, Rue MZ-12, Dakar, Sénégal",
    ninea: "004381923G2",
    rc: "SN-DKR-2026-B-1122",
  },
  {
    id: "C-003",
    name: "ABC Consulting",
    email: "info@abc.sn",
    phone: "+221774029312",
    sector: "Services / Conseil",
    address: "Almadies, Dakar, Sénégal",
    ninea: "002381920G1",
    rc: "SN-DKR-2024-B-3401",
  },
  {
    id: "C-004",
    name: "Kinkeliba SARL",
    email: "admin@kinkeliba.com",
    phone: "+221778931234",
    sector: "Santé",
    address: "Fann Résidence, Dakar, Sénégal",
    ninea: "003918204G2",
    rc: "SN-DKR-2022-B-9904",
  },
  {
    id: "C-005",
    name: "Yassir Sénégal",
    email: "finances@yassir.sn",
    phone: "+221775551234",
    sector: "Technologie",
    address: "Vdn, Villa N° 45, Dakar, Sénégal",
    ninea: "005391238G3",
    rc: "SN-DKR-2025-B-1402",
  },
];

const DEFAULT_SERVICES: ServiceItem[] = [
  {
    id: "S-001",
    name: "Développement Application Web",
    category: "Développement",
    price: 3500000,
    isRecurrent: false,
    isActive: true,
    included: ["React / Next.js", "Base de données", "Intégration API Stripe/Wave"],
    excluded: ["Hébergement cloud", "Licences payantes"],
  },
  {
    id: "S-002",
    name: "Design d'Interface UI/UX",
    category: "Design",
    price: 1250000,
    isRecurrent: false,
    isActive: true,
    included: ["Figma source", "Maquettes mobiles & web", "Prototype interactif"],
    excluded: ["Intégration HTML/CSS"],
  },
  {
    id: "S-003",
    name: "Maintenance Serveur & Support",
    category: "Maintenance",
    price: 350000,
    isRecurrent: true,
    isActive: true,
    included: ["Sauvegarde journalière", "Mises à jour de sécurité", "Temps d'intervention < 4h"],
    excluded: ["Ajouts de nouvelles fonctionnalités"],
  },
  {
    id: "S-005",
    name: "Hébergement Cloud Managé",
    category: "Maintenance",
    price: 150000,
    isRecurrent: true,
    isActive: true,
    included: ["Hébergement Vercel / AWS", "Certificats SSL", "Bande passante illimitée"],
    excluded: ["Infogérance", "Support applicatif"],
  },
];

const DEFAULT_QUOTES: DevisItem[] = [
  {
    id: "D-2026-005",
    clientName: "Jokkolabs Dakar",
    clientId: "C-001",
    issueDate: "2026-06-06",
    validityDays: 15,
    total: 600000,
    status: "brouillon",
    lines: [{ id: "1", description: "Maintenance Serveur & Support (Acompte)", quantity: 1, unitPrice: 508474.57 }],
  },
  {
    id: "D-2026-004",
    clientName: "Dakar Studio",
    clientId: "C-002",
    issueDate: "2026-06-05",
    validityDays: 15,
    total: 1250000,
    status: "envoyée",
    lines: [{ id: "1", description: "Design d'Interface UI/UX", quantity: 1, unitPrice: 1059322.03 }],
  },
  {
    id: "D-2026-003",
    clientName: "ABC Consulting",
    clientId: "C-003",
    issueDate: "2026-06-01",
    validityDays: 15,
    total: 850000,
    status: "accepted",
    lines: [{ id: "1", description: "Audit & Conseil Stratégique", quantity: 1, unitPrice: 720338.98 }],
  },
  {
    id: "D-2026-002",
    clientName: "Yassir Sénégal",
    clientId: "C-005",
    issueDate: "2026-05-20",
    validityDays: 15,
    total: 3400000,
    status: "refusé",
    lines: [{ id: "1", description: "Campagne Marketing Digitale", quantity: 1, unitPrice: 2881355.93 }],
  },
  {
    id: "D-2026-001",
    clientName: "Kinkeliba SARL",
    clientId: "C-004",
    issueDate: "2026-05-15",
    validityDays: 15,
    total: 1500000,
    status: "accepted",
    lines: [{ id: "1", description: "Prestation de Conseil", quantity: 1, unitPrice: 1271186.44 }],
  },
];

const DEFAULT_INVOICES: InvoiceItem[] = [
  {
    id: "F-2026-005",
    clientName: "Jokkolabs Dakar",
    clientId: "C-001",
    issueDate: "2026-06-06",
    dueDate: "2026-07-06",
    total: 600000,
    status: "partiellement payée",
    lines: [{ id: "1", description: "Maintenance Serveur & Support (Jalon 1)", quantity: 1, unitPrice: 508474.57 }],
    timeline: [
      { status: "brouillon", date: "2026-06-06", comment: "Facture créée en brouillon" },
      { status: "partiellement payée", date: "2026-06-06", comment: "Paiement partiel de 400 000 F reçu (Wave)" },
    ],
    payments: [
      {
        id: "P-001",
        amount: 400000,
        date: "2026-06-06",
        method: "Wave",
        note: "Acompte Jalon 1",
        cashEntryId: "JE-001"
      }
    ]
  },
  {
    id: "F-2026-004",
    clientName: "Dakar Studio",
    clientId: "C-002",
    issueDate: "2026-06-05",
    dueDate: "2026-07-05",
    total: 1250000,
    status: "envoyée",
    lines: [{ id: "1", description: "Design d'Interface UI/UX", quantity: 1, unitPrice: 1059322.03 }],
    timeline: [
      { status: "brouillon", date: "2026-06-05", comment: "Facture créée en brouillon" },
      { status: "envoyée", date: "2026-06-05", comment: "Envoyée par email" },
    ],
    payments: []
  },
  {
    id: "F-2026-003",
    clientName: "ABC Consulting",
    clientId: "C-003",
    issueDate: "2026-06-01",
    dueDate: "2026-07-01",
    total: 850000,
    status: "payée",
    lines: [{ id: "1", description: "Audit & Conseil Stratégique", quantity: 1, unitPrice: 720338.98 }],
    timeline: [
      { status: "brouillon", date: "2026-06-01", comment: "Facture créée en brouillon" },
      { status: "envoyée", date: "2026-06-01", comment: "Envoyée par email" },
      { status: "payée", date: "2026-06-02", comment: "Paiement reçu" },
    ],
    payments: [
      {
        id: "P-002",
        amount: 850000,
        date: "2026-06-02",
        method: "Virement",
        note: "Règlement solde facture",
        cashEntryId: "JE-003"
      }
    ]
  },
  {
    id: "F-2026-002",
    clientName: "Yassir Sénégal",
    clientId: "C-005",
    issueDate: "2026-05-20",
    dueDate: "2026-06-20",
    total: 3400000,
    status: "en retard",
    lines: [{ id: "1", description: "Campagne Marketing Digitale", quantity: 1, unitPrice: 2881355.93 }],
    timeline: [
      { status: "brouillon", date: "2026-05-20", comment: "Facture créée" },
      { status: "envoyée", date: "2026-05-20", comment: "Envoyée" },
    ],
    payments: []
  },
  {
    id: "F-2026-001",
    clientName: "Kinkeliba SARL",
    clientId: "C-004",
    issueDate: "2026-05-15",
    dueDate: "2026-06-15",
    total: 1500000,
    status: "payée",
    lines: [{ id: "1", description: "Prestation de Conseil", quantity: 1, unitPrice: 1271186.44 }],
    timeline: [
      { status: "brouillon", date: "2026-05-15", comment: "Créée" },
      { status: "envoyée", date: "2026-05-15", comment: "Envoyée" },
      { status: "payée", date: "2026-05-28", comment: "Payée" },
    ],
    payments: [
      {
        id: "P-003",
        amount: 1500000,
        date: "2026-05-28",
        method: "Espèces",
        note: "Paiement espèces",
        cashEntryId: "JE-006"
      }
    ]
  },
];

const DEFAULT_JOURNAL: CashEntry[] = [
  { id: "JE-001", date: "2026-06-06", type: "in", amount: 400000, label: "Paiement facture F-2026-005 — Jokkolabs Dakar", category: "Ventes", linkType: "invoice", linkId: "F-2026-005" },
  { id: "JE-002", date: "2026-06-05", type: "out", amount: 200000, label: "Facture AWS Cloud Juin", category: "Hébergement Cloud" },
  { id: "JE-003", date: "2026-06-02", type: "in", amount: 850000, label: "Paiement facture F-2026-003 — ABC Consulting", category: "Ventes", linkType: "invoice", linkId: "F-2026-003" },
  { id: "JE-004", date: "2026-05-31", type: "out", amount: 1200000, label: "Salaires de l'équipe", category: "Salaires" },
  { id: "JE-005", date: "2026-05-28", type: "out", amount: 350000, label: "Loyer Bureau Dakar Studio", category: "Loyer" },
  { id: "JE-006", date: "2026-05-28", type: "in", amount: 1500000, label: "Paiement facture F-2026-001 — Kinkeliba SARL", category: "Ventes", linkType: "invoice", linkId: "F-2026-001" },
];

const DEFAULT_SETTINGS: AppSettings = {
  company: {
    name: "Nafa Corp",
    address: "Vdn, Cité Keur Gorgui, Dakar, Sénégal",
    logo: "",
    ninea: "009823192G1",
    rc: "SN-DKR-2025-B-1234",
  },
  billing: {
    vat: 18,
    paymentTerm: 30,
    numberingPrefix: "FAC-",
    applyVat: true,
  },
  templates: {
    whatsappTemplateFr: "Bonjour {{prenom}}, nous vous informons que la facture {{numero}} d'un montant de {{montant}} est disponible. Merci de régler avant le {{date}}.",
    whatsappTemplateEn: "Hello {{prenom}}, we inform you that invoice {{numero}} for {{montant}} is available. Please settle before {{date}}.",
    emailTemplateFr: "Bonjour {{prenom}},\n\nVous trouverez ci-joint la facture {{numero}} d'un montant de {{montant}}, payable avant le {{date}}.\n\nCordialement,\nL'équipe.",
    emailTemplateEn: "Hello {{prenom}},\n\nPlease find attached invoice {{numero}} for {{montant}}, due on {{date}}.\n\nBest regards,\nThe team.",
  },
  team: [
    { id: "tm-1", name: "Amadou Diallo", email: "amadou@nafaflow.com", role: "Admin" },
    { id: "tm-2", name: "Fatou Ndoye", email: "fatou@nafaflow.com", role: "Collaborateur" },
    { id: "tm-3", name: "Ibrahima Sene", email: "ibrahima@nafaflow.com", role: "Lecture seule" },
  ],
};

// LocalStorage access helpers
function getStorageItem<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(error);
    return defaultValue;
  }
}

function setStorageItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("local-state-change"));
  } catch (error) {
    console.error(error);
  }
}

// Exported State Actions
export function getClients(): ClientItem[] {
  return getStorageItem("nafaflow_clients", DEFAULT_CLIENTS);
}

export function saveClient(client: ClientItem): void {
  const clients = getClients();
  const index = clients.findIndex((c) => c.id === client.id);
  if (index >= 0) {
    clients[index] = client;
  } else {
    clients.push(client);
  }
  setStorageItem("nafaflow_clients", clients);
}

export function deleteClient(id: string): void {
  const clients = getClients().filter((c) => c.id !== id);
  setStorageItem("nafaflow_clients", clients);
}

// Quotes
export function getQuotes(): DevisItem[] {
  return getStorageItem("nafaflow_quotes", DEFAULT_QUOTES);
}

export function saveQuote(quote: DevisItem): void {
  const quotes = getQuotes();
  const index = quotes.findIndex((q) => q.id === quote.id);
  if (index >= 0) {
    quotes[index] = quote;
  } else {
    quotes.push(quote);
  }
  setStorageItem("nafaflow_quotes", quotes);
}

export function deleteQuote(id: string): void {
  const quotes = getQuotes().filter((q) => q.id !== id);
  setStorageItem("nafaflow_quotes", quotes);
}

// Invoices
export function getInvoices(): InvoiceItem[] {
  return getStorageItem("nafaflow_invoices", DEFAULT_INVOICES);
}

export function saveInvoice(invoice: InvoiceItem): void {
  const invoices = getInvoices();
  const index = invoices.findIndex((i) => i.id === invoice.id);
  if (index >= 0) {
    invoices[index] = invoice;
  } else {
    invoices.push(invoice);
  }
  setStorageItem("nafaflow_invoices", invoices);
}

export function deleteInvoice(id: string): void {
  const invoices = getInvoices().filter((i) => i.id !== id);
  setStorageItem("nafaflow_invoices", invoices);
}

// Services Catalog
export function getServices(): ServiceItem[] {
  return getStorageItem("nafaflow_services", DEFAULT_SERVICES);
}

export function saveService(service: ServiceItem): void {
  const services = getServices();
  const index = services.findIndex((s) => s.id === service.id);
  if (index >= 0) {
    services[index] = service;
  } else {
    services.push(service);
  }
  setStorageItem("nafaflow_services", services);
}

export function deleteService(id: string): void {
  const services = getServices().filter((s) => s.id !== id);
  setStorageItem("nafaflow_services", services);
}

// Journal entries
export function getJournal(): CashEntry[] {
  return getStorageItem("nafaflow_journal", DEFAULT_JOURNAL);
}

export function saveJournal(entry: CashEntry): void {
  const journal = getJournal();
  const index = journal.findIndex((j) => j.id === entry.id);
  if (index >= 0) {
    journal[index] = entry;
  } else {
    journal.unshift(entry);
  }
  setStorageItem("nafaflow_journal", journal);
}

export function deleteJournal(id: string): void {
  const journal = getJournal().filter((j) => j.id !== id);
  setStorageItem("nafaflow_journal", journal);
}

// Settings
export function getSettings(): AppSettings {
  return getStorageItem("nafaflow_settings", DEFAULT_SETTINGS);
}

export function saveSettings(settings: AppSettings): void {
  setStorageItem("nafaflow_settings", settings);
}

// Milestone Invoice Generator
export function createInvoicesFromQuote(
  quoteId: string,
  milestones: { label: string; percent: number; dueDateDays: number }[]
): void {
  const quotes = getQuotes();
  const quote = quotes.find((q) => q.id === quoteId) || {
    id: quoteId,
    clientName: "Client Inconnu",
    clientId: "C-001",
    total: 1000000,
    lines: [],
  };

  const invoices = getInvoices();
  const settings = getSettings();
  const prefix = settings.billing.numberingPrefix || "F-2026-";
  
  // Base invoice count
  const baseNumber = invoices.length + 1;

  milestones.forEach((m, idx) => {
    const totalAmount = Math.round((quote.total * m.percent) / 100);
    const invoiceId = `${prefix}${String(baseNumber + idx).padStart(3, "0")}`;
    
    const issueDate = new Date().toISOString().slice(0, 10);
    const dueDateObj = new Date();
    dueDateObj.setDate(dueDateObj.getDate() + m.dueDateDays);
    const dueDate = dueDateObj.toISOString().slice(0, 10);

    const newInvoice: InvoiceItem = {
      id: invoiceId,
      clientName: quote.clientName,
      clientId: quote.clientId || "C-001",
      issueDate,
      dueDate,
      total: totalAmount,
      status: idx === 0 ? "envoyée" : "brouillon",
      lines: [
        {
          id: `line-${idx}`,
          description: `${m.label} (${m.percent}% du devis ${quoteId})`,
          quantity: 1,
          unitPrice: totalAmount,
        },
      ],
      timeline: [
        { status: "brouillon", date: issueDate, comment: `Facture de jalon créée (${m.percent}%)` },
        ...(idx === 0 ? [{ status: "envoyée", date: issueDate, comment: "Envoyée par email et disponible" }] : []),
      ],
    };

    invoices.unshift(newInvoice);

    // Also register cash entry if milestone paid? No, only invoices are created. Cash entries are added when payments occur.
  });

  // Mark the quote as accepted / billed
  const qIndex = quotes.findIndex((q) => q.id === quoteId);
  if (qIndex >= 0) {
    quotes[qIndex].status = "accepted";
    setStorageItem("nafaflow_quotes", quotes);
  }

  setStorageItem("nafaflow_invoices", invoices);
}
