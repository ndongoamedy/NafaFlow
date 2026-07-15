const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

// Use PUBLISHABLE (anon) key to simulate client-side behavior
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { db: { schema: "nafaflow" } }
);

async function main() {
  console.log("Logging in as test@nafaflow.com...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'test@nafaflow.com',
    password: 'password123'
  });

  if (authErr) {
    console.error("Auth login failed:", authErr.message);
    return;
  }

  const user = authData.user;
  console.log("Logged in successfully! User ID:", user.id);

  console.log("Querying users table...");
  const { data: userData, error: userErr } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (userErr) {
    console.error("Query users failed:", userErr.message, "| Code:", userErr.code, "| Details:", userErr.details);
  } else {
    console.log("Query users success! org_id:", userData.org_id);
  }

  console.log("Querying quotes table...");
  const { data: quotesData, error: quotesErr } = await supabase
    .from('quotes')
    .select('*')
    .limit(1);

  if (quotesErr) {
    console.error("Query quotes failed:", quotesErr.message);
  } else {
    console.log("Query quotes success! count:", quotesData.length);
  }
}

main();
