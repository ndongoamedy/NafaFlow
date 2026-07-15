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
  process.env.SUPABASE_SECRET_KEY,
  { db: { schema: "nafaflow" } }
);

async function main() {
  const { data: clients, error: clientErr } = await supabase.from('clients').select('id, org_id').limit(1);
  const clientId = clients[0].id;
  const orgId = clients[0].org_id;

  const statuses = [
    'rejected',
    'cancelled',
    'canceled',
    'expired',
    'declined'
  ];

  for (const status of statuses) {
    const dummyQuote = {
      org_id: orgId,
      client_id: clientId,
      status: status,
      total: 100,
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
    
    const { data, error } = await supabase.from('quotes').insert(dummyQuote).select();
    if (error) {
      console.log(`Status [${status}]: FAILED. Code: ${error.code}, Message: ${error.message}`);
    } else {
      console.log(`Status [${status}]: SUCCESS! Created quote ID: ${data[0].id}`);
      await supabase.from('quotes').delete().eq('id', data[0].id);
    }
  }
}

main();
