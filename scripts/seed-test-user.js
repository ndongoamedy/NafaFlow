const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually to get config
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecret = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecret) {
  console.error("Erreur : Les variables NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY doivent être définies dans .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecret, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log("Démarrage du script de provisionnement du compte de test...");
  
  try {
    // 1. Lister les utilisateurs auth pour vérifier si le compte de test existe
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error("Erreur lors de la récupération de la liste des utilisateurs :", listError);
      process.exit(1);
    }
    
    let testUser = users.find(u => u.email === 'test@nafaflow.com');
    
    if (!testUser) {
      console.log("Création de l'utilisateur test@nafaflow.com...");
      const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
        email: 'test@nafaflow.com',
        password: 'password123',
        email_confirm: true
      });
      
      if (createError) {
        console.error("Erreur de création de l'utilisateur :", createError);
        process.exit(1);
      }
      
      testUser = user;
      console.log("Utilisateur créé avec succès ! ID :", testUser.id);
      console.log("Le trigger de la base de données crée automatiquement l'organisation et le profil associé.");
    } else {
      console.log("L'utilisateur de test existe déjà. ID :", testUser.id);
    }
    
    console.log("Opération terminée avec succès !");
  } catch (error) {
    console.error("Erreur inattendue :", error);
    process.exit(1);
  }
}

main();
