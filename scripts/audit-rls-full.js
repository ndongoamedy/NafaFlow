const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m && !line.trim().startsWith('#')) process.env[m[1]] = (m[2] || '').trim();
});
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SVC = process.env.SUPABASE_SECRET_KEY;
const svc = createClient(URL, SVC, { db: { schema: 'nafaflow' }, auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(URL, ANON, { db: { schema: 'nafaflow' } });
const uid = () => crypto.randomUUID();

(async () => {
  const orgB = uid();
  const ids = {};
  await svc.from('orgs').insert({ id: orgB, name: 'ORG-B', currency: 'FCFA' });
  ids.clients = uid(); await svc.from('clients').insert({ id: ids.clients, org_id: orgB, name: 'C-B' });
  ids.services = uid(); await svc.from('services').insert({ id: ids.services, org_id: orgB, name: 'S-B', price: 1000 });
  ids.quotes = uid(); await svc.from('quotes').insert({ id: ids.quotes, org_id: orgB, client_id: ids.clients, status: 'draft', total: 1000 });
  ids.quote_lines = uid(); await svc.from('quote_lines').insert({ id: ids.quote_lines, quote_id: ids.quotes, description: 'QL-B', qty: 1, unit_price: 1000, total: 1000 });
  ids.invoices = uid(); await svc.from('invoices').insert({ id: ids.invoices, org_id: orgB, client_id: ids.clients, status: 'draft', total: 1000 });
  ids.invoice_lines = uid(); await svc.from('invoice_lines').insert({ id: ids.invoice_lines, invoice_id: ids.invoices, description: 'IL-B', qty: 1, unit_price: 1000, total: 1000 });
  ids.payments = uid(); await svc.from('payments').insert({ id: ids.payments, org_id: orgB, invoice_id: ids.invoices, amount: 1000, paid_at: '2026-07-01' });
  ids.cash_entries = uid(); await svc.from('cash_entries').insert({ id: ids.cash_entries, org_id: orgB, entry_date: '2026-07-01', type: 'in', amount: 1000, label: 'CE-B' });
  ids.fixed_costs = uid(); await svc.from('fixed_costs').insert({ id: ids.fixed_costs, org_id: orgB, label: 'FC-B', amount: 1000, periodicity: 'monthly', active: true });
  ids.subscriptions = orgB; await svc.from('subscriptions').insert({ org_id: orgB, plan: 'pro', status: 'active' });

  await anon.auth.signInWithPassword({ email: 'test@nafaflow.com', password: 'password123' });

  let leaks = 0;
  for (const [table, id] of Object.entries(ids)) {
    const col = table === 'subscriptions' ? 'org_id' : 'id';
    const { data } = await anon.from(table).select('*', { head: false }).eq(col, id);
    const visible = data && data.length > 0;
    if (visible) leaks++;
    console.log(table.padEnd(14), visible ? '❌ FUITE (A voit B)' : '✅ isolé');
  }

  // Nettoyage (ordre : enfants avant parents)
  await svc.from('subscriptions').delete().eq('org_id', orgB);
  await svc.from('payments').delete().eq('id', ids.payments);
  await svc.from('invoice_lines').delete().eq('id', ids.invoice_lines);
  await svc.from('invoices').delete().eq('id', ids.invoices);
  await svc.from('quote_lines').delete().eq('id', ids.quote_lines);
  await svc.from('quotes').delete().eq('id', ids.quotes);
  await svc.from('cash_entries').delete().eq('id', ids.cash_entries);
  await svc.from('fixed_costs').delete().eq('id', ids.fixed_costs);
  await svc.from('services').delete().eq('id', ids.services);
  await svc.from('clients').delete().eq('id', ids.clients);
  await svc.from('orgs').delete().eq('id', orgB);
  console.log('\nTotal fuites:', leaks, '| Nettoyage OK');
})();
