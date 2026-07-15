import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Inscription : crée le compte de connexion, l'organisation et le profil
// administrateur en une seule opération côté serveur (clé service requise).

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      db: { schema: "nafaflow" },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const companyName = (body?.companyName || "").trim();
  const fullName = (body?.fullName || "").trim();
  const email = (body?.email || "").trim().toLowerCase();
  const password = body?.password || "";

  if (!companyName || !fullName || !email || !password) {
    return NextResponse.json({ error: "Tous les champs sont requis." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Le mot de passe doit contenir au moins 8 caractères." },
      { status: 400 }
    );
  }

  const admin = adminClient();

  // 1. Compte de connexion
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authErr || !created?.user) {
    const msg = authErr?.message?.toLowerCase().includes("already")
      ? "Un compte existe déjà avec cette adresse email. Connectez-vous."
      : authErr?.message || "Impossible de créer le compte.";
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const userId = created.user.id;

  // 2. Organisation avec des valeurs par défaut sensées (modifiables dans Paramètres)
  const { data: org, error: orgErr } = await admin
    .from("orgs")
    .insert({
      name: companyName,
      currency: "FCFA",
      vat_enabled: true,
      vat_rate: 18,
      payment_terms_days: 30,
      cash_safety_months: 1,
      invoice_prefix: "NF",
      address: "",
      tax_id: "||||",
      logo_url: "",
    })
    .select()
    .single();

  if (orgErr || !org) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: orgErr?.message || "Impossible de créer l'organisation." },
      { status: 500 }
    );
  }

  // 3. Profil administrateur (upsert : un trigger peut déjà avoir créé la ligne)
  const { error: userErr } = await admin.from("users").upsert(
    {
      id: userId,
      org_id: org.id,
      full_name: fullName,
      email,
      role: "ADMIN",
    },
    { onConflict: "id" }
  );

  if (userErr) {
    await admin.from("orgs").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  // 4. Démarrage de l'essai gratuit de 14 jours
  const trialEnds = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
  await admin.from("subscriptions").upsert(
    {
      org_id: org.id,
      plan: "trial",
      status: "trialing",
      trial_ends_at: trialEnds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" }
  );

  return NextResponse.json({ ok: true });
}
