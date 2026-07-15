"use client";

import { createBrowserClient } from "@/lib/supabase/client";

// Modèle d'abonnement NafaFlow.
// Essai gratuit de 14 jours à partir de la création de l'organisation.
// Après l'essai, l'accès est bloqué tant qu'aucun abonnement actif n'est payé.

export const TRIAL_DAYS = 14;

export const PLANS = {
  pro: { id: "pro", label: "Professionnel", price: 9000 },
  business: { id: "business", label: "Business", price: 15000 },
} as const;

export type PlanId = keyof typeof PLANS;

export interface SubscriptionState {
  orgId: string;
  plan: string;          // trial | pro | business
  status: string;        // trialing | active | past_due | canceled
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  // Valeurs dérivées
  isActive: boolean;     // abonnement payé et en cours
  inTrial: boolean;      // encore dans la période d'essai
  trialDaysLeft: number; // jours restants d'essai (0 si terminé)
  blocked: boolean;      // accès à bloquer (essai fini et pas d'abonnement actif)
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 3600 * 24));
}

export async function fetchSubscription(): Promise<SubscriptionState | null> {
  try {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: userData } = await supabase
      .schema("nafaflow")
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .single();
    if (!userData?.org_id) return null;
    const orgId = userData.org_id as string;

    const [{ data: org }, { data: sub }] = await Promise.all([
      supabase.schema("nafaflow").from("orgs").select("created_at").eq("id", orgId).single(),
      supabase.schema("nafaflow").from("subscriptions").select("*").eq("org_id", orgId).maybeSingle(),
    ]);

    const now = new Date();

    // Fin d'essai : soit la valeur stockée, soit created_at + 14 jours.
    let trialEndsAt: Date | null = null;
    if (sub?.trial_ends_at) {
      trialEndsAt = new Date(sub.trial_ends_at);
    } else if (org?.created_at) {
      trialEndsAt = new Date(new Date(org.created_at).getTime() + TRIAL_DAYS * 24 * 3600 * 1000);
    }

    const currentPeriodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
    const status = sub?.status || "trialing";
    const plan = sub?.plan || "trial";

    const isActive = status === "active" && !!currentPeriodEnd && currentPeriodEnd > now;
    const inTrial = !isActive && !!trialEndsAt && trialEndsAt > now;
    const trialDaysLeft = inTrial && trialEndsAt ? Math.max(0, daysBetween(now, trialEndsAt)) : 0;
    const blocked = !isActive && !inTrial;

    return {
      orgId,
      plan,
      status,
      trialEndsAt,
      currentPeriodEnd,
      isActive,
      inTrial,
      trialDaysLeft,
      blocked,
    };
  } catch (err) {
    console.error("fetchSubscription error:", err);
    return null;
  }
}
