// Importa o cadastro de produtos e serviços do SicWeb (TABEST1 do banco SICNET restaurado no SQL Server Express
// deste PC) para o catálogo do BRV Control (catalog_items e catalog_item_costs).
//
// Uso:  node --env-file=.env scripts/sicweb/importar-produtos.mjs [--gravar] [--atualizar-precos]
//   (sem flag)          SIMULA: lê o SICNET, classifica e escreve dados/saida/produtos-importacao.csv
//   --gravar            grava no Supabase os itens que ainda não existem (pela chave legacy_code = TABEST1.controle)
//   --atualizar-precos  nos itens já importados, atualiza SÓ preço de venda, data do reajuste e custo (para a virada)
// Pode rodar de novo: item já importado nunca tem nome, tipo, código ou dado fiscal sobrescritos.
//
// Regras:
//   * Serviço = setor "Serviços" do SicWeb (TABEST1.lksetor = 10) ou nome começando como mão de obra, instalação,
//     manutenção, desinstalação, limpeza de sistema, visita, serviço ou sinal de serviço. Os dois sinais foram
//     conferidos em 2026-11-25, então tudo entra como já revisado (a ferramenta "Revisar tipos" não pré-marca
//     produtos como "TERMINAL ... PARA INSTALAÇÃO").
//   * Estoque NÃO vem do SicWeb (muito saldo negativo): começa zerado e sem controle.
//   * Fiscal do produto: NCM da coluna codipi (só com 8 dígitos), CSOSN 102 só onde o SicWeb diz 102, CFOP 5102
//     (padrão da emissão no SicWeb). Serviço entra sem código de serviço nem ISS (o contador confirma).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PASTA = import.meta.dirname;
const TEMP = path.join(PASTA, 'dados', 'saida');
const GRAVAR = process.argv.includes('--gravar');
const ATUALIZAR_PRECOS = process.argv.includes('--atualizar-precos');
const LOTE = 200;
const SETOR_SERVICOS = 10;
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
const lotes = (xs, n = LOTE) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

// ---------- leitura do SQL Server (sqlcmd -> arquivo UTF-8 separado por "|") ----------
const limpaTexto = (col) => `REPLACE(REPLACE(REPLACE(REPLACE(CAST(${col} AS varchar(max)), CHAR(13), ' '), CHAR(10), ' '), CHAR(9), ' '), '|', '/')`;
function consulta(nome, sql) {
  mkdirSync(TEMP, { recursive: true });
  const arq = path.join(TEMP, `_${nome}.txt`);
  execFileSync(SQLCMD, ['-S', SERVIDOR, '-E', '-C', '-l', '60', '-d', 'SICNET', '-s', '|', '-y', '0', '-f', '65001', '-o', arq, '-Q', `SET NOCOUNT ON; ${sql}`], { stdio: 'inherit' });
  const linhas = readFileSync(arq, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => /^\s*\d+\s*\|/.test(l));
  return linhas.map((l) => l.split('|').map((c) => (c.trim() === 'NULL' || c.trim() === '' ? null : c.trim())));
}

console.log('Lendo o SICNET no SQL Server...');
const linhas = consulta(
  'produtos',
  `SELECT p.controle, ${limpaTexto('p.codigo')}, ${limpaTexto('p.cean')}, ${limpaTexto('p.produto')}, p.lksetor, ${limpaTexto('s.setor')},
          ${limpaTexto('p.fabricante')}, ${limpaTexto('p.unidade')}, ISNULL(p.precovenda, 0), ISNULL(p.precocusto, 0),
          CONVERT(char(10), p.ultreaj, 23), CONVERT(char(10), p.datainc, 23), CASE WHEN ISNULL(p.inativo, 0) = 1 THEN 1 ELSE 0 END,
          ${limpaTexto('p.codipi')}, ${limpaTexto('p.cst')}, p.origem, ${limpaTexto('p.obs')}
   FROM TABEST1 p LEFT JOIN TABEST8 s ON s.controle = p.lksetor
   ORDER BY p.controle`,
);

