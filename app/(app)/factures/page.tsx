import { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import FactureList from "@/components/factures/FactureList";

export const metadata: Metadata = {
  title: "Factures clients | NafaFlow",
  description: "Suivi des factures clients, relances de retard et journalisation des règlements",
};

export default function FacturesListPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Factures clients</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Gérez vos encaissements, suivez le statut de vos factures et relancez les factures en retard
          </p>
        </div>
        <Button
          asChild
          className="bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold h-9 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-700/10 self-end sm:self-auto"
        >
          <Link href="/factures/nouveau">
            <Plus className="h-4 w-4" />
            <span>Nouvelle facture</span>
          </Link>
        </Button>
      </div>

      {/* Invoice list table components */}
      <FactureList />
    </div>
  );
}
