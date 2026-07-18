"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Trash2, Search, ArrowRightLeft, Eye, Plus, FileCheck } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import AmountFCFA from "@/components/shared/AmountFCFA";
import DateDisplay from "@/components/shared/DateDisplay";
import ConvertToInvoicesModal from "./ConvertToInvoicesModal";
import ConfirmDeleteModal from "@/components/shared/ConfirmDeleteModal";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { DevisItem } from "@/lib/utils/state";

export default function DevisList() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<DevisItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [search, setSearch] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<DevisItem | null>(null);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [convertedQuoteIds, setConvertedQuoteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  
  // Delete candidate state
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; ref: string } | null>(null);

  const loadQuotes = async () => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .schema("nafaflow")
        .from("quotes")
        .select("*, clients(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Devis déjà convertis en factures (pour empêcher une double facturation)
      const { data: invoicesData } = await supabase
        .schema("nafaflow")
        .from("invoices")
        .select("quote_id")
        .not("quote_id", "is", null);
      setConvertedQuoteIds(new Set((invoicesData || []).map((i) => i.quote_id as string)));

      if (data) {
        const mapped: DevisItem[] = data.map((q) => {
          const item = q as { id: string; client_id: string; created_at: string; valid_until?: string | null; total: number; status?: string | null; clients?: { name: string } | null };
          
          let mappedStatus = item.status || "brouillon";
          if (mappedStatus === "draft") mappedStatus = "brouillon";
          else if (mappedStatus === "sent") mappedStatus = "envoyée";
          else if (mappedStatus === "rejected") mappedStatus = "refusé";

          return {
            id: item.id,
            clientName: item.clients?.name || "Client Inconnu",
            clientId: item.client_id,
            issueDate: item.created_at ? item.created_at.slice(0, 10) : "",
            validityDays: item.valid_until ? Math.ceil((new Date(item.valid_until).getTime() - new Date(item.created_at).getTime()) / (1000 * 3600 * 24)) : 15,
            total: Math.round(Number(item.total)),
            status: mappedStatus,
            lines: [],
          };
        });
        setQuotes(mapped);
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur lors du chargement des devis: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotes();
    window.addEventListener("local-state-change", loadQuotes);
    return () => window.removeEventListener("local-state-change", loadQuotes);
  }, []);

  const handleDeleteConfirm = async () => {
    if (deleteCandidate) {
      try {
        const supabase = createBrowserClient();
        const { error } = await supabase
          .schema("nafaflow")
          .from("quotes")
          .delete()
          .eq("id", deleteCandidate.id);
        
        if (error) throw error;

        toast.error(`Devis ${deleteCandidate.ref} supprimé.`);
        loadQuotes();
      } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`Erreur lors de la suppression : ${message}`);
      } finally {
        setDeleteCandidate(null);
      }
    }
  };

  const handleConvertSuccess = () => {
    router.push("/factures");
  };

  const filteredQuotes = quotes.filter((q) => {
    const quoteRef = `D-${new Date(q.issueDate).getFullYear()}-${q.id.split("-")[0]?.slice(0, 4).toUpperCase()}`;
    const matchesSearch =
      q.clientName.toLowerCase().includes(search.toLowerCase()) ||
      quoteRef.toLowerCase().includes(search.toLowerCase()) ||
      q.id.toLowerCase().includes(search.toLowerCase());

    let matchesStatus = true;
    if (statusFilter !== "Tous") {
      if (statusFilter === "Brouillon") matchesStatus = q.status === "brouillon";
      else if (statusFilter === "Envoyé") matchesStatus = q.status === "envoyée";
      else if (statusFilter === "Accepté") matchesStatus = q.status === "accepted";
      else if (statusFilter === "Refusé") matchesStatus = q.status === "refusé";
    }
    return matchesSearch && matchesStatus;
  });

  const filters = ["Tous", "Brouillon", "Envoyé", "Accepté", "Refusé"];

  return (
    <div className="space-y-6">
      {/* Search & Action Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          {/* Search bar */}
          <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:ring-1 focus-within:ring-[#16A34A] focus-within:border-[#16A34A] focus-within:bg-white transition-all w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Rechercher par client ou ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-0 outline-0 text-sm ml-2 w-full placeholder-slate-400 text-slate-700 focus:outline-none"
            />
          </div>

          {/* Status filter tabs */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/50 self-start sm:self-auto overflow-x-auto">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  statusFilter === filter
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Add Quote Trigger */}
        <Button
          asChild
          className="bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold h-9 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all self-end md:self-auto shadow-md shadow-emerald-700/10"
        >
          <Link href="/devis/nouveau">
            <Plus className="h-4 w-4" />
            <span>Nouveau devis</span>
          </Link>
        </Button>
      </div>

      {/* Table grid */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-100">
              <TableRow className="text-slate-400 text-[10px] tracking-wider uppercase font-bold hover:bg-slate-50">
                <TableHead className="py-3 px-6">Référence</TableHead>
                <TableHead className="py-3 px-6">Client</TableHead>
                <TableHead className="py-3 px-6">Date d&apos;émission</TableHead>
                <TableHead className="py-3 px-6 text-right">Montant TTC</TableHead>
                <TableHead className="py-3 px-6 text-center">Statut</TableHead>
                <TableHead className="py-3 px-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 text-slate-700 text-sm">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell className="py-4 px-6"><div className="h-4 bg-slate-100 rounded w-24"></div></TableCell>
                    <TableCell className="py-4 px-6"><div className="h-4 bg-slate-100 rounded w-32"></div></TableCell>
                    <TableCell className="py-4 px-6"><div className="h-4 bg-slate-100 rounded w-20"></div></TableCell>
                    <TableCell className="py-4 px-6 text-right"><div className="h-4 bg-slate-100 rounded w-24 ml-auto"></div></TableCell>
                    <TableCell className="py-4 px-6 text-center"><div className="h-6 bg-slate-100 rounded-full w-16 mx-auto"></div></TableCell>
                    <TableCell className="py-4 px-6"></TableCell>
                  </TableRow>
                ))
              ) : filteredQuotes.length > 0 ? (
                filteredQuotes.map((quote) => {
                  const quoteRef = `D-${new Date(quote.issueDate).getFullYear()}-${quote.id.split("-")[0]?.slice(0, 4).toUpperCase()}`;
                  return (
                    <TableRow
                      key={quote.id}
                      className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                      onClick={() => router.push(`/devis/${quote.id}`)}
                    >
                      <TableCell className="py-3.5 px-6 font-semibold text-slate-800 tabular-nums">
                        {quoteRef}
                      </TableCell>
                      <TableCell className="py-3.5 px-6 font-semibold text-slate-700">
                        {quote.clientName}
                      </TableCell>
                      <TableCell className="py-3.5 px-6">
                        <DateDisplay date={quote.issueDate} />
                      </TableCell>
                      <TableCell className="py-3.5 px-6 text-right font-bold text-slate-800">
                        <AmountFCFA amount={quote.total} highlight />
                      </TableCell>
                      <TableCell className="py-3.5 px-6 text-center">
                        <StatusBadge status={quote.status} />
                      </TableCell>
                      <TableCell className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Déjà facturé : lien vers les factures */}
                          {convertedQuoteIds.has(quote.id) ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push("/factures");
                              }}
                              className="text-emerald-700 bg-emerald-50 border border-emerald-200/50 font-bold h-7 rounded-lg text-xs flex items-center gap-1 px-2.5 shrink-0 hover:bg-emerald-100/80"
                              title="Ce devis a déjà été facturé"
                            >
                              <FileCheck className="h-3.5 w-3.5" />
                              <span>Facturé</span>
                            </button>
                          ) : quote.status === "accepted" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedQuote(quote);
                                setIsConvertOpen(true);
                              }}
                              className="bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 font-bold border-emerald-200/50 h-7 rounded-lg text-xs flex items-center gap-1 active:scale-95 transition-all shrink-0"
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                              <span>Facturer</span>
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/devis/${quote.id}`);
                            }}
                            className="h-8 w-8 text-slate-400 hover:text-[#16A34A] hover:bg-slate-100 rounded-lg shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteCandidate({ id: quote.id, ref: quoteRef });
                            }}
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0 animate-fade-in"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                    Aucun devis trouvé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Convert Quote to Milestone Invoices Dialog */}
      <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
        {selectedQuote && (
          <ConvertToInvoicesModal
            quoteId={selectedQuote.id}
            quoteTotal={selectedQuote.total}
            onClose={() => {
              setIsConvertOpen(false);
              setSelectedQuote(null);
            }}
            onSuccess={handleConvertSuccess}
          />
        )}
      </Dialog>

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={deleteCandidate !== null}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={handleDeleteConfirm}
        title="Supprimer le devis"
        message={`Êtes-vous sûr de vouloir supprimer le devis ${deleteCandidate?.ref || ""} ? Cette action est irréversible.`}
      />
    </div>
  );
}
