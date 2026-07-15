const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '../.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m && !line.trim().startsWith('#')) process.env[m[1]] = (m[2] || '').trim();
});

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SVC = process.env.SUPABASE_SECRET_KEY;

const svc = createClient(URL, SVC, { db: { schema: 'nafaflow' }, auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(URL, ANON, { db: { schema: 'nafaflow' } });

const tables = ['orgs', 'users', 'clients', 'services', 'quotes', 'quote_lines', 'invoices', 'invoice_lines', 'payments', 'cash_entries', 'fixed_costs', 'reminders', 'subscriptions', 'kpi_snapshots'];

(async () => {
  const { data: auth, error: aerr } = await anon.auth.signInWithPassword({ email: 'test@nafaflow.com', password: 'password123' });
  if (aerr) { console.log('login err', aerr.message); return; }
  const myOrg = (await anon.from('users').select('org_id').eq('id', auth.user.id).single()).data.org_id;
  console.log('Utilisateur connecté, org =', myOrg, '\n');
  console.log('TABLE'.padEnd(14), 'TOTAL(svc)'.padEnd(11), 'VU(user)'.padEnd(9), 'VERDICT');
  let leaks = 0;
  for (const t of tables) {
    const { count: total } = await svc.from(t).select('*', { count: 'exact', head: true });
    const { count: seen, error } = await anon.from(t).select('*', { count: 'exact', head: true });
    let verdict;
    if (error) verdict = 'ERREUR: ' + error.message.slice(0, 40);
    else if ((total || 0) === 0) verdict = '(vide)';
    else if (seen === total && total > 0) { verdict = 'FUITE: voit tout'; leaks++; }
    else verdict = 'OK filtre ' + seen + '/' + total;
    console.log(t.padEnd(14), String(total).padEnd(11), String(seen).padEnd(9), verdict);
  }
  console.log('\nFuites potentielles:', leaks);
})();
