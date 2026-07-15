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
  console.log("Testing system catalog access...");
  
  const { data: d1, error: e1 } = await supabase.from('pg_trigger').select('*').limit(1);
  if (e1) {
    console.log("pg_trigger failed:", e1.message);
  } else {
    console.log("pg_trigger success:", d1);
  }

  const { data: d2, error: e2 } = await supabase.from('columns').select('*').limit(1);
  if (e2) {
    console.log("columns failed:", e2.message);
  } else {
    console.log("columns success:", d2);
  }
}

main();
