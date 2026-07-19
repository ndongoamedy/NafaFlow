/**
 * Accorde un accès NafaFlow à un compte SANS passer par le paiement Paytech.
 * Réservé à l'administrateur (utilise la clé service Supabase).
 *
 * Usage :
 *   node scripts/grant-access.js <email|nom d'organisation> [plan] [mois]
 *
 * Exemples :
 *   node scripts/grant-access.js ndongoamedy@gmail.com                 # business, 12 mois
 *   node scripts/grant-access.js "Sen Tech Store" pro 6                # pro, 6 mois
 *   node scripts/grant-access.js contact@client.sn business 24         # business, 24 mois
 *
 * Pour RETIRER l'accès (repasser en essai/bloqué), utilisez :
 *   node scripts/grant-access.js <email|nom> revoke
 */

const fs = require("fs");
const path = require("path");

// Charge .env.local
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) {
      let v = m[2] || "";
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      process.env[m[1]] = v.trim();
    }
  });
}

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function resolveOrg(identifier) {
  // 1) Par email : on retrouve l'utilisateur auth, puis son org_id
  if (identifier.includes("@")) {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    const user = (data?.users || []).find(
      (u) => (u.email || "").toLowerCase() === identifier.toLowerCase()
    );
    if (!user) throw new Error(`Aucun utilisateur avec l'email ${identifier}.`);
    const { data: profile } = await supabase
      .schema("nafaflow").from("users").select("org_id").eq("id", user.id).maybeSingle();
    if (!profile?.org_id) throw new Error(`Utilisateur ${identifier} sans organisation.`);
    return profile.org_id;
  }
  // 2) Par nom d'organisation (insensible à la casse)
  const { data: orgs, error } = await supabase
    .schema("nafaflow").from("orgs").select("id, name").ilike("name", identifier);
  if (error) throw error;
  if (!orgs || orgs.length === 0) throw new Error(`Aucune organisation nommée « ${identifier} ».`);
  if (orgs.length > 1) throw new Error(`Plusieurs organisations « ${identifier} » — précisez par email.`);
  return orgs[0].id;
}

async function main() {
  const identifier = process.argv[2];
  const arg3 = (process.argv[3] || "business").toLowerCase();
  const months = parseInt(process.argv[4] || "12", 10);

  if (!identifier) {
    console.error("Usage : node scripts/grant-access.js <email|nom d'organisation> [plan|revoke] [mois]");
    process.exit(1);
  }

  const orgId = await resolveOrg(identifier);

  if (arg3 === "revoke") {
    // Repasse en 'canceled' : l'accès sera bloqué (si l'essai est aussi terminé).
    const { error } = await supabase
      .schema("nafaflow").from("subscriptions")
      .upsert({ org_id: orgId, plan: "trial", status: "canceled", current_period_end: null }, { onConflict: "org_id" });
    if (error) throw error;
    console.log(`Accès révoqué pour l'organisation ${orgId} (repasse en bloqué hors essai).`);
    return;
  }

  const plan = arg3 === "pro" ? "pro" : "business";
  const end = new Date();
  end.setMonth(end.getMonth() + (isNaN(months) ? 12 : months));

  const { error } = await supabase
    .schema("nafaflow").from("subscriptions")
    .upsert(
      {
        org_id: orgId,
        plan,
        status: "active",
        current_period_end: end.toISOString(),
      },
      { onConflict: "org_id" }
    );
  if (error) throw error;

  console.log(
    `✅ Accès accordé : organisation ${orgId} → plan ${plan}, actif jusqu'au ${end.toLocaleDateString("fr-FR")}.`
  );
}

main().catch((e) => {
  console.error("Erreur :", e.message || e);
  process.exit(1);
});
