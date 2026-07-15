import { Metadata } from "next";
import DevisDetail from "@/components/devis/DevisDetail";

interface DevisDetailPageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: DevisDetailPageProps): Promise<Metadata> {
  return {
    title: `Devis ${params.id} | NafaFlow`,
    description: `Détail du devis ${params.id}`,
  };
}

export default function DevisDetailPage({ params }: DevisDetailPageProps) {
  return <DevisDetail quoteId={params.id} />;
}
