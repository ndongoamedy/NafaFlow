import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

// Gestion des membres d'équipe.
// La table nafaflow.users exige que chaque membre corresponde à un compte
// d'authentification Supabase (contrainte users_id_fkey). La création d'un
// compte auth nécessite la clé service : ces opérations passent donc par
// cette route serveur, jamais par le navigateur.

const ROLE_UI_TO_DB: Record<string, string> = {
  "Admin": "ADMIN",
  "Collaborateur": "EDITOR",
  "Lecture seule": "VIEWER",
};

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

// Vérifie que l'appelant est connecté et administrateur de son organisation.
async function getCallerAdmin() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié.", status: 401 as const };

  const { data: row } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!row?.org_id) return { error: "Profil utilisateur introuvable.", status: 403 as const };
  if (row.role !== "ADMIN") {
    return { error: "Seul un administrateur peut gérer l'équipe.", status: 403 as const };
  }
  return { callerId: user.id, orgId: row.org_id as string };
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  bytes.forEach((b) => {
    pwd += chars[b % chars.length];
  });
  return `Nafa-${pwd}`;
}

export async function POST(req: Request) {
  const caller = await getCallerAdmin();
  if ("error" in caller) return NextResponse.json({ error: caller.error }, { status: caller.status });

  const body = await req.json().catch(() => null);
  const name = (body?.name || "").trim();
  const email = (body?.email || "").trim().toLowerCase();
  const dbRole = ROLE_UI_TO_DB[body?.role as string];

  if (!name || !email || !dbRole) {
    return NextResponse.json({ error: "Nom, email et rôle valides requis." }, { status: 400 });
  }

  const admin = adminClient();
  const tempPassword = generateTempPassword();

  // 1. Créer le compte d'authentification
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (authErr || !created?.user) {
    const msg = authErr?.message?.includes("already")
      ? "Un compte existe déjà avec cette adresse email."
      : authErr?.message || "Impossible de créer le compte.";
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  // 2. Rattacher le membre à l'organisation.
  // Un trigger Supabase peut déjà avoir créé la ligne à la création du
  // compte auth : on utilise donc un upsert pour compléter/écraser proprement.
  const { error: insertErr } = await admin.from("users").upsert(
    {
      id: created.user.id,
      org_id: caller.orgId,
      full_name: name,
      email,
      role: dbRole,
    },
    { onConflict: "id" }
  );

  if (insertErr) {
    // Nettoyage : ne pas laisser un compte auth orphelin
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { error: insertErr.message || "Impossible d'ajouter le membre." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    member: { id: created.user.id, name, email, role: body.role },
    tempPassword,
  });
}

export async function PATCH(req: Request) {
  const caller = await getCallerAdmin();
  if ("error" in caller) return NextResponse.json({ error: caller.error }, { status: caller.status });

  const body = await req.json().catch(() => null);
  const id = body?.id as string;
  const name = (body?.name || "").trim();
  const email = (body?.email || "").trim().toLowerCase();
  const dbRole = ROLE_UI_TO_DB[body?.role as string];

  if (!id || !name || !email || !dbRole) {
    return NextResponse.json({ error: "Champs invalides." }, { status: 400 });
  }

  const admin = adminClient();

  const { data: target } = await admin.from("users").select("org_id, email").eq("id", id).single();
  if (!target || target.org_id !== caller.orgId) {
    return NextResponse.json({ error: "Membre introuvable dans votre organisation." }, { status: 404 });
  }

  if (target.email !== email) {
    const { error: authErr } = await admin.auth.admin.updateUserById(id, {
      email,
      email_confirm: true,
    });
    if (authErr) {
      return NextResponse.json(
        { error: `Impossible de modifier l'email : ${authErr.message}` },
        { status: 409 }
      );
    }
  }

  const { error: updErr } = await admin
    .from("users")
    .update({ full_name: name, email, role: dbRole })
    .eq("id", id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const caller = await getCallerAdmin();
  if ("error" in caller) return NextResponse.json({ error: caller.error }, { status: caller.status });

  const body = await req.json().catch(() => null);
  const id = body?.id as string;
  if (!id) return NextResponse.json({ error: "Identifiant requis." }, { status: 400 });
  if (id === caller.callerId) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte." }, { status: 400 });
  }

  const admin = adminClient();

  const { data: target } = await admin.from("users").select("org_id").eq("id", id).single();
  if (!target || target.org_id !== caller.orgId) {
    return NextResponse.json({ error: "Membre introuvable dans votre organisation." }, { status: 404 });
  }

  const { error: delErr } = await admin.from("users").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  // Supprimer aussi le compte auth (ignorer l'erreur s'il n'existe plus)
  await admin.auth.admin.deleteUser(id).catch(() => null);

  return NextResponse.json({ ok: true });
}
