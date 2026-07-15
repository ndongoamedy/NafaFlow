import { Metadata } from "next";
import FactureDetail from "@/components/factures/FactureDetail";

interface FactureDetailPageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: FactureDetailPageProps): Promise<Metadata> {
  return {
    title: `Facture ${params.id} | NafaFlow`,
    description: `Détail de la facture ${params.id}`,
  };
}

export default function FactureDetailPage({ params }: FactureDetailPageProps) {
  return <FactureDetail invoiceId={params.id} />;
}
