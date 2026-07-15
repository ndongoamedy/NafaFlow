"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock } from "lucide-react";
import { fetchSubscription, SubscriptionState } from "@/lib/utils/subscription";

// Contrôle l'accès à l'application selon l'état d'abonnement.
// Essai fini + pas d'abonnement actif → redirection vers /abonnement.
export default function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    fetchSubscription().then((s) => {
      if (!active) return;
      setState(s);
      setChecked(true);
      if (s?.blocked) {
        router.replace("/abonnement");
      }
    });
    return () => { active = false; };
  }, [router]);

  // Tant qu'on n'a pas statué, on évite d'afficher l'app à un compte bloqué.
  if (!checked) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-400 text-sm font-medium">
        Chargement de votre espace...
      </div>
    );
  }

  if (state?.blocked) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-400 text-sm font-medium">
        Redirection vers votre abonnement...
      </div>
    );
  }

  return (
    <>
      {/* Bandeau d'essai (affiché pendant la période d'essai) */}
      {state?.inTrial && (
        <Link
          href="/abonnement"
          className="flex items-center justify-center gap-2 bg-[#0F3E2B] text-white text-xs font-semibold py-2 px-4 hover:bg-[#124b32] transition-colors"
        >
          <Clock className="h-3.5 w-3.5 text-green-300" />
          <span>
            Essai gratuit — {state.trialDaysLeft} jour{state.trialDaysLeft > 1 ? "s" : ""} restant{state.trialDaysLeft > 1 ? "s" : ""}.
          </span>
          <span className="underline underline-offset-2">Choisir un abonnement</span>
        </Link>
      )}
      {children}
    </>
  );
}
