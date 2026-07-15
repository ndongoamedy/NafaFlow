import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

// Initie un paiement d'abonnement via Paytech.
// Documentation : https://doc.paytech.sn — endpoint request-payment.

const PLAN_PRICES: Record<string, { label: string; price: number }> = {
  pro: { label: "NafaFlow Professionnel", price: 9000 },
  business: { label: "NafaFlow Business", price: 15000 },
};

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function POST(req: Request) {
  // 1. Authentifier l'appelant et récupérer son organisation
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data: userRow } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!userRow?.org_id) return NextResponse.json({ error: "Organisation introuvable." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const plan = body?.plan as string;
  const chosen = PLAN_PRICES[plan];
  if (!chosen) return NextResponse.json({ error: "Plan invalide." }, { status: 400 });

  const apiKey = process.env.PAYTECH_API_KEY;
  const apiSecret = process.env.PAYTECH_API_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "Paytech n'est pas configuré côté serveur." }, { status: 500 });
  }

  // Référence de commande unique (org + plan + horodatage)
  const refCommand = `sub_${userRow.org_id}_${plan}_${Date.now()}`;
  const base = appUrl();
  // Paytech exige un ipn_url en https (schéma vérifié). En prod, NEXT_PUBLIC_APP_URL
  // doit pointer vers le domaine https pour que le webhook soit réellement reçu.
  const httpsBase = base.replace(/^http:\/\//, "https://");

  const payload = {
    item_name: chosen.label,
    item_price: String(chosen.price),
    currency: "xof",
    ref_command: refCommand,
    command_name: `Abonnement ${chosen.label}`,
    env: process.env.PAYTECH_ENV || "test",
    ipn_url: `${httpsBase}/api/subscription/ipn`,
    success_url: `${base}/abonnement?paiement=succes`,
    cancel_url: `${base}/abonnement?paiement=annule`,
    custom_field: JSON.stringify({ org_id: userRow.org_id, plan }),
  };

  try {
    // Paytech attend des paramètres form-urlencoded (pas du JSON).
    const form = new URLSearchParams();
    Object.entries(payload).forEach(([k, v]) => form.append(k, String(v)));

    const res = await fetch("https://paytech.sn/api/payment/request-payment", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        API_KEY: apiKey,
        API_SECRET: apiSecret,
      },
      body: form.toString(),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.success !== 1) {
      const msg = data?.errors?.[0] || data?.message || "La demande de paiement a échoué.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    // Mémoriser la référence en attente sur l'abonnement
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { db: { schema: "nafaflow" }, auth: { autoRefreshToken: false, persistSession: false } }
    );
    await admin.from("subscriptions").upsert(
      { org_id: userRow.org_id, paytech_ref: refCommand, updated_at: new Date().toISOString() },
      { onConflict: "org_id" }
    );

    const redirectUrl = data.redirect_url || (data.token ? `https://paytech.sn/payment/checkout/${data.token}` : null);
    if (!redirectUrl) return NextResponse.json({ error: "URL de paiement manquante." }, { status: 502 });

    return NextResponse.json({ redirectUrl });
  } catch (err: unknown) {
    console.error("Paytech checkout error:", err);
    return NextResponse.json({ error: "Impossible de contacter Paytech." }, { status: 502 });
  }
}
