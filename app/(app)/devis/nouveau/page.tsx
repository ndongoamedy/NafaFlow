import { Metadata } from "next";
import DevisForm from "@/components/devis/DevisForm";

export const metadata: Metadata = {
  title: "Nouveau Devis | NafaFlow",
  description: "Rédigez un nouveau devis pour vos clients",
};

export default function NouveauDevisPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Nouveau devis commercial</h2>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          Générez une proposition financière avec calcul de TVA et import depuis le catalogue
        </p>
      </div>

      {/* Quote Creation Form */}
      <DevisForm />
    </div>
  );
}