// ---------- classificação ----------
const semAcento = (s) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const NOME_DE_SERVICO = /^(m\.?\s*o\b|mao[\s-]*de[\s-]*obra|instalacao|desinstalacao|manutencao|limpeza de sistema|visita|servico|sinal de servico)/;
const UNIDADES = { UN: 'UN', UND: 'UN', UNID: 'UN', 'PÇ': 'UN', PC: 'UN', AP: 'UN', MT: 'M', M: 'M', ML: 'M', M2: 'M', CM: 'M', KG: 'KG', CX: 'CX', PAR: 'PAR', KIT: 'KIT', ROLO: 'ROLO', L: 'L', H: 'H' };
const centavos = (s) => Math.max(0, Math.round(Number(s ?? 0) * 100));
const digitos = (s) => (s ?? '').replace(/\D/g, '');
const agora = new Date().toISOString();

const itens = linhas.map((c) => {
  const [controle, codigo, cean, nomeBruto, lksetor, setor, fabricante, unidadeBruta, venda, custo, reajuste, inclusao, inativo, codipi, cst, origem, obs] = c;
  const nome = (nomeBruto ?? '').replace(/\s+/g, ' ').trim();
  const servico = Number(lksetor) === SETOR_SERVICOS || NOME_DE_SERVICO.test(semAcento(nome));
  // Código de barras: o GTIN do cadastro; sem ele, o próprio código quando tem 13 dígitos (é o que a etiqueta da loja imprime)
  const gtin = /^\d{8,14}$/.test(cean ?? '') ? cean : /^\d{13}$/.test(codigo ?? '') ? codigo : null;
  const unidade = servico ? 'SRV' : (UNIDADES[(unidadeBruta ?? '').toUpperCase()] ?? 'UN');
  const ncm = digitos(codipi);
  const orig = Number(origem ?? 0);
  const dia = reajuste ?? inclusao;
  return {
    item: {
      legacy_code: controle,
      code: codigo ?? `SIC-${controle}`,
      barcode: gtin,
      name: nome,
      kind: servico ? 'servico' : 'produto',
      unit: unidade,
      category: setor,
      manufacturer: servico ? null : fabricante,
      notes: obs,
      sale_price_cents: centavos(venda),
      // Meio-dia de Niterói: data sem hora em TIMESTAMPTZ cairia no dia anterior
      price_updated_at: dia ? `${dia}T12:00:00-03:00` : agora,
      controls_stock: false,
      stock_quantity: 0,
      min_stock_quantity: 0,
      active: inativo !== '1',
      type_reviewed: true,
      ncm: !servico && ncm.length === 8 ? ncm : null,
      cfop: servico ? null : '5102',
      csosn: !servico && cst === '102' ? '102' : null,
      origin: orig >= 0 && orig <= 8 ? orig : 0,
      taxable_unit: unidade,
    },
    custo: centavos(custo),
  };
}).filter((x) => x.item.name);

// ---------- o que já existe no Control ----------
async function tudo(colunas) {
  const saida = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from('catalog_items').select(colunas).order('id').range(de, de + 999);
    falhou('catalog_items', error);
    saida.push(...data);
    if (data.length < 1000) return saida;
  }
}
const existentes = await tudo('id, code, legacy_code, sale_price_cents');
const porLegado = new Map(existentes.filter((e) => e.legacy_code).map((e) => [e.legacy_code, e]));
const codigosUsados = new Set(existentes.map((e) => e.code.trim().toLowerCase()));

const novos = [];
const jaImportados = [];
const conflitos = [];
for (const x of itens) {
  const atual = porLegado.get(x.item.legacy_code);
  if (atual) jaImportados.push({ ...x, atual });
  else if (codigosUsados.has(x.item.code.toLowerCase())) conflitos.push(x);
  else {
    codigosUsados.add(x.item.code.toLowerCase());
    novos.push(x);
  }
}

