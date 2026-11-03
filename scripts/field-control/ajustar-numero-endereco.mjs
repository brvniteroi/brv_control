// Passa o número da casa do complemento para o campo Número nos endereços do Field Control em que o
// número veio vazio e o complemento é só "casa N" ou só o número ("125").
// Antes de mexer, guarda o endereço como veio do Field em customer_address_field_original
// (migration 20261103120000_endereco_original_field.sql), visível só para o escritório.
//
// Uso:  node --env-file=.env scripts/field-control/ajustar-numero-endereco.mjs [--simular]
//   --simular  só lista o que seria feito, sem gravar nada
// Idempotente: o "original" já guardado nunca é sobrescrito e só endereços com número vazio mudam.
// Endereços que o escritório editou depois da importação têm o original buscado de novo no Field
// (um endereço que foi mexido aqui não representa mais o que veio de lá).
import { createClient } from '@supabase/supabase-js';

const BASE = 'https://carchost.fieldcontrol.com.br';
const { FIELD_CONTROL_API_KEY: CHAVE, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const SIMULAR = process.argv.includes('--simular');
const INTERVALO_MS = 1100; // a API aceita 1 requisição por segundo
const TOLERANCIA_EDICAO_MS = 5 * 60_000; // updated_at depois de created_at + 5 min = editado à mão

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

async function lerTabela(tabela, colunas, filtro) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    let q = sb.from(tabela).select(colunas).order(tabela === 'customer_address_field_original' ? 'address_id' : 'id').range(de, de + 999);
    if (filtro) q = filtro(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabela}: ${error.message}`);
    linhas.push(...data);
    if (data.length < 1000) return linhas;
  }
}

/** Texto exibido no cadastro: mesma ideia da linha de endereço da tela. */
function textoOriginal(d) {
  const via = [d.street, d.number].filter(Boolean).join(', ');
  const resto = [d.complement, d.district, [d.city, d.state].filter(Boolean).join('/'), d.zip_code].filter(Boolean).join(' · ');
  return [via, resto].filter(Boolean).join(' — ');
}

const UF = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const uf = (e) => (!limpo(e) ? null : /^[A-Za-z]{2}$/.test(e.trim()) ? e.trim().toUpperCase() : (UF[semAcento(e)] ?? e.trim()));

const dadosDoBanco = (e) => ({
  street: limpo(e.street),
  number: limpo(e.number),
  complement: limpo(e.complement),
  district: limpo(e.district),
  city: limpo(e.city),
  state: limpo(e.state),
  zip_code: limpo(e.zip_code),
});
const dadosDoField = (a) => ({
  street: limpo(a?.street),
  number: limpo(a?.number),
  complement: limpo(a?.complement),
  district: limpo(a?.neighborhood),
  city: limpo(a?.city),
  state: uf(a?.state),
  zip_code: String(a?.postalCode ?? a?.zipCode ?? '').replace(/\D/g, '') || null,
});

/** Só "casa N" ou só o número: devolve o número, senão null. */
function numeroNoComplemento(complemento) {
  const c = limpo(complemento);
  if (!c) return null;
  return c.match(/^casa\s*(?:n[ºo°.]?\s*)?(\d+[A-Za-z]?)$/i)?.[1] ?? c.match(/^(\d+[A-Za-z]?)$/)?.[1] ?? null;
}

console.log(SIMULAR ? 'SIMULAÇÃO: nada será gravado.\n' : '');

const enderecos = await lerTabela(
  'customer_addresses',
  'id, customer_id, street, number, complement, district, city, state, zip_code, field_control_id, created_at, updated_at',
  (q) => q.not('field_control_id', 'is', null),
);
const { error: erroTabela } = await sb.from('customer_address_field_original').select('address_id').limit(1);
if (erroTabela && !SIMULAR) {
  console.error(`Tabela customer_address_field_original indisponível (${erroTabela.message}). Cole a migration 20261103120000_endereco_original_field.sql no SQL Editor.`);
  process.exit(1);
}
if (erroTabela) console.log('(tabela dos originais ainda não existe: a simulação conta tudo como a guardar)');
const jaGuardados = new Set(erroTabela ? [] : (await lerTabela('customer_address_field_original', 'address_id')).map((r) => r.address_id));
console.log(`Endereços do Field: ${enderecos.length} (${jaGuardados.size} já com o original guardado)`);

// 1. Originais que faltam. Os editados à mão são buscados no Field; os demais ainda são o que foi importado.
const novos = enderecos.filter((e) => !jaGuardados.has(e.id));
const editados = novos.filter((e) => Date.parse(e.updated_at) - Date.parse(e.created_at) > TOLERANCIA_EDICAO_MS);
console.log(`Originais a guardar: ${novos.length} (${editados.length} editados depois da importação: buscados no Field)`);

const deField = new Map(); // id da localização no Field -> dados
const clientesDb = new Map((await lerTabela('customers', 'id, field_control_id', (q) => q.not('field_control_id', 'is', null))).map((c) => [c.id, c.field_control_id]));
const clientesEditados = [...new Set(editados.map((e) => e.customer_id))].filter((id) => clientesDb.has(id));
let feito = 0;
for (const id of clientesEditados) {
  const locais = await get(`/customers/${clientesDb.get(id)}/locations`);
  for (const l of locais?.items ?? []) deField.set(l.id, dadosDoField(l.address));
  process.stdout.write(`\r  localizações no Field: ${++feito}/${clientesEditados.length}   `);
}
if (clientesEditados.length) console.log();

const originais = novos.map((e) => {
  const dados = (deField.get(e.field_control_id) && editados.includes(e) ? deField.get(e.field_control_id) : null) ?? dadosDoBanco(e);
  return { address_id: e.id, original: textoOriginal(dados), dados };
});
const semOriginalDoField = editados.filter((e) => !deField.has(e.field_control_id)).length;
if (semOriginalDoField) console.log(`  (${semOriginalDoField} editados não foram achados no Field: ficou o valor atual do banco)`);

// 2. Quem muda: número vazio e complemento só "casa N" / só o número
const ajustes = enderecos.flatMap((e) => {
  if (limpo(e.number)) return [];
  const n = numeroNoComplemento(e.complement);
  return n ? [{ id: e.id, de: limpo(e.complement), numero: n }] : [];
});
console.log(`\nEndereços a ajustar (número vazio, complemento "casa N" ou só o número): ${ajustes.length}`);
for (const a of ajustes.slice(0, 8)) console.log(`  "${a.de}" -> número ${a.numero}, complemento vazio`);
if (ajustes.length > 8) console.log(`  ... e mais ${ajustes.length - 8}`);

if (SIMULAR) process.exit(0);

// 3. Grava o original primeiro (nunca sobrescreve), depois o ajuste
for (let i = 0; i < originais.length; i += 500) {
  const { error } = await sb.from('customer_address_field_original').upsert(originais.slice(i, i + 500), { onConflict: 'address_id', ignoreDuplicates: true });
  if (error) throw new Error(`customer_address_field_original: ${error.message}`);
  process.stdout.write(`\r  originais: ${Math.min(i + 500, originais.length)}/${originais.length}   `);
}
console.log();
const guardados = new Set((await lerTabela('customer_address_field_original', 'address_id')).map((r) => r.address_id));
let ajustados = 0;
for (const a of ajustes) {
  if (!guardados.has(a.id)) throw new Error(`Original não guardado para o endereço ${a.id}: parando sem ajustar.`);
  const { error } = await sb.from('customer_addresses').update({ number: a.numero, complement: null }).eq('id', a.id).or('number.is.null,number.eq.');
  if (error) throw new Error(`customer_addresses: ${error.message}`);
  process.stdout.write(`\r  ajustados: ${++ajustados}/${ajustes.length}   `);
}
console.log('\nPronto.');
