import { Metadata } from "next";
import ServiceList from "@/components/catalogue/ServiceList";

export const metadata: Metadata = {
  title: "Catalogue des Tarifs | NafaFlow",
  description: "Gestion du catalogue de services et grille de tarifs",
};

export default function CataloguePage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Catalogue des Services</h2>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          Définissez vos prestations types pour simplifier la création des devis
        </p>
      </div>

      {/* Main Service List Table */}
      <ServiceList />
    </div>
  );
}
