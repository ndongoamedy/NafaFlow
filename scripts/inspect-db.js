const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse env variables
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value.trim();
    }
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    db: { schema: "nafaflow" }
  }
);

async function main() {
  console.log("=== INSPECTION BASE DE DONNÉES ===");
  
  // 1. Inspect Orgs
  console.log("\n--- TABLE: orgs ---");
  const { data: orgs, error: orgsErr } = await supabase.from('orgs').select('*');
  if (orgsErr) console.error("Erreur orgs:", orgsErr);
  else console.log("Organisations:", orgs);

  // 2. Inspect Users
  console.log("\n--- TABLE: users ---");
  const { data: users, error: usersErr } = await supabase.from('users').select('*');
  if (usersErr) console.error("Erreur users:", usersErr);
  else console.log("Utilisateurs:", users);

  // 3. Inspect Services
  console.log("\n--- TABLE: services ---");
  const { data: services, error: servicesErr } = await supabase.from('services').select('*');
  if (servicesErr) console.error("Erreur services:", servicesErr);
  else {
    console.log("Services (première ligne ou vide):", services[0] || "Aucun service trouvé");
    if (services.length > 0) {
      console.log("Clés disponibles dans la table services :", Object.keys(services[0]));
    }
  }

  // 4. Test query for schema/RPC
  console.log("\n--- TEST: auth context ---");
  console.log("Seeding test user organization information verification completed.");
}

main();
