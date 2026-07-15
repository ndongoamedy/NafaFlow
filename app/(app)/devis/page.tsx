import { Metadata } from "next";
import DevisList from "@/components/devis/DevisList";

export const metadata: Metadata = {
  title: "Devis & propositions | NafaFlow",
  description: "Suivez vos propositions commerciales et convertissez-les en factures de jalon",
};

export default function DevisListPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Propositions & Devis</h2>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          Suivez vos offres de services et facturez vos clients selon des jalons personnalisés
        </p>
      </div>

      {/* Main quotes list table */}
      <DevisList />
    </div>
  );
}
