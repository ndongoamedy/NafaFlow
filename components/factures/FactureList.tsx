"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, Eye, Trash2 } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import AmountFCFA from "@/components/shared/AmountFCFA";
import DateDisplay from "@/components/shared/DateDisplay";
import ConfirmDeleteModal from "@/components/shared/ConfirmDeleteModal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

interface SimpleInvoiceItem {
  id: string;
  invoiceRef: string;
  clientName: string;
  clientId: string;
  issueDate: string;
  dueDate: string;
  total: number;
  status: string;
}

export default function FactureList() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<SimpleInvoiceItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Delete Candidate State
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; ref: string } | null>(null);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .schema("nafaflow")
        .from("invoices")
        .select("*, clients(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const mapped: SimpleInvoiceItem[] = data.map((item) => {
          const year = new Date(item.created_at).getFullYear();
          const shortId = item.id.split("-")[0]?.slice(0, 4).toUpperCase() || item.id.slice(0, 4).toUpperCase();
          const invoiceRef = item.number || `NF-${year}-${shortId}`;
          
          let mappedStatus = item.status || "draft";
          // Map standard db statuses to localized French statuses for the filter & badge
          if (mappedStatus === "draft") mappedStatus = "brouillon";
          else if (mappedStatus === "sent") mappedStatus = "envoyée";
          else if (mappedStatus === "paid") mappedStatus = "payée";
          else if (mappedStatus === "partial") mappedStatus = "partiellement payée";
          else if (mappedStatus === "overdue") mappedStatus = "en retard";

          return {
            id: item.id, // Keep the real UUID for navigation
            invoiceRef,
            clientName: item.clients?.name || "Client Inconnu",
            clientId: item.client_id,
            issueDate: item.issue_date || item.created_at.slice(0, 10),
            dueDate: item.due_date || "",
            total: Math.round(Number(item.total)),
            status: mappedStatus,
          };
        });
        setInvoices(mapped);
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur lors du chargement des factures : ${message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
    window.addEventListener("local-state-change", loadInvoices);
    return () => window.removeEventListener("local-state-change", loadInvoices);
  }, []);

  const handleDeleteConfirm = async () => {
    if (deleteCandidate) {
      try {
        const supabase = createBrowserClient();

        // 1. Delete associated cash entries first
        const { error: cashErr } = await supabase
          .schema("nafaflow")
          .from("cash_entries")
          .delete()
          .eq("link_type", "invoice")
          .eq("link_id", deleteCandidate.id);

        if (cashErr) throw cashErr;

        // 2. Delete the invoice (lines and payments cascade delete in DB)
        const { error: invoiceErr } = await supabase
          .schema("nafaflow")
          .from("invoices")
          .delete()
          .eq("id", deleteCandidate.id);

        if (invoiceErr) throw invoiceErr;

        toast.error(`Facture ${deleteCandidate.ref} supprimée.`);
        loadInvoices();
      } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`Erreur lors de la suppression : ${message}`);
      } finally {
        setDeleteCandidate(null);
      }
    }
  };

  const filteredInvoices = invoices.filter((i) => {
    const matchesSearch =
      i.clientName.toLowerCase().includes(search.toLowerCase()) ||
      i.invoiceRef.toLowerCase().includes(search.toLowerCase()) ||
      i.id.toLowerCase().includes(search.toLowerCase());

    let matchesStatus = true;
    if (statusFilter !== "Tous") {
      if (statusFilter === "Payée") matchesStatus = i.status === "payée";
      else if (statusFilter === "Partiellement payée") matchesStatus = i.status === "partiellement payée";
      else if (statusFilter === "Envoyée") matchesStatus = i.status === "envoyée";
      else if (statusFilter === "Brouillon") matchesStatus = i.status === "brouillon";
      else if (statusFilter === "En retard") matchesStatus = i.status === "en retard";
    }
    return matchesSearch && matchesStatus;
  });

  const filters = ["Tous", "Brouillon", "Envoyée", "Partiellement payée", "Payée", "En retard"];

  return (
    <div className="space-y-6">
      {/* Search & Action Filters */}
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
      </div>

      {/* Invoices List Table */}
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
                Array.from({ length: 4 }).map((_, idx) => (
                  <TableRow key={idx} className="animate-pulse">
                    <TableCell className="py-4 px-6"><div className="h-4 bg-slate-100 rounded w-20"></div></TableCell>
                    <TableCell className="py-4 px-6"><div className="h-4 bg-slate-100 rounded w-36"></div></TableCell>
                    <TableCell className="py-4 px-6"><div className="h-4 bg-slate-100 rounded w-24"></div></TableCell>
                    <TableCell className="py-4 px-6 text-right"><div className="h-4 bg-slate-100 rounded w-20 ml-auto"></div></TableCell>
                    <TableCell className="py-4 px-6 text-center"><div className="h-6 bg-slate-100 rounded-full w-24 mx-auto"></div></TableCell>
                    <TableCell className="py-4 px-6"></TableCell>
                  </TableRow>
                ))
              ) : filteredInvoices.length > 0 ? (
                filteredInvoices.map((invoice) => (
                  <TableRow
                    key={invoice.id}
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/factures/${invoice.id}`)}
                  >
                    <TableCell className="py-3.5 px-6 font-semibold text-slate-800 tabular-nums">
                      {invoice.invoiceRef}
                    </TableCell>
                    <TableCell className="py-3.5 px-6 font-semibold text-slate-700">
                      {invoice.clientName}
                    </TableCell>
                    <TableCell className="py-3.5 px-6">
                      <DateDisplay date={invoice.issueDate} />
                    </TableCell>
                    <TableCell className="py-3.5 px-6 text-right font-bold text-slate-800">
                      <AmountFCFA amount={invoice.total} highlight />
                    </TableCell>
                    <TableCell className="py-3.5 px-6 text-center">
                      <StatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/factures/${invoice.id}`);
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
                            setDeleteCandidate({ id: invoice.id, ref: invoice.invoiceRef });
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
                  <TableCell colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                    Aucune facture trouvée.
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
        title="Supprimer la facture"
        message={`Êtes-vous sûr de vouloir supprimer la facture ${deleteCandidate?.ref || ""} ? Cette action est irréversible et annulera toutes les écritures de caisse associées.`}
      />
    </div>
  );
}
