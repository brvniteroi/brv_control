// Baixa uma amostra de clientes do Field Control (SOMENTE LEITURA) para
// scripts/field-control/amostra/ (ignorada pelo git: são dados reais de clientes).
//
// Uso:  node --env-file=.env scripts/field-control/baixar-amostra.mjs "Nome 1" "Nome 2" ...
// Precisa de FIELD_CONTROL_API_KEY no .env (sem o prefixo VITE_).
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://carchost.fieldcontrol.com.br';
const CHAVE = process.env.FIELD_CONTROL_API_KEY;
const PASTA = path.join(import.meta.dirname, 'amostra');
const INTERVALO_MS = 1100; // a API aceita 1 requisição por segundo

if (!CHAVE) {
  console.error('Falta FIELD_CONTROL_API_KEY no .env.');
  process.exit(1);
}

const nomes = process.argv.slice(2);
if (nomes.length === 0) {
  console.error('Informe os nomes dos clientes entre aspas.');
  process.exit(1);
}

let ultima = 0;
async function get(caminho, tentativas = 4) {
  const espera = ultima + INTERVALO_MS - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultima = Date.now();

  const res = await fetch(BASE + caminho, {
    headers: {
      'X-Api-Key': CHAVE,
      'Content-Type': 'application/json;charset=UTF-8',
      'User-Agent': 'brv-control-importacao/1.0',
    },
  });
  if (res.status === 429 && tentativas > 0) {
    await new Promise((r) => setTimeout(r, 3000));
    return get(caminho, tentativas - 1);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    const corpo = await res.text();
    throw new Error(`${res.status} em ${caminho.split('?')[0]}: ${corpo.slice(0, 300)}`);
  }
  return res.json();
}

/** Percorre todas as páginas de uma listagem (até `max` itens). */
async function listar(caminho, max = 500) {
  const itens = [];
  const sep = caminho.includes('?') ? '&' : '?';
  for (let offset = 0; offset < max; offset += 100) {
    const pagina = await get(`${caminho}${sep}limit=100&offset=${offset}`);
    if (!pagina) break;
    itens.push(...pagina.items);
    if (itens.length >= pagina.totalCount || pagina.items.length < 100) break;
  }
  return itens;
}

async function buscarCliente(nome) {
  for (const valor of [`"${nome}"`, nome]) {
    const q = encodeURIComponent(`name:${valor}`);
    const r = await get(`/customers?q=${q}&limit=10`);
    if (r?.items?.length) return r.items;
  }
  return [];
}

// Tolerante: um recurso que falha não derruba o resto da amostra
async function tentar(rotulo, fn) {
  try {
    return await fn();
  } catch (e) {
    console.warn(`  ! ${rotulo}: ${e.message}`);
    return { erro: e.message };
  }
}

await mkdir(PASTA, { recursive: true });
const resumo = [];

for (const nome of nomes) {
  console.log(`\n== ${nome}`);
  const achados = await buscarCliente(nome);
  if (achados.length === 0) {
    console.log('  nenhum cliente com esse nome');
    resumo.push({ procurado: nome, encontrados: 0 });
    continue;
  }
  if (achados.length > 1) {
    console.log(`  ${achados.length} clientes com nome parecido; usando o primeiro:`);
    achados.forEach((c) => console.log(`    - ${c.name} (${c.id})`));
  }
  const base = achados[0];
  console.log(`  cliente: ${base.name}`);

  const id = encodeURIComponent(base.id);
  const cliente = (await get(`/customers/${id}`)) ?? base;
  const telefones = await tentar('telefones', () => listar(`/customers/${id}/phones`));
  const emails = await tentar('e-mails', () => listar(`/customers/${id}/emails`));
  const localizacoes = await tentar('localizações', () => listar(`/customers/${id}/locations`));
  const equipamentos = await tentar('equipamentos', () => listar(`/equipments?q=${encodeURIComponent(`customer_id:"${base.id}"`)}`));
  const ordens = await tentar('ordens', () => listar(`/orders?q=${encodeURIComponent(`customer_id:"${base.id}"`)}&sort=-created_at`, 100));

  const atividades = {};
  const anexos = {};
  if (Array.isArray(ordens)) {
    for (const os of ordens) {
      const oid = encodeURIComponent(os.id);
      atividades[os.id] = await tentar(`atividades da OS ${os.identifier}`, () => listar(`/orders/${oid}/tasks`));
      // Só metadados dos anexos; os arquivos não são baixados nesta amostra
      anexos[os.id] = await tentar(`anexos da OS ${os.identifier}`, () => listar(`/orders/${oid}/attachments`, 100));
    }
  }

  const contagem = (x) => (Array.isArray(x) ? x.length : 'erro');
  const linha = {
    procurado: nome,
    encontrado: cliente.name,
    telefones: contagem(telefones),
    emails: contagem(emails),
    localizacoes: contagem(localizacoes),
    equipamentos: contagem(equipamentos),
    ordens: contagem(ordens),
  };
  console.log('  ', JSON.stringify(linha));
  resumo.push(linha);

  const arquivo = base.name.normalize('NFD').replace(/[^\w]+/g, '_').slice(0, 40);
  await writeFile(
    path.join(PASTA, `${arquivo}.json`),
    JSON.stringify({ cliente, telefones, emails, localizacoes, equipamentos, ordens, atividades, anexos }, null, 2),
  );
}

await writeFile(path.join(PASTA, '_resumo.json'), JSON.stringify(resumo, null, 2));
console.log(`\nPronto. Arquivos em ${PASTA}`);
