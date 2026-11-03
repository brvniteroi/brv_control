// Preenche o complemento dos endereços que vieram do Field Control sem ele. Lê o Field direto da API
// (SOMENTE LEITURA) e grava em customer_addresses.complement só onde o BRV Control está vazio:
// o que o escritório já preencheu ou mudou nunca é sobrescrito.
//
// Uso:  node --env-file=.env scripts/field-control/importar-complemento.mjs [--simular]
//   --simular  só confere e conta, sem gravar nada
// Precisa no .env: FIELD_CONTROL_API_KEY, VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (SÓ neste PC).
// Rápido: o complemento do endereço principal vem na listagem de clientes (1 requisição a cada 100);
// as localizações só são pedidas, uma a uma, para clientes que ainda têm endereço sem complemento.
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

const limpo = (s) => (typeof s === 'string' && s.trim() ? s.trim().replace(/[ \t]+/g, ' ') : null);
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
    if (res.status === 401) {
      console.error('401: a chave da API foi recusada (assinatura vencida?). Parando.');
      process.exit(2);
    }
    if (res.status === 404) return null;
    if (res.status === 429 || res.status >= 500) {
      if (tentativa >= 8) throw new Error(`${res.status} em ${caminho}`);
      await dormir(res.status === 429 ? 3000 : Math.min(60_000, 2000 * tentativa));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} em ${caminho}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
}

async function listarTudo(caminho, aoPaginar) {
  const itens = [];
  for (let offset = 0; ; offset += 100) {
    const p = await get(`${caminho}${caminho.includes('?') ? '&' : '?'}limit=100&offset=${offset}`);
    if (!p) break;
    itens.push(...p.items);
    aoPaginar?.(itens.length, p.totalCount);
    if (p.items.length < 100 || itens.length >= p.totalCount) break;
  }
  return itens;
}

/** Lê uma tabela inteira do Supabase (1000 por página). */
async function lerTabela(tabela, colunas, filtro) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    let q = sb.from(tabela).select(colunas).order('id').range(de, de + 999);
    if (filtro) q = filtro(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabela}: ${error.message}`);
    linhas.push(...data);
    if (data.length < 1000) return linhas;
  }
}

console.log(SIMULAR ? 'SIMULAÇÃO: nada será gravado.\n' : '');

// 1. Endereços do BRV Control que vieram do Field e estão sem complemento
const enderecos = await lerTabela('customer_addresses', 'id, customer_id, field_control_id, complement', (q) => q.not('field_control_id', 'is', null));
const vazios = enderecos.filter((e) => !limpo(e.complement));
console.log(`Endereços do Field no BRV Control: ${enderecos.length} (${vazios.length} sem complemento)`);
if (vazios.length === 0) process.exit(0);

// 2. Complemento do endereço principal, que vem na listagem de clientes
const clientesField = await listarTudo('/customers', (n, t) => process.stdout.write(`\rClientes no Field: ${n}/${t}   `));
console.log();
const complementoPorLocal = new Map(); // id da localização no Field -> complemento
for (const c of clientesField) {
  const comp = limpo(c.address?.complement);
  if (comp) complementoPorLocal.set(c.primaryLocation?.id ?? `${c.id}#endereco`, comp);
}

// 3. Os que sobraram (endereços que não são o principal): pede as localizações do cliente
const faltam = vazios.filter((e) => !complementoPorLocal.has(e.field_control_id));
const clientesDb = new Map((await lerTabela('customers', 'id, field_control_id', (q) => q.not('field_control_id', 'is', null))).map((c) => [c.id, c.field_control_id]));
const paraBuscar = [...new Set(faltam.map((e) => e.customer_id))].filter((id) => clientesDb.has(id));
// Cliente com um só endereço e sem complemento no listagem já está resolvido: o complemento não existe no Field
const clientesComVarios = new Set();
{
  const contagem = new Map();
  for (const e of enderecos) contagem.set(e.customer_id, (contagem.get(e.customer_id) ?? 0) + 1);
  for (const [id, n] of contagem) if (n > 1) clientesComVarios.add(id);
}
const buscar = paraBuscar.filter((id) => clientesComVarios.has(id));
console.log(`Clientes com mais de um endereço e algum sem complemento: ${buscar.length} (≈ ${Math.ceil((buscar.length * INTERVALO_MS) / 60000)} min)`);
let feito = 0;
for (const id of buscar) {
  const locais = await get(`/customers/${clientesDb.get(id)}/locations`);
  for (const l of locais?.items ?? []) {
    const comp = limpo(l.address?.complement);
    if (comp) complementoPorLocal.set(l.id, comp);
  }
  process.stdout.write(`\r  localizações: ${++feito}/${buscar.length}   `);
}
if (buscar.length) console.log();

// 4. Grava só onde estava vazio
const atualizar = vazios.flatMap((e) => {
  const comp = complementoPorLocal.get(e.field_control_id);
  return comp ? [{ id: e.id, complement: comp }] : [];
});
console.log(`\nComplementos a preencher: ${atualizar.length} de ${vazios.length} endereços vazios`);
console.log('Exemplos:', atualizar.slice(0, 5).map((a) => `"${a.complement}"`).join(', '));

if (SIMULAR) process.exit(0);
let gravados = 0;
for (let i = 0; i < atualizar.length; i += 20) {
  const resultados = await Promise.all(
    atualizar.slice(i, i + 20).map((a) => sb.from('customer_addresses').update({ complement: a.complement }).eq('id', a.id).is('complement', null)),
  );
  for (const { error } of resultados) if (error) throw new Error(`customer_addresses: ${error.message}`);
  gravados += resultados.length;
  process.stdout.write(`\r  gravados: ${gravados}/${atualizar.length}   `);
}
console.log('\nPronto.');