// ---------- relatório ----------
const conta = (xs, f) => xs.filter(f).length;
const resumo = {
  lidosNoSicweb: itens.length,
  novos: novos.length,
  jaImportados: jaImportados.length,
  codigoJaUsadoPorOutroItem: conflitos.length,
  produtos: conta(itens, (x) => x.item.kind === 'produto'),
  servicos: conta(itens, (x) => x.item.kind === 'servico'),
  inativos: conta(itens, (x) => !x.item.active),
  semPreco: conta(itens, (x) => x.item.active && x.item.sale_price_cents === 0),
  comCusto: conta(itens, (x) => x.custo > 0),
  produtosComNcm: conta(itens, (x) => x.item.kind === 'produto' && x.item.ncm),
  produtosComFiscalCompleto: conta(itens, (x) => x.item.kind === 'produto' && x.item.ncm && x.item.csosn),
  comFabricante: conta(itens, (x) => x.item.manufacturer),
  comObservacao: conta(itens, (x) => x.item.notes),
};
const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const dinheiro = (c) => (c / 100).toFixed(2).replace('.', ',');
writeFileSync(
  path.join(TEMP, 'produtos-importacao.csv'),
  '\uFEFF' + ['situacao;controle;codigo;nome;tipo;unidade;categoria;fabricante;preco;custo;ncm;csosn;ativo']
    .concat(itens.map((x) => {
      const i = x.item;
      const situacao = porLegado.has(i.legacy_code) ? 'ja importado' : conflitos.includes(x) ? 'conflito de codigo' : 'novo';
      return [situacao, i.legacy_code, i.code, i.name, i.kind, i.unit, i.category, i.manufacturer, dinheiro(i.sale_price_cents), dinheiro(x.custo), i.ncm, i.csosn, i.active ? 'sim' : 'nao'].map(csv).join(';');
    }))
    .join('\r\n'),
);
console.log(resumo);
console.log(`Relatório: ${path.join(TEMP, 'produtos-importacao.csv')}`);

if (!GRAVAR) {
  console.log('\nSIMULAÇÃO: nada foi gravado. Para gravar: node --env-file=.env scripts/sicweb/importar-produtos.mjs --gravar');
  process.exit(0);
}

// ---------- gravar ----------
let gravados = 0;
for (const lote of lotes(novos)) {
  const { data, error } = await sb.from('catalog_items').insert(lote.map((x) => x.item)).select('id, legacy_code');
  falhou('catalog_items', error);
  const ids = new Map(data.map((d) => [d.legacy_code, d.id]));
  const custos = lote.filter((x) => x.custo > 0).map((x) => ({ catalog_item_id: ids.get(x.item.legacy_code), cost_price_cents: x.custo }));
  if (custos.length) {
    const { error: erroCusto } = await sb.from('catalog_item_costs').upsert(custos);
    falhou('catalog_item_costs', erroCusto);
  }
  gravados += data.length;
  process.stdout.write(`\r  novos: ${gravados}/${novos.length}   `);
}
process.stdout.write('\n');

if (ATUALIZAR_PRECOS) {
  let precos = 0;
  for (const x of jaImportados) {
    if (Number(x.atual.sale_price_cents) !== x.item.sale_price_cents) {
      const { error } = await sb.from('catalog_items').update({ sale_price_cents: x.item.sale_price_cents }).eq('id', x.atual.id);
      falhou('preço', error);
      // Segunda gravação: o gatilho de reajuste põe "agora" quando o preço muda; aqui vale a data do SicWeb
      const { error: erroData } = await sb.from('catalog_items').update({ price_updated_at: x.item.price_updated_at }).eq('id', x.atual.id);
      falhou('data do reajuste', erroData);
      precos += 1;
    }
    if (x.custo > 0) {
      const { error } = await sb.from('catalog_item_costs').upsert({ catalog_item_id: x.atual.id, cost_price_cents: x.custo });
      falhou('custo', error);
    }
  }
  console.log(`Preços atualizados: ${precos}`);
}
console.log('Gravado. Confira os totais com o resumo acima.');
