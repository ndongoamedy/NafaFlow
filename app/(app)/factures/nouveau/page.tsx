"use client";

import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import FactureForm from "@/components/factures/FactureForm";

export default function NouvelleFacturePage() {
  useEffect(() => {
    document.title = "Nouvelle facture | NafaFlow";
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-lg border-slate-200 shrink-0"
        >
          <Link href="/factures">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Nouvelle facture</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Facturez directement, sans passer par un devis
          </p>
        </div>
      </div>

      <FactureForm />
    </div>
  );
}
