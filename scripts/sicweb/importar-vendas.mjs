// Importa as vendas do SicWeb (banco SICNET restaurado no SQL Server Express deste PC) para as tabelas
// sicweb_vendas, sicweb_venda_itens e sicweb_venda_pagamentos do Supabase, ligadas ao cliente do Control
// pelo código do SicWeb (customer_sicweb_codes, preenchida por importar-clientes.mjs).
//
// Uso:  node --env-file=.env scripts/sicweb/importar-vendas.mjs [--gravar]
//   (sem flag)  SIMULA: exporta do SQL Server, confere, compara totais e escreve relatório em dados/saida/
//   --gravar    grava no Supabase (idempotente: pode rodar de novo; atualiza cliente e valores)
// Precisa: SQL Server Express com o banco SICNET restaurado (instância .\SQLEXPRESS, login do Windows),
// VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env, e as migrations 20261124100000 e 20261124110000 aplicadas.
// Rode ANTES importar-clientes.mjs --gravar: sem ele as vendas entram sem cliente (customer_id nulo; rodar este de
// novo depois resolve, porque o código do SicWeb fica guardado em cada venda).
//
// Valor da venda = soma de TABEST3B.totvenda (o que foi cobrado); `total_tabela` = preço de tabela (TABEST3B.total).
// Entram todas as linhas com venda = 1 (inclusive devolução, acerto etc., com o tipo guardado) e as canceladas
// ficam marcadas. Compras (TABEST2A) e orçamentos (TABEST4) não entram.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PASTA = import.meta.dirname;
const TEMP = path.join(PASTA, 'dados', 'saida');
const GRAVAR = process.argv.includes('--gravar');
const LOTE = 500;
const SQLCMD = process.env.SQLCMD || 'C:/Program Files/Microsoft SQL Server/Client SDK/ODBC/170/Tools/Binn/SQLCMD.EXE';
const SERVIDOR = process.env.SICWEB_SQL || '.\\SQLEXPRESS';

const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.');
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
  execFileSync(SQLCMD, ['-S', SERVIDOR, '-E', '-C', '-d', 'SICNET', '-s', '|', '-y', '0', '-f', '65001', '-o', arq, '-Q', `SET NOCOUNT ON; ${sql}`], { stdio: 'inherit', maxBuffer: 1 << 28 });
  const linhas = readFileSync(arq, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => /^\s*\d+\s*\|/.test(l)); // só linhas de dados (começam pelo número de controle); ignora cabeçalho e rodapé
  return linhas.map((l) => l.split('|').map((c) => (c.trim() === 'NULL' ? null : c.trim())));
}
const num = (s) => (s === null || s === undefined || s === '' ? 0 : Number(s));
const inteiro = (s) => (s === null || s === '' ? null : Number.parseInt(s, 10));
const texto = (s) => (s === null || s === undefined || s.trim() === '' ? null : s.trim());

const TIPOS = { 1: 'Consignação', 2: 'Venda à vista', 3: 'Venda a prazo', 4: 'Venda com cartão', 5: 'Acerto', 6: 'Devolução', 7: 'Alteração', 8: 'Arquivo', 9: 'Outros', 10: 'Loja BRV', 15: 'Outras saídas' };

if (!existsSync(SQLCMD)) {
  console.error(`sqlcmd não encontrado em ${SQLCMD}. Defina SQLCMD no ambiente.`);
  process.exit(1);
}

console.log('Lendo o SICNET no SQL Server...');
const vendasSql = consulta(
  'vendas',
  `SELECT a.controle, CONVERT(char(10), a.data, 23), CONVERT(char(8), a.hora, 108), a.lktipo, a.nota, ${limpaTexto('a.serie')}, a.pedido, a.nfe, a.lkvendedor,
          c.codigo, ${limpaTexto('a.obs')}, ISNULL(a.valorfrete, 0), CASE WHEN ISNULL(a.cancelada, 0) = 1 THEN 1 ELSE 0 END,
          ISNULL(i.tot, 0), ISNULL(i.tab, 0), ISNULL(i.luc, 0)
   FROM TABEST3A a
   LEFT JOIN TABCLI c ON c.controle = a.lkcliente
   OUTER APPLY (SELECT SUM(totvenda) tot, SUM(total) tab, SUM(lucro) luc FROM TABEST3B WHERE lkest3a = a.controle) i
   WHERE a.venda = 1 AND a.data IS NOT NULL
   ORDER BY a.controle`,
);
const itensSql = consulta(
  'itens',
  `SELECT b.controle, b.lkest3a, b.lkproduto, ${limpaTexto('p.produto')}, ISNULL(b.quantidade, 0), ISNULL(b.totvenda, 0), ISNULL(b.total, 0), ISNULL(b.lucro, 0)
   FROM TABEST3B b JOIN TABEST3A a ON a.controle = b.lkest3a AND a.venda = 1 AND a.data IS NOT NULL
   LEFT JOIN TABEST1 p ON p.controle = b.lkproduto
   ORDER BY b.controle`,
);
const pagSql = consulta(
  'pagamentos',
  `SELECT r.controle, r.lkest3a, r.lkest7, ${limpaTexto('f.recebimento')}, ISNULL(r.valor, 0), ISNULL(r.pgtroco, 0)
   FROM TABEST3R r JOIN TABEST3A a ON a.controle = r.lkest3a AND a.venda = 1 AND a.data IS NOT NULL
   LEFT JOIN TABEST7 f ON f.controle = r.lkest7
   ORDER BY r.controle`,
);
console.log(`SicWeb: ${vendasSql.length} vendas, ${itensSql.length} itens, ${pagSql.length} pagamentos`);

