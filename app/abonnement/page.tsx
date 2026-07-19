"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Loader2, LogOut, ArrowLeft, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { createBrowserClient } from "@/lib/supabase/client";
import { fetchSubscription, SubscriptionState, PLANS } from "@/lib/utils/subscription";
import { errorMessage } from "@/lib/utils/orgProfile";

const PLAN_FEATURES: Record<string, string[]> = {
  pro: [
    "Clients illimités",
    "Devis & factures illimités",
    "Relances WhatsApp & email",
    "Tableau de bord trésorerie & P&L",
  ],
  business: [
    "Tout le plan Professionnel",
    "Multi-utilisateurs (jusqu'à 5)",
    "Accès comptable dédié",
    "Support prioritaire WhatsApp",
  ],
};

function AbonnementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingPlan, setPayingPlan] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Abonnement | NafaFlow";
    const paiement = searchParams.get("paiement");
    if (paiement === "succes") {
      toast.success("Paiement reçu. Votre abonnement sera activé dans un instant.");
    } else if (paiement === "annule") {
      toast.error("Paiement annulé.");
    }
    fetchSubscription().then((s) => {
      setState(s);
      setLoading(false);
      // Déjà abonné → on renvoie vers l'app
      if (s?.isActive) router.replace("/dashboard");
    });
  }, [router, searchParams]);

  const handleSubscribe = async (plan: string) => {
    setPayingPlan(plan);
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.redirectUrl) {
        throw new Error(payload?.error || "Impossible de démarrer le paiement.");
      }
      window.location.href = payload.redirectUrl;
    } catch (err: unknown) {
      console.error(err);
      toast.error(errorMessage(err));
      setPayingPlan(null);
    }
  };

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const blocked = state?.blocked;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-icon.png" alt="NafaFlow" className="h-7 w-7 object-contain" />
            </div>
            <span className="font-bold text-slate-800 tracking-tight">NafaFlow</span>
          </Link>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600">
            <LogOut className="h-4 w-4" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
        {/* Statut */}
        {loading ? (
          <div className="text-center text-slate-400 text-sm font-medium py-20">Chargement...</div>
        ) : (
          <>
            <div className="text-center max-w-xl mx-auto mb-8">
              {blocked ? (
                <>
                  <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full mb-4">
                    <Clock className="h-3.5 w-3.5" />
                    Période d&apos;essai terminée
                  </div>
                  <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Choisissez votre abonnement</h1>
                  <p className="text-sm text-slate-500 font-medium mt-2">
                    Pour continuer à utiliser NafaFlow et accéder à vos données, activez un plan.
                  </p>
                </>
              ) : (
                <>
                  {state?.inTrial && (
                    <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full mb-4">
                      <Clock className="h-3.5 w-3.5" />
                      Essai gratuit — {state.trialDaysLeft} jour{state.trialDaysLeft > 1 ? "s" : ""} restant{state.trialDaysLeft > 1 ? "s" : ""}
                    </div>
                  )}
                  <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Votre abonnement</h1>
                  <p className="text-sm text-slate-500 font-medium mt-2">
                    Passez à un plan payant à tout moment. Sans engagement, annulable quand vous voulez.
                  </p>
                </>
              )}
            </div>

            {/* Plans */}
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* Offre gratuite / essai */}
              <div className={`bg-white rounded-2xl border p-7 shadow-sm relative ${state?.inTrial ? "border-[#16A34A] shadow-emerald-700/5" : "border-slate-200"}`}>
                {state?.inTrial && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#16A34A] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                    Plan actuel
                  </span>
                )}
                <h3 className="text-lg font-bold text-slate-800">Gratuit</h3>
                <div className="flex items-baseline gap-1 mt-2 mb-5">
                  <span className="text-3xl font-extrabold text-slate-800 tracking-tight">0</span>
                  <span className="text-sm font-semibold text-slate-400">FCFA</span>
                </div>
                <ul className="space-y-2.5 mb-6">
                  {[
                    "Essai de 14 jours",
                    "Toutes les fonctionnalités",
                    "Accès complet pendant l'essai",
                    "Sans carte bancaire",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="w-full h-11 rounded-lg font-bold text-sm flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 text-slate-500">
                  {state?.inTrial
                    ? `Essai actif — ${state.trialDaysLeft} j restant${state.trialDaysLeft > 1 ? "s" : ""}`
                    : "Essai terminé"}
                </div>
              </div>

              {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((planId) => {
                const plan = PLANS[planId];
                const isBusiness = planId === "business";
                return (
                  <div
                    key={planId}
                    className={`bg-white rounded-2xl border p-7 shadow-sm relative ${
                      isBusiness ? "border-slate-200" : "border-[#16A34A] shadow-emerald-700/5"
                    }`}
                  >
                    {!isBusiness && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#16A34A] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                        Recommandé
                      </span>
                    )}
                    <h3 className="text-lg font-bold text-slate-800">{plan.label}</h3>
                    <div className="flex items-baseline gap-1 mt-2 mb-5">
                      <span className="text-3xl font-extrabold text-slate-800 tracking-tight">{plan.price.toLocaleString()}</span>
                      <span className="text-sm font-semibold text-slate-400">FCFA / mois</span>
                    </div>
                    <ul className="space-y-2.5 mb-6">
                      {PLAN_FEATURES[planId].map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                          <Check className="h-4 w-4 text-[#16A34A] shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      onClick={() => handleSubscribe(planId)}
                      disabled={payingPlan !== null}
                      className={`w-full h-11 rounded-lg font-bold text-sm flex items-center justify-center gap-2 ${
                        isBusiness
                          ? "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                          : "bg-[#16A34A] hover:bg-[#15803D] text-white"
                      }`}
                    >
                      {payingPlan === planId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      <span>{payingPlan === planId ? "Redirection..." : "S'abonner"}</span>
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Rassurance */}
            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium mt-8">
              <ShieldCheck className="h-4 w-4 text-slate-300" />
              Paiement sécurisé par Paytech — Carte bancaire, Orange Money, Wave, Free Money.
            </div>

            {!blocked && (
              <div className="text-center mt-6">
                <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Retour au tableau de bord
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function AbonnementPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Chargement...</div>}>
      <AbonnementContent />
    </Suspense>
  );
}
