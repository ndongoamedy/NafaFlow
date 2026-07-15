"use client";

import { useState, useEffect } from "react";
import CashJournal from "@/components/tresorerie/CashJournal";
import CashFlowChart from "@/components/dashboard/CashFlowChart";
import AmountFCFA from "@/components/shared/AmountFCFA";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Wallet, Sparkles, Settings2 } from "lucide-react";
import Link from "next/link";
import { fetchOrgSettings, OrgSettings } from "@/lib/utils/orgProfile";

export default function TresoreriePage() {
  const [balance, setBalance] = useState(0);
  const [settings, setSettings] = useState<OrgSettings | null>(null);

  useEffect(() => {
    fetchOrgSettings().then(setSettings);
  }, []);

  const handleJournalChange = (entries: { type: string; amount: number }[]) => {
    const journalSum = entries.reduce((sum, entry) => {
      return sum + (entry.type === "in" ? entry.amount : -entry.amount);
    }, 0);
    setBalance(journalSum);
  };

  // Seuil d'alerte : charges mensuelles déclarées × mois de sécurité (Paramètres)
  const monthlyCharges = settings?.treasury?.monthlyCharges ?? 0;
  const safetyMonths = settings?.treasury?.cashSafetyMonths ?? 1;
  const safetyThreshold = monthlyCharges * safetyMonths;
  const chargesConfigured = monthlyCharges > 0;
  const isBelowSafetyLimit = chargesConfigured && balance < safetyThreshold;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Journal & Projection de Trésorerie</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            {"Gérez vos écritures de caisse et anticipez les creux de trésorerie sur 12 semaines"}
          </p>
        </div>
      </div>

      {/* Invitation à configurer les charges si rien n'est renseigné */}
      {settings && !chargesConfigured && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 p-4 rounded-xl text-xs text-blue-800 shadow-sm">
          <Settings2 className="h-5 w-5 text-blue-500 shrink-0" />
          <div className="flex-1">
            <span className="font-bold">{"Alerte de trésorerie inactive : "}</span>
            {"renseignez vos charges d'exploitation mensuelles pour être prévenu quand votre solde devient trop bas. "}
            <Link href="/parametres" className="font-bold underline underline-offset-2 hover:text-blue-900">
              Configurer dans Paramètres
            </Link>
          </div>
        </div>
      )}

      {/* Warning Alert banner if balance falls under safety threshold */}
      {isBelowSafetyLimit && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200/80 p-4 rounded-xl text-xs text-amber-800 shadow-sm">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <span className="font-bold">{"Alerte de trésorerie : "}</span>
            {`Votre solde disponible (${balance.toLocaleString()} F) est inférieur à votre seuil de sécurité de ${safetyThreshold.toLocaleString()} F `}
            {`(${monthlyCharges.toLocaleString()} F de charges × ${safetyMonths} mois — défini dans vos `}
            <Link href="/parametres" className="font-bold underline underline-offset-2 hover:text-amber-900">
              Paramètres
            </Link>
            {"). Pensez à relancer vos clients."}
          </div>
        </div>
      )}

      {/* Cash balance display card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="bg-gradient-to-br from-[#0F3E2B] to-[#15803D] border-0 text-white shadow-lg shadow-emerald-950/20 col-span-1 md:col-span-2 relative overflow-hidden group">
          <CardContent className="p-6 flex flex-col justify-between h-36">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-green-200/80">Solde de Trésorerie Courant</span>
              <Wallet className="h-5 w-5 text-green-300" />
            </div>
            <div>
              <h3 className="text-3xl font-extrabold tracking-tight tabular-nums text-white">
                <AmountFCFA amount={balance} className="text-white" />
              </h3>
              <p className="text-[10px] text-green-200/50 font-medium mt-1">
                {settings?.company?.name ? `Suivi de compte ${settings.company.name}` : "Suivi de compte"}
              </p>
            </div>

            {/* Decorative background visual blob */}
            <div className="absolute -right-6 -bottom-6 h-28 w-28 rounded-full bg-green-500/10 blur-xl group-hover:bg-green-500/20 transition-all duration-300" />
          </CardContent>
        </Card>

        {/* Safety buffer details */}
        <Card className="bg-white border-slate-100 shadow-sm col-span-1">
          <CardContent className="p-6 flex flex-col justify-between h-36">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wide">
              <span>Mois de Sécurité</span>
              <Sparkles className="h-4 w-4 text-[#16A34A]" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-800 tracking-tight">
                {chargesConfigured ? `${Math.max(0, balance / monthlyCharges).toFixed(1)} mois` : "—"}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                {chargesConfigured ? (
                  <>
                    {"Basé sur vos charges déclarées de "}
                    <span className="font-semibold text-slate-600"><AmountFCFA amount={monthlyCharges} /></span>
                    {" / mois — "}
                    <Link href="/parametres" className="underline underline-offset-2 font-semibold text-slate-500 hover:text-slate-700">
                      modifiable
                    </Link>
                    {"."}
                  </>
                ) : (
                  <>
                    {"Renseignez vos charges mensuelles dans les "}
                    <Link href="/parametres" className="underline underline-offset-2 font-semibold text-slate-500 hover:text-slate-700">
                      Paramètres
                    </Link>
                    {" pour activer ce calcul."}
                  </>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projection Chart Section */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Prévisions de Trésorerie</h3>
        <CashFlowChart />
      </div>

      {/* Journal entries section */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Journal des Écritures</h3>
        <CashJournal onJournalChange={handleJournalChange} />
      </div>
    </div>
  );
}
