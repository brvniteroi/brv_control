// Guarda as observações do cliente como estão no Field Control em customer_field_original
// (migration 20261103130000_cliente_original_field.sql), só para consulta do escritório.
// Lê o Field (SOMENTE LEITURA) e não altera customers.notes. Nunca sobrescreve o que já foi guardado.
//
// Uso:  node --env-file=.env scripts/field-control/guardar-observacoes-field.mjs [--simular]
import { createClient } from '@supabase/supabase-js';

const BASE = 'https://carchost.fieldcontrol.com.br';
const { FIELD_CONTROL_API_KEY: CHAVE, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const SIMULAR = process.argv.includes('--simular');
const INTERVALO_MS = 1100; // a API aceita 1 requisição por segundo

if (!CHAVE || !VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta FIELD_CONTROL_API_KEY, VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.');
  process.exit(1);
}
const sb = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

let ultima = 0;
async function get(caminho) {
  for (let tentativa = 1; ; tentativa++) {
    const espera = ultima + INTERVALO_MS - Date.now();
    if (espera > 0) await dormir(espera);
    ultima = Date.now();
    let res;
    try {
      res = await fetch(BASE + caminho, {
        headers: { 'X-Api-Key': CHAVE, 'Content-Type': 'application/json;charset=UTF-8', 'User-Agent': 'brv-control-importacao/1.0' },
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      if (tentativa >= 8) throw new Error(`rede em ${caminho}: ${e.message}`);
      await dormir(Math.min(60_000, 2000 * tentativa));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (tentativa >= 8) throw new Error(`${res.status} em ${caminho}`);
      await dormir(res.status === 429 ? 3000 : Math.min(60_000, 2000 * tentativa));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} em ${caminho}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
}

async function lerClientesDb() {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from('customers').select('id, field_control_id').not('field_control_id', 'is', null).order('id').range(de, de + 999);
    if (error) throw new Error(`customers: ${error.message}`);
    linhas.push(...data);
    if (data.length < 1000) return new Map(linhas.map((c) => [c.field_control_id, c.id]));
  }
}

console.log(SIMULAR ? 'SIMULAÇÃO: nada será gravado.\n' : '');
const clientesDb = await lerClientesDb();
const linhas = [];
let total = 0;
for (let offset = 0; ; offset += 100) {
  const p = await get(`/customers?limit=100&offset=${offset}`);
  for (const c of p.items) {
    const notes = typeof c.notes === 'string' ? c.notes.trim() : '';
    if (notes && clientesDb.has(c.id)) linhas.push({ customer_id: clientesDb.get(c.id), notes });
  }
  total += p.items.length;
  process.stdout.write(`\rClientes lidos no Field: ${total}/${p.totalCount}   `);
  if (p.items.length < 100 || total >= p.totalCount) break;
}
console.log(`\nClientes com observações: ${linhas.length}`);
console.log('Exemplo:', JSON.stringify(linhas[0]?.notes ?? null));
if (SIMULAR) process.exit(0);

for (let i = 0; i < linhas.length; i += 500) {
  const { error } = await sb.from('customer_field_original').upsert(linhas.slice(i, i + 500), { onConflict: 'customer_id', ignoreDuplicates: true });
  if (error) throw new Error(`customer_field_original: ${error.message}`);
  process.stdout.write(`\r  gravados: ${Math.min(i + 500, linhas.length)}/${linhas.length}   `);
}
console.log('\nPronto.');
