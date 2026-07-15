import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Webhook IPN Paytech : reçoit la confirmation de paiement.
// Paytech envoie api_key_sha256 / api_secret_sha256 pour vérifier l'authenticité.
// ATTENTION : ne fonctionne qu'avec une URL publique (donc après déploiement Vercel).

function sha256(v: string) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

export async function POST(req: Request) {
  const apiKey = process.env.PAYTECH_API_KEY;
  const apiSecret = process.env.PAYTECH_API_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "Paytech non configuré." }, { status: 500 });
  }

  // Paytech envoie du form-urlencoded
  let params: Record<string, string> = {};
  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      params = await req.json();
    } else {
      const form = await req.formData();
      form.forEach((v, k) => { params[k] = String(v); });
    }
  } catch {
    return NextResponse.json({ error: "Corps illisible." }, { status: 400 });
  }

  // 1. Vérification d'authenticité
  const okKey = params.api_key_sha256 === sha256(apiKey);
  const okSecret = params.api_secret_sha256 === sha256(apiSecret);
  if (!okKey || !okSecret) {
    return NextResponse.json({ error: "Signature invalide." }, { status: 403 });
  }

  // 2. On ne traite que les ventes confirmées
  if (params.type_event && params.type_event !== "sale_complete") {
    return NextResponse.json({ ok: true, ignored: params.type_event });
  }

  // 3. Retrouver l'organisation et le plan (custom_field ou ref_command)
  let orgId = "";
  let plan = "pro";
  try {
    if (params.custom_field) {
      const cf = JSON.parse(params.custom_field);
      orgId = cf.org_id || "";
      plan = cf.plan || "pro";
    }
  } catch { /* ignore */ }
  if (!orgId && params.ref_command) {
    const m = params.ref_command.match(/^sub_([0-9a-f-]+)_(pro|business)_/i);
    if (m) { orgId = m[1]; plan = m[2]; }
  }
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable." }, { status: 400 });

  // 4. Activer l'abonnement pour un mois
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { db: { schema: "nafaflow" }, auth: { autoRefreshToken: false, persistSession: false } }
  );

  const periodEnd = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  const { error } = await admin.from("subscriptions").upsert(
    {
      org_id: orgId,
      plan,
      status: "active",
      current_period_end: periodEnd,
      paytech_ref: params.ref_command || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" }
  );

  if (error) {
    console.error("IPN update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
