// Importa os orçamentos do SicWeb do último ano (TABEST4/TABEST5 do banco SICNET restaurado no SQL Server Express
// deste PC) para sicweb_orcamentos e sicweb_orcamento_itens, só para consulta (só admin lê).
//
// Uso:  node --env-file=.env scripts/sicweb/importar-orcamentos.mjs [--gravar]
//   (sem flag)  SIMULA: lê, confere totais e escreve o resumo em dados/saida/
//   --gravar    grava no Supabase (repetível: atualiza pelo número). Precisa da migration 20261125160000.
//
// Cliente: 1º pelo código do SicWeb (customer_sicweb_codes). A maioria dos orçamentos não tem cliente no SicWeb, só o
// nome digitado: aí liga pelo NOME, apenas quando há um único cliente com exatamente o mesmo nome (sem acento e sem
// diferença de maiúsculas) e o nome tem pelo menos duas palavras. Fica marcado em ligado_por = 'nome'.
// O "Cliente Balcão" (004707) não conta como cliente aqui.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

/** Data de corte: só o último ano (decisão do usuário, 2026-11-24). */
const A_PARTIR_DE = '2025-11-24';
const CODIGO_BALCAO = '004707';
const TEMP = path.join(import.meta.dirname, 'dados', 'saida');
const GRAVAR = process.argv.includes('--gravar');
const LOTE = 500;
const SQLCMD = process.env.SQLCMD || 'C:/Program Files/Microsoft SQL Server/Client SDK/ODBC/170/Tools/Binn/SQLCMD.EXE';
const SERVIDOR = process.env.SICWEB_SQL || '.\\SQLEXPRESS';

const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.');
  process.exit(1);
}
if (!existsSync(SQLCMD)) {
  console.error(`sqlcmd não encontrado em ${SQLCMD}. Defina SQLCMD no ambiente.`);
  process.exit(1);
}
const sb = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const falhou = (etapa, error) => {
  if (error) throw new Error(`${etapa}: ${error.message}${error.details ? ` (${error.details})` : ''}`);
};

// ---------- leitura do SQL Server (sqlcmd -> arquivo UTF-8 separado por "|") ----------
// As quebras de linha das observações viram {NL} para o arquivo ter uma linha por registro
const limpaTexto = (col) => `REPLACE(REPLACE(REPLACE(REPLACE(CAST(${col} AS varchar(max)), CHAR(13), ''), CHAR(10), '{NL}'), CHAR(9), ' '), '|', '/')`;
function consulta(nome, sql) {
  mkdirSync(TEMP, { recursive: true });
  const arq = path.join(TEMP, `_${nome}.txt`);
  execFileSync(SQLCMD, ['-S', SERVIDOR, '-E', '-C', '-d', 'SICNET', '-s', '|', '-y', '0', '-f', '65001', '-o', arq, '-Q', `SET NOCOUNT ON; ${sql}`], { stdio: 'inherit', maxBuffer: 1 << 28 });
  return readFileSync(arq, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => /^\s*\d+\s*\|/.test(l)) // só linhas de dados (começam pelo número de controle)
    .map((l) => l.split('|').map((c) => (c.trim() === 'NULL' ? null : c.trim())));
}
const num = (s) => (s === null || s === undefined || s === '' ? 0 : Number(s));
const inteiro = (s) => (s === null || s === '' ? null : Number.parseInt(s, 10));
const texto = (s) => {
  const t = (s ?? '').replaceAll('{NL}', '\n').trim();
  return t === '' ? null : t;
};
const normalizar = (s) => (s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

console.log(`Lendo o SICNET (orçamentos a partir de ${A_PARTIR_DE})...`);
const orcSql = consulta(
  'orcamentos',
  `SELECT o.controle, CONVERT(char(10), o.data, 23), CONVERT(char(8), o.hora, 108), c.codigo, ${limpaTexto('o.cliente')}, ${limpaTexto('o.contato')},
          o.lkvendedor, ISNULL(o.total, 0), ${limpaTexto('o.obs')}
   FROM TABEST4 o LEFT JOIN TABCLI c ON c.controle = o.lkcliente
   WHERE o.data >= '${A_PARTIR_DE}'
   ORDER BY o.controle`,
);
const itensSql = consulta(
  'orcamento-itens',
  `SELECT i.controle, i.lkorcamento, i.lkproduto, ${limpaTexto('i.produto')}, ISNULL(i.quantidade, 0), ISNULL(i.vlunit, 0), ISNULL(i.total, 0)
   FROM TABEST5 i JOIN TABEST4 o ON o.controle = i.lkorcamento
   WHERE o.data >= '${A_PARTIR_DE}'
   ORDER BY i.controle`,
);
console.log(`SicWeb: ${orcSql.length} orçamentos, ${itensSql.length} itens`);

// ---------- clientes do Control ----------
async function tudo(tabela, colunas, ordem) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from(tabela).select(colunas).order(ordem).range(de, de + 999);
    falhou(tabela, error);
    linhas.push(...data);
    if (data.length < 1000) return linhas;
  }
}
const codigos = new Map((await tudo('customer_sicweb_codes', 'codigo, customer_id', 'codigo')).map((d) => [d.codigo, d.customer_id]));
const balcao = codigos.get(CODIGO_BALCAO) ?? null;
const porNome = new Map(); // nome normalizado -> id, ou null quando há mais de um
for (const c of await tudo('customers', 'id, name', 'id')) {
  const chave = normalizar(c.name);
  porNome.set(chave, porNome.has(chave) ? null : c.id);
}

