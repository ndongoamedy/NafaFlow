"use client";

import { useState, useEffect, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus, Eye, Trash2, Edit2, Phone, Mail, Download, Upload } from "lucide-react";
import ClientForm from "./ClientForm";
import ConfirmDeleteModal from "@/components/shared/ConfirmDeleteModal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { buildCsv, downloadCsv, parseCsv } from "@/lib/utils/csv";

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

export default function ClientList() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingClient, setEditingClient] = useState<ClientItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete candidate state
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);

  const loadClients = async () => {
    setLoading(true);
    const supabase = createBrowserClient();
    try {
      // 1. Fetch user org context matching auth.uid()
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        console.error("Erreur de récupération de l'utilisateur auth :", authErr);
      }

      let currentOrgId = orgId;
      if (user) {
        const { data: userData, error: userErr } = await supabase
          .schema("nafaflow")
          .from("users")
          .select("org_id")
          .eq("id", user.id)
          .maybeSingle();

        if (userErr) {
          console.error("Erreur lors de la récupération du profil utilisateur :", userErr);
        }
        
        currentOrgId = userData?.org_id || null;
        if (currentOrgId) {
          setOrgId(currentOrgId);
        }
      }

      // 2. Fetch clients
      const { data, error } = await supabase
        .schema("nafaflow")
        .from("clients")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;

      if (data) {
        const mapped: ClientItem[] = data.map((c) => {
          const [ninea, rc] = (c.tax_id || "").split("|");
          return {
            id: c.id,
            name: c.name,
            email: c.email || "",
            phone: c.whatsapp || "",
            sector: c.sector || "Technologie",
            address: c.address || "",
            ninea: ninea || "",
            rc: rc || "",
          };
        });
        setClients(mapped);
      }
    } catch (err: unknown) {
      toast.error("Erreur lors du chargement des clients : " + formatError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteConfirm = async () => {
    if (deleteCandidate) {
      const supabase = createBrowserClient();
      try {
        const { error } = await supabase
          .schema("nafaflow")
          .from("clients")
          .delete()
          .eq("id", deleteCandidate);

        if (error) throw error;

        setClients((prev) => prev.filter((c) => c.id !== deleteCandidate));
        toast.success("Client supprimé avec succès.");
      } catch (err: unknown) {
        toast.error("Erreur lors de la suppression : " + formatError(err));
      } finally {
        setDeleteCandidate(null);
      }
    }
  };

  const handleSave = async (clientData: Omit<ClientItem, "id"> & { id?: string }) => {
    const supabase = createBrowserClient();
    try {
      const taxId = `${clientData.ninea || ""}|${clientData.rc || ""}`;

      if (clientData.id) {
        // Edit mode
        const { error } = await supabase
          .schema("nafaflow")
          .from("clients")
          .update({
            name: clientData.name,
            email: clientData.email,
            whatsapp: clientData.phone,
            sector: clientData.sector,
            address: clientData.address,
            tax_id: taxId,
          })
          .eq("id", clientData.id);

        if (error) throw error;

        setClients((prev) =>
          prev.map((c) => (c.id === clientData.id ? { ...c, ...clientData } as ClientItem : c))
        );
        toast.success("Fiche client mise à jour.");
      } else {
        // Create mode
        let activeOrgId = orgId;
        const { data: { user } } = await supabase.auth.getUser();

        if (!activeOrgId && user) {
          const { data: userData } = await supabase
            .schema("nafaflow")
            .from("users")
            .select("org_id")
            .eq("id", user.id)
            .maybeSingle();
          if (userData?.org_id) {
            activeOrgId = userData.org_id;
            setOrgId(userData.org_id);
          }
        }

        if (!activeOrgId) {
          toast.error("Impossible de créer le client : identifiant d'organisation introuvable.");
          return;
        }

        const { data, error } = await supabase
          .schema("nafaflow")
          .from("clients")
          .insert({
            org_id: activeOrgId,
            name: clientData.name,
            email: clientData.email,
            whatsapp: clientData.phone,
            sector: clientData.sector,
            address: clientData.address,
            tax_id: taxId,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const [ninea, rc] = (data.tax_id || "").split("|");
          const newClient: ClientItem = {
            id: data.id,
            name: data.name,
            email: data.email || "",
            phone: data.whatsapp || "",
            sector: data.sector || "Technologie",
            address: data.address || "",
            ninea: ninea || "",
            rc: rc || "",
          };
          setClients((prev) => [...prev, newClient]);
          toast.success("Nouveau client créé.");
        }
      }
      setIsFormOpen(false);
      setEditingClient(null);
    } catch (err: unknown) {
      toast.error("Erreur lors de l'enregistrement : " + formatError(err));
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const csv = buildCsv(
      [
        { key: "name", header: "Nom" },
        { key: "sector", header: "Secteur" },
        { key: "email", header: "Email" },
        { key: "phone", header: "WhatsApp" },
        { key: "address", header: "Adresse" },
        { key: "ninea", header: "NINEA" },
        { key: "rc", header: "RC" },
      ],
      clients.map((c) => ({
        name: c.name,
        sector: c.sector,
        email: c.email,
        phone: c.phone,
        address: c.address,
        ninea: c.ninea,
        rc: c.rc,
      }))
    );
    downloadCsv(`clients_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success("Export CSV lancé !");
  };

  // CSV Import
  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error("Fichier CSV vide ou invalide.");
        return;
      }

      const supabase = createBrowserClient();
      let activeOrgId = orgId;
      if (!activeOrgId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase
            .schema("nafaflow")
            .from("users")
            .select("org_id")
            .eq("id", user.id)
            .maybeSingle();
          activeOrgId = userData?.org_id || null;
          if (activeOrgId) setOrgId(activeOrgId);
        }
      }
      if (!activeOrgId) {
        toast.error("Import impossible : organisation introuvable.");
        return;
      }

      const pick = (row: Record<string, string>, keys: string[]) => {
        for (const k of Object.keys(row)) {
          const norm = k.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
          if (keys.includes(norm)) return row[k];
        }
        return "";
      };

      const toInsert = rows
        .map((row) => {
          const name = pick(row, ["nom", "name", "client", "raison sociale", "client / raison sociale"]).trim();
          if (!name) return null;
          const ninea = pick(row, ["ninea"]).trim();
          const rc = pick(row, ["rc", "registre de commerce"]).trim();
          return {
            org_id: activeOrgId,
            name,
            email: pick(row, ["email", "e-mail", "mail", "courriel"]).trim() || null,
            whatsapp: pick(row, ["whatsapp", "telephone", "téléphone", "tel", "phone", "numero"]).trim() || null,
            sector: pick(row, ["secteur", "sector"]).trim() || "Technologie",
            address: pick(row, ["adresse", "address"]).trim() || null,
            tax_id: `${ninea}|${rc}`,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (toInsert.length === 0) {
        toast.error("Aucune ligne valide trouvée (colonne « Nom » requise).");
        return;
      }

      const { data, error } = await supabase
        .schema("nafaflow")
        .from("clients")
        .insert(toInsert)
        .select();

      if (error) throw error;

      await loadClients();
      toast.success(`${data?.length || toInsert.length} client(s) importé(s) avec succès.`);
    } catch (err: unknown) {
      toast.error("Erreur lors de l'import : " + formatError(err));
    } finally {
      setImporting(false);
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        {/* Search Input */}
        <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:ring-1 focus-within:ring-[#16A34A] focus-within:border-[#16A34A] focus-within:bg-white transition-all w-full sm:w-64">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-0 outline-0 text-sm ml-2 w-full placeholder-slate-400 text-slate-700 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
          {/* Hidden file input for import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportCSV}
            className="hidden"
          />

          {/* Import Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportClick}
            disabled={importing}
            className="bg-white hover:bg-slate-50 text-slate-600 font-semibold border-slate-200 h-9 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            <span>{importing ? "Import..." : "Importer"}</span>
          </Button>

          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="bg-white hover:bg-slate-50 text-slate-600 font-semibold border-slate-200 h-9 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <Download className="h-4 w-4" />
            <span>Exporter</span>
          </Button>

          {/* Add Trigger Modal */}
          <Dialog open={isFormOpen} onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingClient(null);
          }}>
            <DialogTrigger asChild>
              <Button className="bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold h-9 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-700/10">
                <Plus className="h-4 w-4" />
                <span>Nouveau client</span>
              </Button>
            </DialogTrigger>
          <ClientForm
            client={editingClient}
            onSave={handleSave}
            onClose={() => {
              setIsFormOpen(false);
              setEditingClient(null);
            }}
          />
          </Dialog>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-100">
              <TableRow className="text-slate-400 text-[10px] tracking-wider uppercase font-bold hover:bg-slate-50">
                <TableHead className="py-3 px-6">Client / Raison Sociale</TableHead>
                <TableHead className="py-3 px-6">Secteur</TableHead>
                <TableHead className="py-3 px-6">E-mail</TableHead>
                <TableHead className="py-3 px-6">WhatsApp</TableHead>
                <TableHead className="py-3 px-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 text-slate-700 text-sm">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="py-4 px-6">
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell className="py-4 px-6"></TableCell>
                  </TableRow>
                ))
              ) : filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <TableRow
                    key={client.id}
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/clients/${client.id}`)}
                  >
                    <TableCell className="py-3.5 px-6 font-semibold text-slate-800">
                      {client.name}
                    </TableCell>
                    <TableCell className="py-3.5 px-6">
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {client.sector}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 px-6 text-slate-500">
                      <span className="flex items-center gap-1.5 text-xs">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {client.email}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 px-6 text-slate-500">
                      <span className="flex items-center gap-1.5 text-xs font-medium tabular-nums">
                        <Phone className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        {client.phone}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/clients/${client.id}`);
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-[#16A34A] hover:bg-emerald-50 rounded-lg shrink-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingClient(client);
                            setIsFormOpen(true);
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg shrink-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteCandidate(client.id);
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                    Aucun client répertorié.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={deleteCandidate !== null}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={handleDeleteConfirm}
        title="Supprimer la fiche client"
        message={`Êtes-vous sûr de vouloir supprimer la fiche de ce client ? Cette action supprimera définitivement ses données de Supabase.`}
      />
    </div>
  );
}
