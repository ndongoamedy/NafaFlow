"use client";

import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus, Trash2, TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import AmountFCFA from "@/components/shared/AmountFCFA";
import DateDisplay from "@/components/shared/DateDisplay";
import CashEntryForm, { CashEntry } from "./CashEntryForm";
import { toast } from "sonner";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";

interface ExtendedCashEntry extends CashEntry {
  linkType?: string;
  linkId?: string;
  invoiceNumber?: string;
}

interface CashJournalProps {
  onJournalChange: (entries: ExtendedCashEntry[]) => void;
}

export default function CashJournal({ onJournalChange }: CashJournalProps) {
  const [entries, setEntries] = useState<ExtendedCashEntry[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("Tous");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadJournal = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data: rawEntries, error: entriesError } = await supabase
        .schema("nafaflow")
        .from("cash_entries")
        .select("*")
        .order("entry_date", { ascending: false });

      if (entriesError) throw entriesError;

      let mapped: ExtendedCashEntry[] = [];

      if (rawEntries && rawEntries.length > 0) {
        // Collect invoice IDs to join
        const invoiceIds = rawEntries
          .filter((item) => item.link_type === "invoice" && item.link_id)
          .map((item) => item.link_id as string);

        const invoiceNumberMap: Record<string, string> = {};

        if (invoiceIds.length > 0) {
          const { data: invoicesList, error: invoicesError } = await supabase
            .schema("nafaflow")
            .from("invoices")
            .select("id, number")
            .in("id", invoiceIds);

          if (!invoicesError && invoicesList) {
            invoicesList.forEach((inv) => {
              invoiceNumberMap[inv.id] = inv.number || "";
            });
          }
        }

        mapped = rawEntries.map((item) => ({
          id: item.id,
          date: item.entry_date,
          type: item.type as "in" | "out",
          amount: Math.round(Number(item.amount)),
          label: item.label || "",
          category: item.category || "",
          linkType: item.link_type || undefined,
          linkId: item.link_id || undefined,
          invoiceNumber: item.link_id ? invoiceNumberMap[item.link_id] : undefined,
        }));
      }

      setEntries(mapped);
      onJournalChange(mapped);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur lors du chargement de la trésorerie : ${message}`);
    } finally {
      setLoading(false);
    }
  }, [onJournalChange]);

  useEffect(() => {
    const fetchOrgAndLoad = async () => {
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
          if (userData?.org_id) {
            setOrgId(userData.org_id);
          }
        }
      } catch (err) {
        console.error("Error fetching user organization:", err);
      }
      loadJournal();
    };

    fetchOrgAndLoad();
  }, [loadJournal]);

  const handleSave = async (newEntryData: Omit<CashEntry, "id">) => {
    if (!orgId) {
      toast.error("Impossible de sauvegarder : organisation introuvable.");
      return;
    }

    try {
      const supabase = createBrowserClient();
      const entryId = crypto.randomUUID();

      const dbEntry = {
        id: entryId,
        org_id: orgId,
        entry_date: newEntryData.date,
        type: newEntryData.type,
        amount: newEntryData.amount,
        label: newEntryData.label,
        category: newEntryData.category,
      };

      const { error } = await supabase
        .schema("nafaflow")
        .from("cash_entries")
        .insert(dbEntry);

      if (error) throw error;

      toast.success("Opération de trésorerie enregistrée.");
      setIsFormOpen(false);
      loadJournal();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur d'enregistrement : ${message}`);
    }
  };

  const handleDelete = async (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (entry && entry.linkType === "invoice") {
      toast.error(
        `Cette écriture est liée à la facture ${entry.invoiceNumber || entry.linkId}. Veuillez la supprimer depuis les détails de la facture.`
      );
      return;
    }

    try {
      const supabase = createBrowserClient();
      const { error } = await supabase
        .schema("nafaflow")
        .from("cash_entries")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.error("Écriture de trésorerie supprimée.");
      loadJournal();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur de suppression : ${message}`);
    }
  };

  const filteredEntries = entries.filter((e) => {
    const matchesSearch = e.label.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase());
    
    let matchesType = true;
    if (typeFilter === "Encaissements") matchesType = e.type === "in";
    else if (typeFilter === "Décaissements") matchesType = e.type === "out";
    
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Search & Actions filters bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          {/* Search box */}
          <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:ring-1 focus-within:ring-[#16A34A] focus-within:border-[#16A34A] focus-within:bg-white transition-all w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Rechercher une opération..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-0 outline-0 text-sm ml-2 w-full placeholder-slate-400 text-slate-700 focus:outline-none"
            />
          </div>

          {/* Type tabs */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/50 self-start sm:self-auto overflow-x-auto">
            {["Tous", "Encaissements", "Décaissements"].map((filter) => (
              <button
                key={filter}
                onClick={() => setTypeFilter(filter)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  typeFilter === filter
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Add Entry trigger */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold h-9 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all self-end sm:self-auto shadow-md shadow-emerald-700/10">
              <Plus className="h-4 w-4" />
              <span>Saisir opération</span>
            </Button>
          </DialogTrigger>
          <CashEntryForm
            onSave={handleSave}
            onClose={() => setIsFormOpen(false)}
          />
        </Dialog>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 border-b border-slate-100">
            <TableRow className="text-slate-400 text-[10px] tracking-wider uppercase font-bold hover:bg-slate-50">
              <TableHead className="py-3 px-6">Date</TableHead>
              <TableHead className="py-3 px-6">Opération</TableHead>
              <TableHead className="py-3 px-6">Catégorie</TableHead>
              <TableHead className="py-3 px-6 text-right">Montant</TableHead>
              <TableHead className="py-3 px-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100 text-slate-700 text-sm">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={idx} className="animate-pulse">
                  <TableCell className="py-4 px-6"><div className="h-4 bg-slate-100 rounded w-20"></div></TableCell>
                  <TableCell className="py-4 px-6"><div className="h-4 bg-slate-100 rounded w-48"></div></TableCell>
                  <TableCell className="py-4 px-6"><div className="h-4 bg-slate-100 rounded w-24"></div></TableCell>
                  <TableCell className="py-4 px-6 text-right"><div className="h-4 bg-slate-100 rounded w-20 ml-auto"></div></TableCell>
                  <TableCell className="py-4 px-6"></TableCell>
                </TableRow>
              ))
            ) : filteredEntries.length > 0 ? (
              filteredEntries.map((e) => {
                const isIn = e.type === "in";
                const isLinked = e.linkType === "invoice";
                return (
                  <TableRow key={e.id} className="hover:bg-slate-50/50 transition-colors group">
                    <TableCell className="py-3.5 px-6">
                      <DateDisplay date={e.date} />
                    </TableCell>
                    <TableCell className="py-3.5 px-6 font-semibold text-slate-800 flex items-center gap-2">
                      <span className={`p-1 rounded-lg shrink-0 ${
                        isIn ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      }`}>
                        {isIn ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      </span>
                      <div className="flex flex-col">
                        <span>{e.label}</span>
                        {isLinked && (
                          <Link
                            href={`/factures/${e.linkId}`}
                            className="text-[10px] text-slate-400 hover:text-emerald-600 font-semibold flex items-center gap-0.5 mt-0.5"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            Voir la facture {e.invoiceNumber || e.linkId}
                          </Link>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 px-6">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                        {e.category}
                      </span>
                    </TableCell>
                    <TableCell className={`py-3.5 px-6 text-right font-bold tabular-nums ${
                      isIn ? "text-emerald-600" : "text-rose-600"
                    }`}>
                      {isIn ? "+" : "-"} <AmountFCFA amount={e.amount} className={isIn ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"} />
                    </TableCell>
                    <TableCell className="py-3.5 px-6 text-right">
                      {isLinked ? (
                        <span className="text-[10px] text-slate-400 italic px-2 py-1 bg-slate-50 border border-slate-100 rounded-md">
                          Lié à facture
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(e.id!)}
                          className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                  Aucune transaction enregistrée.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