function acharCliente(codigo, nome) {
  const peloCodigo = codigo ? codigos.get(codigo) : null;
  if (peloCodigo && peloCodigo !== balcao) return { customer_id: peloCodigo, ligado_por: 'codigo' };
  const chave = normalizar(nome);
  const peloNome = chave.split(' ').length >= 2 ? porNome.get(chave) : null;
  if (peloNome && peloNome !== balcao) return { customer_id: peloNome, ligado_por: 'nome' };
  return { customer_id: null, ligado_por: null };
}

// ---------- montar linhas ----------
const orcamentos = orcSql.map((c) => ({
  controle: inteiro(c[0]),
  data: c[1],
  hora: c[2] && /^\d\d:\d\d:\d\d$/.test(c[2]) ? c[2] : null,
  cliente_codigo: texto(c[3]),
  cliente_nome: texto(c[4]),
  contato: texto(c[5]),
  vendedor_codigo: inteiro(c[6]) || null,
  total: Math.round(num(c[7]) * 100) / 100,
  observacoes: texto(c[8]),
  ...acharCliente(texto(c[3]), texto(c[4])),
}));
const numeros = new Set(orcamentos.map((o) => o.controle));
const itens = itensSql
  .map((c) => ({
    controle: inteiro(c[0]),
    orcamento_controle: inteiro(c[1]),
    produto_codigo: inteiro(c[2]),
    produto_nome: texto(c[3]),
    quantidade: num(c[4]),
    valor_unitario: num(c[5]),
    total: Math.round(num(c[6]) * 100) / 100,
  }))
  .filter((i) => numeros.has(i.orcamento_controle));

const soma = (xs) => Math.round(xs.reduce((a, x) => a + x.total, 0) * 100) / 100;
const resumo = {
  orcamentos: orcamentos.length,
  itens: itens.length,
  ligadosPeloCodigo: orcamentos.filter((o) => o.ligado_por === 'codigo').length,
  ligadosPeloNome: orcamentos.filter((o) => o.ligado_por === 'nome').length,
  semCliente: orcamentos.filter((o) => !o.customer_id).length,
  somaOrcamentos: soma(orcamentos),
  somaItens: soma(itens),
  dataMinima: orcamentos.reduce((m, o) => (o.data < m ? o.data : m), '9999-12-31'),
  dataMaxima: orcamentos.reduce((m, o) => (o.data > m ? o.data : m), '0000-01-01'),
  comObservacao: orcamentos.filter((o) => o.observacoes).length,
};
writeFileSync(path.join(TEMP, 'resumo-orcamentos.json'), JSON.stringify(resumo, null, 2));
console.log(resumo);

if (!GRAVAR) {
  console.log('\nSIMULAÇÃO: nada foi gravado. Para gravar: node --env-file=.env scripts/sicweb/importar-orcamentos.mjs --gravar');
  process.exit(0);
}

async function gravar(tabela, linhas) {
  for (let i = 0; i < linhas.length; i += LOTE) {
    const { error } = await sb.from(tabela).upsert(linhas.slice(i, i + LOTE), { onConflict: 'controle' });
    falhou(tabela, error);
    process.stdout.write(`\r  ${tabela}: ${Math.min(i + LOTE, linhas.length)}/${linhas.length}   `);
  }
  process.stdout.write('\n');
}
await gravar('sicweb_orcamentos', orcamentos);
await gravar('sicweb_orcamento_itens', itens);
console.log('Gravado. Confira os totais com o resumo acima.');
