import { Metadata } from "next";
import ClientList from "@/components/clients/ClientList";

export const metadata: Metadata = {
  title: "Gestion Clients | NafaFlow",
  description: "Répertoire clients, identifiants fiscaux NINEA/RC et historique des devis et facturations",
};

export default function ClientsListPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Répertoire Clients</h2>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          Suivez les fiches de vos clients, configurez leurs informations d&apos;émission et inspectez leur historique financier
        </p>
      </div>

      {/* Main Customer List Directory */}
      <ClientList />
    </div>
  );
}
