"use client";

import { useState, useEffect, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Edit2, Trash2, Download, Upload, Search, Plus } from "lucide-react";
import AmountFCFA from "@/components/shared/AmountFCFA";
import ServiceForm from "./ServiceForm";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { createBrowserClient } from "@/lib/supabase/client";
import { buildCsv, downloadCsv, parseCsv } from "@/lib/utils/csv";

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

export default function ServiceList() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Tous");
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user org_id and services list
  const loadData = async () => {
    setLoading(true);
    const supabase = createBrowserClient();
    
    try {
      // 1. Fetch user org context matching auth.uid()
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        console.error("Erreur de récupération de l'utilisateur auth :", authErr);
      }

      let currentOrgId: string | null = null;
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
        console.log("loadData: org_id récupéré pour l'utilisateur", user.id, "=>", currentOrgId);
        if (currentOrgId) {
          setOrgId(currentOrgId);
        }
      } else {
        console.warn("loadData: Aucun utilisateur connecté trouvé dans la session auth.");
      }

      // 2. Fetch services
      const { data, error } = await supabase
        .schema("nafaflow")
        .from("services")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      interface DatabaseService {
        id: string;
        name: string;
        category: string | null;
        price: number;
        is_recurring: boolean | null;
        active: boolean | null;
        inclus: string | null;
        exclus: string | null;
      }

      if (data) {
        const mapped: ServiceItem[] = (data as unknown as DatabaseService[]).map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category || "Développement",
          price: Number(s.price),
          isRecurrent: !!s.is_recurring,
          isActive: !!s.active,
          included: s.inclus ? s.inclus.split("\n").filter(Boolean) : [],
          excluded: s.exclus ? s.exclus.split("\n").filter(Boolean) : [],
        }));
        setServices(mapped);
      }
    } catch (err: unknown) {
      toast.error("Erreur lors du chargement du catalogue : " + formatError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Toggle service active status
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const supabase = createBrowserClient();
    
    try {
      const { error } = await supabase
        .schema("nafaflow")
        .from("services")
        .update({ active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      setServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isActive: !currentStatus } : s))
      );
      toast.success(
        currentStatus
          ? "Service désactivé avec succès."
          : "Service activé avec succès."
      );
    } catch (err: unknown) {
      toast.error("Erreur lors de la mise à jour du statut : " + formatError(err));
    }
  };

  // Delete service
  const handleDelete = async (id: string) => {
    const supabase = createBrowserClient();
    
    try {
      const { error } = await supabase
        .schema("nafaflow")
        .from("services")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setServices((prev) => prev.filter((s) => s.id !== id));
      toast.error("Service supprimé du catalogue.");
    } catch (err: unknown) {
      toast.error("Erreur de suppression : " + formatError(err));
    }
  };

  // Add or Edit service
  const handleSave = async (serviceData: Omit<ServiceItem, "id"> & { id?: string }) => {
    const supabase = createBrowserClient();
    
    try {
      if (serviceData.id) {
        // Edit mode
        const { error } = await supabase
          .schema("nafaflow")
          .from("services")
          .update({
            name: serviceData.name,
            category: serviceData.category,
            price: Math.round(serviceData.price),
            is_recurring: serviceData.isRecurrent,
            active: serviceData.isActive,
            inclus: serviceData.included ? serviceData.included.join("\n") : null,
            exclus: serviceData.excluded ? serviceData.excluded.join("\n") : null,
          })
          .eq("id", serviceData.id);

        if (error) throw error;

        setServices((prev) =>
          prev.map((s) => (s.id === serviceData.id ? { ...s, ...serviceData } as ServiceItem : s))
        );
        toast.success("Service catalogue mis à jour.");
      } else {
        // Create mode
        let activeOrgId = orgId;
        const { data: { user } } = await supabase.auth.getUser();

        if (!activeOrgId && user) {
          // Fallback fetch if not loaded yet
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

        console.log("handleSave (Création): org_id utilisé =", activeOrgId, "| auth.uid() =", user?.id);

        if (!activeOrgId) {
          toast.error("Impossible de créer le service : identifiant d'organisation introuvable.");
          return;
        }

        const { data, error } = await supabase
          .schema("nafaflow")
          .from("services")
          .insert({
            org_id: activeOrgId,
            name: serviceData.name,
            category: serviceData.category,
            price: Math.round(serviceData.price),
            is_recurring: serviceData.isRecurrent,
            active: serviceData.isActive,
            inclus: serviceData.included ? serviceData.included.join("\n") : null,
            exclus: serviceData.excluded ? serviceData.excluded.join("\n") : null,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const newService: ServiceItem = {
            id: data.id,
            name: data.name,
            category: data.category || "Développement",
            price: Number(data.price),
            isRecurrent: !!data.is_recurring,
            isActive: !!data.active,
            included: data.inclus ? data.inclus.split("\n").filter(Boolean) : [],
            excluded: data.exclus ? data.exclus.split("\n").filter(Boolean) : [],
          };
          setServices((prev) => [...prev, newService]);
          toast.success("Nouveau service ajouté au catalogue.");
        }
      }
      setIsFormOpen(false);
      setEditingService(null);
    } catch (err: unknown) {
      toast.error("Erreur lors de l'enregistrement : " + formatError(err));
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const csv = buildCsv(
      [
        { key: "name", header: "Nom" },
        { key: "category", header: "Categorie" },
        { key: "price", header: "Prix" },
        { key: "recurrent", header: "Recurrent" },
        { key: "statut", header: "Statut" },
        { key: "inclus", header: "Inclus" },
      ],
      services.map((s) => ({
        name: s.name,
        category: s.category,
        price: s.price,
        recurrent: s.isRecurrent ? "Oui" : "Non",
        statut: s.isActive ? "Actif" : "Inactif",
        inclus: s.included.join(" ; "),
      }))
    );
    downloadCsv(`catalogue_tarifs_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success("Export CSV lancé !");
  };

  // CSV Import
  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = ""; // permet de réimporter le même fichier
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error("Fichier CSV vide ou invalide.");
        return;
      }

      // Résout l'org_id
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

      // Colonnes tolérantes (accents / casse)
      const pick = (row: Record<string, string>, keys: string[]) => {
        for (const k of Object.keys(row)) {
          const norm = k.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
          if (keys.includes(norm)) return row[k];
        }
        return "";
      };

      const toInsert = rows
        .map((row) => {
          const name = pick(row, ["nom", "name", "service", "service / nom"]).trim();
          if (!name) return null;
          const priceRaw = pick(row, ["prix", "price", "prix unitaire", "montant"]).replace(/[^\d.,-]/g, "").replace(",", ".");
          const recurrent = pick(row, ["recurrent", "récurrent"]).toLowerCase();
          const statut = pick(row, ["statut", "status", "actif"]).toLowerCase();
          const inclus = pick(row, ["inclus", "included"]);
          return {
            org_id: activeOrgId,
            name,
            category: pick(row, ["categorie", "category", "catégorie"]).trim() || "Développement",
            price: Math.round(Number(priceRaw) || 0),
            is_recurring: recurrent === "oui" || recurrent === "yes" || recurrent === "true",
            active: statut === "" ? true : !(statut === "inactif" || statut === "non" || statut === "false"),
            inclus: inclus ? inclus.split(/[;\n]/).map((x) => x.trim()).filter(Boolean).join("\n") : null,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (toInsert.length === 0) {
        toast.error("Aucune ligne valide trouvée (colonne « Nom » requise).");
        return;
      }

      const { data, error } = await supabase
        .schema("nafaflow")
        .from("services")
        .insert(toInsert)
        .select();

      if (error) throw error;

      await loadData();
      toast.success(`${data?.length || toInsert.length} service(s) importé(s) avec succès.`);
    } catch (err: unknown) {
      toast.error("Erreur lors de l'import : " + formatError(err));
    } finally {
      setImporting(false);
    }
  };

  const filteredServices = services.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toString().toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "Tous" || s.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ["Tous", "Développement", "Design", "Conseil", "Marketing", "Maintenance"];

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          {/* Search bar */}
          <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:ring-1 focus-within:ring-[#16A34A] focus-within:border-[#16A34A] focus-within:bg-white transition-all w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Rechercher un service..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-0 outline-0 text-sm ml-2 w-full placeholder-slate-400 text-slate-700 focus:outline-none focus:ring-0"
            />
          </div>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#16A34A] text-slate-600 font-semibold"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 shrink-0">
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
            <span>{importing ? "Import..." : "Importer CSV"}</span>
          </Button>

          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="bg-white hover:bg-slate-50 text-slate-600 font-semibold border-slate-200 h-9 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <Download className="h-4 w-4" />
            <span>Exporter CSV</span>
          </Button>

          {/* Add Service Trigger */}
          <Dialog open={isFormOpen} onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingService(null);
          }}>
            <DialogTrigger asChild>
              <Button className="bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold h-9 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all">
                <Plus className="h-4 w-4" />
                <span>Ajouter service</span>
              </Button>
            </DialogTrigger>
            <ServiceForm
              service={editingService}
              onSave={handleSave}
              onClose={() => {
                setIsFormOpen(false);
                setEditingService(null);
              }}
            />
          </Dialog>
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-100">
              <TableRow className="text-slate-400 text-[10px] tracking-wider uppercase font-bold hover:bg-slate-50">
                <TableHead className="py-3 px-6">Service / Nom</TableHead>
                <TableHead className="py-3 px-6">Catégorie</TableHead>
                <TableHead className="py-3 px-6 text-right">Prix Unitaire</TableHead>
                <TableHead className="py-3 px-6 text-center">Récurrent</TableHead>
                <TableHead className="py-3 px-6 text-center">Statut</TableHead>
                <TableHead className="py-3 px-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 text-slate-700 text-sm">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="py-4 px-6">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32 mt-1.5" />
                    </TableCell>
                    <TableCell className="py-4 px-6"><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell className="py-4 px-6 text-right"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    <TableCell className="py-4 px-6"><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                    <TableCell className="py-4 px-6"><Skeleton className="h-6 w-20 mx-auto" /></TableCell>
                    <TableCell className="py-4 px-6"></TableCell>
                  </TableRow>
                ))
              ) : filteredServices.length > 0 ? (
                filteredServices.map((service) => (
                  <TableRow key={service.id} className="hover:bg-slate-50/50 transition-colors group">
                    <TableCell className="py-3.5 px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{service.name}</span>
                        {service.included.length > 0 && (
                          <span className="text-[10px] text-slate-400 mt-0.5 truncate max-w-sm">
                            Inclus: {service.included.join(", ")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 px-6">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-semibold text-[10px] tracking-wide rounded-md">
                        {service.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3.5 px-6 text-right font-bold text-slate-800">
                      <AmountFCFA amount={service.price} highlight />
                    </TableCell>
                    <TableCell className="py-3.5 px-6 text-center">
                      {service.isRecurrent ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-bold text-[10px] tracking-wide rounded-md">
                          Récurrent
                        </Badge>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={service.isActive}
                          onCheckedChange={() => handleToggleActive(service.id, service.isActive)}
                          className="data-[state=checked]:bg-[#16A34A] scale-90"
                        />
                        <span className="text-xs font-semibold w-12 text-left text-slate-500">
                          {service.isActive ? "Actif" : "Inactif"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingService(service);
                            setIsFormOpen(true);
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg shrink-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(service.id)}
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
                  <TableCell colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                    Aucun service trouvé dans le catalogue.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