// ---------- código do SicWeb -> cliente do Control ----------
const codigos = new Map();
{
  let de = 0;
  for (;;) {
    const { data, error } = await sb.from('customer_sicweb_codes').select('codigo, customer_id').range(de, de + 999);
    if (error) {
      if (GRAVAR) falhou('customer_sicweb_codes (aplique as migrations e rode importar-clientes.mjs --gravar antes)', error);
      console.log('(aviso: customer_sicweb_codes ainda não existe ou está vazia; simulação segue sem ligar clientes)');
      break;
    }
    for (const d of data) codigos.set(d.codigo, d.customer_id);
    if (data.length < 1000) break;
    de += 1000;
  }
}
// Código como está no TABCLI (é assim que importar-clientes.mjs o guarda; há códigos curtos como "2737" e alguns
// com lixo no próprio SicWeb, então nada de completar com zeros)
const CODIGO_BALCAO = '004707';
const codigoPadrao =(c) => (c === null || c === '' ? null : String(c).trim());

// ---------- montar linhas ----------
const pagoPorVenda = new Map();
const pagamentos = pagSql.map((c) => {
  const venda = inteiro(c[1]);
  pagoPorVenda.set(venda, (pagoPorVenda.get(venda) ?? 0) + num(c[4]) - num(c[5]));
  return { controle: inteiro(c[0]), venda_controle: venda, forma_codigo: inteiro(c[2]), forma: texto(c[3]), valor: num(c[4]), troco: num(c[5]) };
});
const vendas = vendasSql.map((c) => {
  const codigo = codigoPadrao(c[9]);
  const hora = c[2] && /^\d\d:\d\d:\d\d$/.test(c[2]) ? c[2] : null;
  return {
    controle: inteiro(c[0]),
    // Venda sem cliente no SicWeb = venda avulsa: vai para o "Cliente Balcão" (código 004707), decisão do usuário em 2026-11-24
    customer_id: codigos.get(codigo ?? CODIGO_BALCAO) ?? null,
    cliente_codigo: codigo,
    data: c[1],
    hora,
    tipo: inteiro(c[3]),
    tipo_nome: TIPOS[inteiro(c[3])] ?? null,
    nota: inteiro(c[4]) || null,
    serie: texto(c[5]),
    pedido: inteiro(c[6]) || null,
    nfe: inteiro(c[7]) || null,
    vendedor_codigo: inteiro(c[8]) || null,
    observacoes: texto(c[10]),
    frete: num(c[11]),
    cancelada: c[12] === '1',
    total: num(c[13]),
    total_tabela: num(c[14]),
    lucro: num(c[15]),
    pago: Math.round((pagoPorVenda.get(inteiro(c[0])) ?? 0) * 100) / 100,
  };
});
const itens = itensSql.map((c) => ({ controle: inteiro(c[0]), venda_controle: inteiro(c[1]), produto_codigo: inteiro(c[2]), produto_nome: texto(c[3]), quantidade: num(c[4]), total: num(c[5]), total_tabela: num(c[6]), lucro: num(c[7]) }));

// ---------- conferência ----------
const soma = (xs, k) => Math.round(xs.reduce((a, x) => a + (x[k] ?? 0), 0) * 100) / 100;
const ativas = vendas.filter((v) => !v.cancelada);
const comCliente = vendas.filter((v) => v.cliente_codigo);
const ligadas = vendas.filter((v) => v.customer_id);
const resumo = {
  vendas: vendas.length,
  canceladas: vendas.length - ativas.length,
  itens: itens.length,
  pagamentos: pagamentos.length,
  vendasComCodigoDeCliente: comCliente.length,
  vendasLigadasAoClienteDoControl: ligadas.length,
  vendasSemClienteConsumidorFinal: vendas.length - comCliente.length,
  codigosDeClienteAindaNaoImportados: comCliente.filter((v) => !v.customer_id).length,
  somaItensVendasAtivas: soma(ativas, 'total'),
  somaPagamentos: soma(pagamentos, 'valor'),
  somaTabela: soma(ativas, 'total_tabela'),
  somaLucro: soma(ativas, 'lucro'),
  dataMinima: vendas.reduce((m, v) => (v.data < m ? v.data : m), '9999-12-31'),
  dataMaxima: vendas.reduce((m, v) => (v.data > m ? v.data : m), '0000-01-01'),
};
const idsVenda = new Set(vendas.map((v) => v.controle));
resumo.itensSemVenda = itens.filter((i) => !idsVenda.has(i.venda_controle)).length;
resumo.pagamentosSemVenda = pagamentos.filter((p) => !idsVenda.has(p.venda_controle)).length;
writeFileSync(path.join(TEMP, 'resumo-vendas.json'), JSON.stringify(resumo, null, 2));
console.log(resumo);

if (!GRAVAR) {
  console.log('\nSIMULAÇÃO: nada foi gravado no Supabase. Para gravar: node --env-file=.env scripts/sicweb/importar-vendas.mjs --gravar');
  process.exit(0);
}

// ---------- gravar ----------
async function gravar(tabela, linhas) {
  let n = 0;
  for (const lote of lotes(linhas)) {
    const { error } = await sb.from(tabela).upsert(lote, { onConflict: 'controle' });
    falhou(tabela, error);
    n += lote.length;
    process.stdout.write(`\r  ${tabela}: ${n}/${linhas.length}   `);
  }
  process.stdout.write('\n');
}
await gravar('sicweb_vendas', vendas);
await gravar('sicweb_venda_itens', itens.filter((i) => idsVenda.has(i.venda_controle)));
await gravar('sicweb_venda_pagamentos', pagamentos.filter((p) => idsVenda.has(p.venda_controle)));
console.log('Gravado. Confira os totais com o resumo acima.');
