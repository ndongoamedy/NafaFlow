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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function main() {
  const { data: users } = await supabase.schema('nafaflow').from('users').select('*').limit(1);
  if (users && users[0]) {
    console.log("Users keys:", Object.keys(users[0]));
    console.log("Users role type/value:", users[0].role);
  }
  const { data: orgs } = await supabase.schema('nafaflow').from('orgs').select('*').limit(1);
  if (orgs && orgs[0]) {
    console.log("Orgs keys:", Object.keys(orgs[0]));
    console.log("Orgs row values:", orgs[0]);
  }
}

main();
