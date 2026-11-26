// Importa o cadastro de clientes exportado do SicWeb (scripts/sicweb/dados/clientes.csv) para o BRV Control.
// Objetivo: cada cliente do SicWeb ter o seu cadastro no Control e o código antigo guardado em
// `customer_sicweb_codes`, que é a ponte para o financeiro (títulos, vendas e notas do SicWeb apontam
// para esse código).
//
// Uso:  node --env-file=.env scripts/sicweb/importar-clientes.mjs [--gravar] [--so-existentes]
//   (sem flags)       SIMULA: lê, limpa, compara com o Control e grava só relatórios em dados/saida/
//   --gravar          grava no banco (clientes novos + ligação dos que já existem)
//   --so-existentes   com --gravar: só liga os códigos aos clientes que já existem, sem criar cliente novo
// Precisa no .env: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. Antes: migration
// 20261124100000_clientes_sicweb.sql aplicada (a simulação roda sem ela).
//
// Regras (nada do que já existe é sobrescrito):
//  - mesmo documento, ou mesmo nome + telefone, ou mesmo nome único (3+ palavras), ou telefone + nome parecido
//    = o cliente já existe: só guarda o código e preenche o que estava vazio (documento, e-mail, inscrição,
//    telefones novos como contato, endereço se não tinha nenhum);
//  - cadastros duplicados dentro do SicWeb (mesmo documento ou mesmo nome + telefone) viram um cliente só;
//  - pode rodar de novo (virada): grupo com algum código já gravado é do cliente que tem o código (sem comparar nome);
//    telefone que já veio do SicWeb numa importação anterior não volta, mesmo que tenha sido apagado no Control;
//  - dúvida (mesmo nome com telefone diferente, vários candidatos): entra como cliente novo (cadastrar como está
//    no SICNET e acertar depois) e fica listada em saida/revisar.csv com os candidatos do Control;
//  - fonte: o banco SICNET restaurado no SQL Server local (completo). `--csv` usa o clientes.csv, que perde ~12 cadastros;
//  - linha sem código ou quebrada vai para saida/problemas.csv.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PASTA = import.meta.dirname;
const ARQ = path.join(PASTA, 'dados', 'clientes.csv');
const SAIDA = path.join(PASTA, 'dados', 'saida');
const GRAVAR = process.argv.includes('--gravar');
const SO_EXISTENTES = process.argv.includes('--so-existentes');
const LOTE = 400;

const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.');
  process.exit(1);
}
const sb = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// ---------- utilitários ----------
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const espacos = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const digitos = (s) => String(s ?? '').replace(/\D/g, '');
const lotes = (xs, n = LOTE) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const csv = (linhas) => linhas.map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
const falhou = (etapa, error) => {
  if (error) throw new Error(`${etapa}: ${error.message}${error.details ? ` (${error.details})` : ''}`);
};

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'van', 'von']);
const SIGLAS = new Set(['ltda', 'me', 'epp', 'eireli', 'sa', 'ii', 'iii', 'iv', 'rj', 'sp', 'mg', 'tv', 'pc', 'ti', 'mei', 'cpf', 'cnpj']);
/** Nome todo em maiúsculas vira "Nome Próprio"; nome que já tem minúsculas fica como está. */
function arrumaNome(s) {
  const n = espacos(s);
  if (!n || n !== n.toUpperCase() || !/[A-ZÀ-Ý]{2}/.test(n)) return n;
  return n
    .toLowerCase()
    .split(' ')
    .map((p, i) => (SIGLAS.has(p.replace(/\./g, '')) ? p.toUpperCase() : i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

// ---------- CPF / CNPJ ----------
function dv(valores, pesos) {
  const soma = valores.reduce((a, v, i) => a + v * pesos[i], 0);
  const r = soma % 11;
  return r < 2 ? 0 : 11 - r;
}
function cpfValido(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const n = d.split('').map(Number);
  return dv(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === n[9] && dv(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === n[10];
}
function cnpjValido(d) {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const n = d.split('').map(Number);
  return dv(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === n[12] && dv(n.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === n[13];
}

// ---------- telefone ----------
function formatarTel(d) {
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}
/** Um número solto -> 10 ou 11 dígitos com DDD (21 se faltar), ou null. 8 dígitos começando em 6-9 é celular antigo: ganha o 9. */
function normalizaTel(bruto) {
  let d = digitos(bruto);
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length >= 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 9 && d[0] === '9') d = `21${d}`;
  else if (d.length === 8) d = `21${/[6-9]/.test(d[0]) ? '9' : ''}${d}`;
  if (d.length === 10 && /[6-9]/.test(d[2])) d = `${d.slice(0, 2)}9${d.slice(2)}`;
  if (d.length !== 10 && d.length !== 11) return null;
  if (!/^[1-9][1-9]/.test(d)) return null;
  if (d.length === 11 && d[2] !== '9') return null;
  return d;
}
function telefones(...campos) {
  const out = [];
  for (const campo of campos) {
    for (const parte of String(campo ?? '').split(/[/*;,]|\s-\s|\se\s/)) {
      const t = normalizaTel(parte);
      if (t && !out.includes(t)) out.push(t);
    }
  }
  return out;
}
const chaveTel = (d) => d.slice(-8);

// ---------- endereço ----------
function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const CIDADES = {
  niteroi: 'Niterói',
  'sao goncalo': 'São Gonçalo',
  marica: 'Maricá',
  itaborai: 'Itaboraí',
  'rio de janeiro': 'Rio de Janeiro',
  'nova iguacu': 'Nova Iguaçu',
  'duque de caxias': 'Duque de Caxias',
  'belo horizonte': 'Belo Horizonte',
};
// Bairros de Niterói que vieram digitados no campo cidade
const BAIRROS_NITEROI = new Set(['icarai', 'itaipu', 'itaipuacu', 'piratininga', 'charitas', 'sao francisco', 'ingá', 'inga', 'santa rosa', 'centro', 'fonseca', 'camboinhas', 'jurujuba', 'boa viagem', 'pendotiba', 'engenho do mato', 'maceio', 'santa barbara', 'barreto', 'cafubá', 'cafuba', 'sao domingos', 'gragoata']);
function cidadeUF(cidadeBruta, ufBruta) {
  const c = espacos(cidadeBruta);
  const k = semAcento(c);
  let uf = /^[A-Za-z]{2}$/.test(espacos(ufBruta)) ? espacos(ufBruta).toUpperCase() : 'RJ';
  if (!k) return { cidade: 'Niterói', uf, bairroExtra: null, inferida: true };
  if (CIDADES[k]) return { cidade: CIDADES[k], uf, bairroExtra: null, inferida: false };
  // Erro de digitação em cidade conhecida (Nitetói, Niteroí, São Gonçalo sem acento...)
  const parecida = Object.keys(CIDADES).find((c) => distancia(c, k) <= (c.length >= 7 ? 2 : 1));
  if (parecida) return { cidade: CIDADES[parecida], uf, bairroExtra: null, inferida: false };
  if (BAIRROS_NITEROI.has(k)) return { cidade: 'Niterói', uf: 'RJ', bairroExtra: arrumaNome(c), inferida: false };
  return { cidade: arrumaNome(c), uf, bairroExtra: null, inferida: false };
}

// ---------- leitura do CSV (ISO-8859-1, ';', registros às vezes quebrados) ----------
const COLUNAS = ['codigo', 'nome', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep', 'telefone', 'celular', 'data', 'email', 'documento', 'contato', 'inscricao', 'atividade', 'identidade', 'nascimento', 'filiacao', 'profissao'];
const RUA = /^(r|rua|av|avenida|al|alameda|trav|travessa|estr|estrada|pca|praca|praça|rod|rodovia|lg|largo|ld|ladeira)\.?:?$/i;

function lerRegistros() {
  const texto = new TextDecoder('latin1').decode(readFileSync(ARQ));
  const linhas = texto.split(/\r?\n/).slice(3); // título, linha em branco, cabeçalho
  const registros = [];
  const problemas = [];
  const colunas = (l) => l.split(';').length;
  let atual = null;
  const fecha = () => {
    if (atual !== null) registros.push(atual);
    atual = null;
  };
  for (const l of linhas) {
    if (!l.trim()) continue;
    // Registro que ficou pela metade (campo com quebra de linha): a linha seguinte é a continuação
    if (atual !== null && colunas(atual) < 21) {
      atual = `${atual} ${l}`;
      continue;
    }
    fecha();
    atual = l;
  }
  fecha();

  const lidos = [];
  for (const bruto of registros) {
    let c = bruto.split(';');
    if (c.length > 21) {
      // ";" dentro do endereço ou do complemento: junta de volta (campos 2..4 são endereço, número e complemento)
      const sobra = c.length - 21;
      const meio = c.slice(2, 5 + sobra);
      let novo = RUA.test(espacos(meio[0])) ? [`${espacos(meio[0])} ${espacos(meio[1])}`, ...meio.slice(2)] : [...meio];
      novo = [novo[0], novo[1], novo.slice(2).join('; ')];
      c = [...c.slice(0, 2), ...novo, ...c.slice(5 + sobra)];
    }
    if (c.length !== 21) {
      problemas.push([bruto.slice(0, 80), `colunas: ${c.length}`]);
      continue;
    }
    const r = Object.fromEntries(COLUNAS.map((k, i) => [k, espacos(c[i])]));
    if (!/^\d{4,8}$/.test(r.codigo) || !r.nome) {
      problemas.push([bruto.slice(0, 80), 'sem código válido ou sem nome']);
      continue;
    }
    lidos.push(r);
  }
  return { lidos, problemas };
}

// ---------- leitura direto do SICNET (SQL Server local; é a fonte padrão, completa) ----------
// Só colunas de cadastro: a tabela TABCLI também guarda número de cartão, código de segurança e senha, que NUNCA são lidos.
const SQLCMD = process.env.SQLCMD || 'C:/Program Files/Microsoft SQL Server/Client SDK/ODBC/170/Tools/Binn/SQLCMD.EXE';
const SERVIDOR = process.env.SICWEB_SQL || '.\\SQLEXPRESS';
function lerDoBanco() {
  const t = (col) => `REPLACE(REPLACE(REPLACE(REPLACE(CAST(${col} AS varchar(max)), CHAR(13), ' '), CHAR(10), ' '), CHAR(9), ' '), '|', '/')`;
  const campos = ['codigo', 'nome', 'endereco', 'endnumero', 'endcomplemento', 'bairro', 'cidade', 'estado', 'cep', 'telefone', 'celular'].map(t).join(', ');
  const sql = `SET NOCOUNT ON; SELECT 'R', ${campos}, ISNULL(CONVERT(char(10), data, 103), ''), ${['email', 'cgc', 'contato', 'insc', 'atividade', 'identidade'].map(t).join(', ')}, ISNULL(CONVERT(char(10), nascimento, 103), ''), ${['filiacao', 'profissao', 'obs'].map(t).join(', ')} FROM TABCLI ORDER BY controle`;
  mkdirSync(SAIDA, { recursive: true });
  const arq = path.join(SAIDA, '_clientes_banco.txt');
  execFileSync(SQLCMD, ['-S', SERVIDOR, '-E', '-C', '-d', 'SICNET', '-s', '|', '-y', '0', '-f', '65001', '-o', arq, '-Q', sql], { stdio: 'inherit', maxBuffer: 1 << 28 });
  const chaves = [...COLUNAS, 'obs'];
  const lidos = [];
  const problemas = [];
  for (const l of readFileSync(arq, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!/^R\s*\|/.test(l)) continue;
    const c = l.split('|').slice(1).map((x) => (x.trim() === 'NULL' ? '' : x));
    if (c.length !== chaves.length) {
      problemas.push([l.slice(0, 80), `colunas: ${c.length}`]);
      continue;
    }
    const r = Object.fromEntries(chaves.map((k, i) => [k, espacos(c[i])]));
    if (!r.codigo || !r.nome) {
      problemas.push([l.slice(0, 80), 'sem código ou sem nome']);
      continue;
    }
    lidos.push(r);
  }
  return { lidos, problemas };
}

// ---------- limpeza de cada cliente ----------
const PJ_NOME = /\b(ltda|me|epp|eireli|s\/?a|cia|condom[ií]nio|igreja|cl[ií]nica|associa[cç][aã]o|escola|col[eé]gio|empresa|com[eé]rcio|servi[cç]os?|restaurante|hotel|loja|farm[aá]cia|instituto|funda[cç][aã]o|sindicato|prefeitura|cons[oó]rcio|academia|clube|ag[eê]ncia|oficina|ind[uú]stria|consult[oó]rio|laborat[oó]rio|escrit[oó]rio|batalh[aã]o|hospital)\b/i;
const EMAIL = /^[^\s@;,]+@[^\s@;,]+\.[a-z]{2,}$/i;

function limpar(r) {
  const nome = arrumaNome(r.nome);
  const docBruto = digitos(r.documento);
  let documento = null;
  let docInvalido = null;
  let tipo = null;
  if (docBruto) {
    if (docBruto.length === 11 && cpfValido(docBruto)) [documento, tipo] = [docBruto, 'PF'];
    else if (docBruto.length === 14 && cnpjValido(docBruto)) [documento, tipo] = [docBruto, 'PJ'];
    else docInvalido = r.documento;
  }
  tipo ??= PJ_NOME.test(nome) ? 'PJ' : 'PF';

  const emails = String(r.email).split(/[\s,;/]+/).map((e) => e.toLowerCase()).filter((e) => EMAIL.test(e));
  const contatoEhEmail = EMAIL.test(r.contato);
  if (contatoEhEmail && !emails.includes(r.contato.toLowerCase())) emails.push(r.contato.toLowerCase());
  const nomeContato = r.contato && !contatoEhEmail ? arrumaNome(r.contato) : null;

  const tels = telefones(r.telefone, r.celular);
  const { cidade, uf, bairroExtra, inferida } = cidadeUF(r.cidade, r.estado);
  const rua = espacos(r.endereco).replace(/^(rua|av|avenida)\s*:\s*/i, (m) => m.replace(/\s*:\s*$/, ' '));
  const cep = digitos(r.cep);
  const dataCad = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(r.data);
  const ano = dataCad ? Number(dataCad[3]) : 0;
  const cadastradoEm = dataCad && ano >= 2000 && ano <= 2026 ? `${dataCad[3]}-${dataCad[2]}-${dataCad[1]}` : null;

  return {
    codigo: r.codigo,
    nome,
    tipo,
    documento,
    docInvalido,
    inscricao: tipo === 'PJ' && r.inscricao && digitos(r.inscricao).length >= 5 ? r.inscricao : null,
    emails,
    nomeContato,
    tels,
    endereco: rua
      ? {
          street: rua,
          number: espacos(r.numero) || null,
          complement: espacos(r.complemento) || null,
          district: espacos(r.bairro) ? arrumaNome(r.bairro) : bairroExtra,
          city: cidade,
          state: uf,
          zip_code: cep.length === 8 ? cep : null,
          cidadeInferida: inferida,
        }
      : null,
    cadastradoEm,
    observacoes: espacos(r.obs ?? '') || null,
    bruto: r,
  };
}

// ---------- chaves de comparação ----------
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o']);
const tokens = (nome) => semAcento(nome).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t && !STOP.has(t));
const chaveNome = (nome) => [...tokens(nome)].sort().join(' ');
function parecidos(a, b) {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  const comum = [...ta].filter((t) => tb.has(t)).length;
  if (!comum) return false;
  const menor = Math.min(ta.size, tb.size);
  const uniao = new Set([...ta, ...tb]).size;
  return comum / uniao >= 0.6 || (menor >= 2 && comum === menor);
}

// ---------- 1. ler e limpar ----------
const { lidos, problemas } = process.argv.includes('--csv') ? lerRegistros() : lerDoBanco();
const todos = lidos.map(limpar);
console.log(`Lidos do CSV: ${lidos.length} clientes (${problemas.length} linhas com problema, ver saida/problemas.csv)`);

// ---------- 2. juntar duplicados do próprio SicWeb ----------
const grupos = []; // { itens: [limpo...], principal }
const porDoc = new Map();
const porNomeTel = new Map();
for (const c of todos) {
  const chaves = [];
  if (c.documento) chaves.push(`d:${c.documento}`);
  for (const t of c.tels) chaves.push(`n:${chaveNome(c.nome)}|${chaveTel(t)}`);
  let g = null;
  for (const k of chaves) {
    const achado = (k.startsWith('d:') ? porDoc : porNomeTel).get(k);
    if (achado) {
      g = achado;
      break;
    }
  }
  if (!g) {
    g = { itens: [] };
    grupos.push(g);
  }
  g.itens.push(c);
  for (const k of chaves) (k.startsWith('d:') ? porDoc : porNomeTel).set(k, g);
}
// o principal é o cadastro mais completo (mais dados) e, empatando, o mais recente
const pontos = (c) => (c.documento ? 3 : 0) + c.emails.length + c.tels.length + (c.endereco ? 2 : 0) + (c.endereco?.zip_code ? 1 : 0);
for (const g of grupos) {
  g.itens.sort((a, b) => pontos(b) - pontos(a) || b.codigo.localeCompare(a.codigo));
  g.principal = g.itens[0];
  g.documento = g.itens.map((i) => i.documento).find(Boolean) ?? null;
  g.tels = [...new Set(g.itens.flatMap((i) => i.tels))];
  g.emails = [...new Set(g.itens.flatMap((i) => i.emails))];
}
console.log(`Depois de juntar duplicados do SicWeb: ${grupos.length} clientes (${todos.length - grupos.length} cadastros repetidos viram um só)`);

// ---------- 3. carregar o Control ----------
async function lerTudo(tabela, colunas) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from(tabela).select(colunas).range(de, de + 999);
    falhou(tabela, error);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
const clientesControl = await lerTudo('customers', 'id, name, person_type, document, email, phone, state_registration');
const contatosControl = await lerTudo('customer_contacts', 'customer_id, phone, email');
const enderecosControl = await lerTudo('customer_addresses', 'customer_id, active');
let codigosJaGravados = new Set();
const donoDoCodigo = new Map(); // código -> customer_id no Control (acompanha as uniões de cadastro)
const telsJaVindos = new Map(); // customer_id -> telefones que o SicWeb já tinha na importação anterior
{
  // O Supabase devolve no máximo 1000 linhas por consulta: lê em páginas (sem isso, códigos já gravados parecem novos)
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from('customer_sicweb_codes').select('codigo, customer_id, dados').order('codigo').range(de, de + 999);
    if (error) {
      if (GRAVAR) falhou('customer_sicweb_codes (aplique a migration 20261124100000 antes)', error);
      console.log('(aviso: tabela customer_sicweb_codes ainda não existe; simulação segue sem ela)');
      break;
    }
    for (const d of data) {
      codigosJaGravados.add(d.codigo);
      donoDoCodigo.set(d.codigo, d.customer_id);
      if (!telsJaVindos.has(d.customer_id)) telsJaVindos.set(d.customer_id, new Set());
      for (const t of telefones(d.dados?.telefone, d.dados?.celular)) telsJaVindos.get(d.customer_id).add(chaveTel(t));
    }
    if (data.length < 1000) break;
  }
}
console.log(`Control hoje: ${clientesControl.length} clientes`);

const ctlPorId = new Map(clientesControl.map((c) => [c.id, c]));
const ctlPorDoc = new Map(clientesControl.filter((c) => c.document).map((c) => [c.document, c]));
const ctlPorNome = new Map();
for (const c of clientesControl) {
  const k = chaveNome(c.name);
  if (!ctlPorNome.has(k)) ctlPorNome.set(k, []);
  ctlPorNome.get(k).push(c);
}
const telsDoCliente = new Map(); // id -> Set(chaveTel)
const emailsDoCliente = new Map();
const addTel = (id, tel) => {
  const t = normalizaTel(tel);
  if (!t) return;
  if (!telsDoCliente.has(id)) telsDoCliente.set(id, new Set());
  telsDoCliente.get(id).add(chaveTel(t));
};
for (const c of clientesControl) addTel(c.id, c.phone);
for (const k of contatosControl) addTel(k.customer_id, k.phone);
const ctlPorTel = new Map();
for (const [id, set] of telsDoCliente) for (const t of set) (ctlPorTel.get(t) ?? ctlPorTel.set(t, new Set()).get(t)).add(id);
const temEndereco = new Set(enderecosControl.filter((e) => e.active).map((e) => e.customer_id));
void emailsDoCliente;

// ---------- 4. decidir: já existe, novo ou revisar ----------
const ligar = []; // { g, cliente, motivo }
const novos = [];
const revisar = [];
for (const g of grupos) {
  const p = g.principal;
  const telsG = new Set(g.tels.map(chaveTel));
  const sobrepoe = (id) => [...(telsDoCliente.get(id) ?? [])].some((t) => telsG.has(t));
  let achado = null;
  let motivo = '';
  let duvida = null;

  const dono = [p, ...g.itens].map((i) => ctlPorId.get(donoDoCodigo.get(i.codigo))).find(Boolean);

  if (dono) {
    [achado, motivo] = [dono, 'código já importado'];
  } else if (g.documento && ctlPorDoc.has(g.documento)) {
    achado = ctlPorDoc.get(g.documento);
    motivo = 'documento';
  } else {
    const mesmoNome = ctlPorNome.get(chaveNome(p.nome)) ?? [];
    const comTel = mesmoNome.filter((c) => sobrepoe(c.id));
    if (comTel.length === 1) [achado, motivo] = [comTel[0], 'nome+telefone'];
    else if (comTel.length > 1) duvida = { motivo: 'vários clientes com o mesmo nome e telefone', cands: comTel };
    else if (mesmoNome.length === 1) {
      const conflitoDoc = g.documento && mesmoNome[0].document && mesmoNome[0].document !== g.documento;
      if (!conflitoDoc && tokens(p.nome).length >= 3) [achado, motivo] = [mesmoNome[0], 'nome único (3+ palavras)'];
      else duvida = { motivo: 'mesmo nome, telefone ou documento diferente', cands: mesmoNome };
    } else if (mesmoNome.length > 1) duvida = { motivo: 'vários clientes com o mesmo nome', cands: mesmoNome };
    else {
      const ids = new Set();
      for (const t of telsG) for (const id of ctlPorTel.get(t) ?? []) ids.add(id);
      const similares = [...ids].map((id) => ctlPorId.get(id)).filter((c) => parecidos(c.name, p.nome));
      if (similares.length === 1) [achado, motivo] = [similares[0], 'telefone+nome parecido'];
      else if (similares.length > 1) duvida = { motivo: 'telefone igual e nome parecido em vários clientes', cands: similares };
    }
  }

  if (achado) ligar.push({ g, cliente: achado, motivo });
  // Decisão do usuário (2026-11-24): cadastrar como está no SICNET e acertar depois. A dúvida vira cliente novo e
  // fica em revisar.csv (com os candidatos do Control) para unir cadastros depois, se for o caso.
  else if (duvida) {
    revisar.push({ g, ...duvida });
    novos.push(g);
  }
  else novos.push(g);
}

// ---------- 5. relatórios ----------
mkdirSync(SAIDA, { recursive: true });
const novosCodigos = (xs) => xs.filter((g) => g.itens.some((i) => !codigosJaGravados.has(i.codigo))).length;
writeFileSync(path.join(SAIDA, 'problemas.csv'), '﻿' + csv([['Linha (início)', 'Problema'], ...problemas]));
writeFileSync(
  path.join(SAIDA, 'revisar.csv'),
  '﻿' +
    csv([
      ['Código SicWeb', 'Nome no SicWeb', 'Telefones', 'Documento', 'Motivo', 'Candidatos no Control (nome | telefone)'],
      ...revisar.map((r) => [r.g.itens.map((i) => i.codigo).join(' '), r.g.principal.nome, r.g.tels.map(formatarTel).join(' / '), r.g.documento ?? '', r.motivo, r.cands.map((c) => `${c.name} | ${c.phone ?? ''}`).join(' ## ')]),
    ]),
);
writeFileSync(
  path.join(SAIDA, 'ligados.csv'),
  '﻿' + csv([['Código SicWeb', 'Nome no SicWeb', 'Cliente no Control', 'Como achou'], ...ligar.map((l) => [l.g.itens.map((i) => i.codigo).join(' '), l.g.principal.nome, l.cliente.name, l.motivo])]),
);
writeFileSync(
  path.join(SAIDA, 'novos.csv'),
  '﻿' + csv([['Código SicWeb', 'Nome', 'Tipo', 'Documento', 'Telefones', 'E-mail', 'Cidade'], ...novos.map((g) => [g.itens.map((i) => i.codigo).join(' '), g.principal.nome, g.principal.tipo, g.documento ?? '', g.tels.map(formatarTel).join(' / '), g.emails[0] ?? '', g.principal.endereco?.city ?? ''])]),
);
const invalidos = todos.filter((c) => c.docInvalido);
writeFileSync(path.join(SAIDA, 'documentos-invalidos.csv'), '﻿' + csv([['Código SicWeb', 'Nome', 'Documento como veio'], ...invalidos.map((c) => [c.codigo, c.nome, c.docInvalido])]));

const porMotivo = {};
for (const l of ligar) porMotivo[l.motivo] = (porMotivo[l.motivo] ?? 0) + 1;
const resumo = {
  lidos: lidos.length,
  linhasComProblema: problemas.length,
  clientesAposJuntarDuplicados: grupos.length,
  jaExistemNoControl: ligar.length,
  porMotivo,
  novos: novos.length,
  paraRevisar: revisar.length,
  documentosInvalidos: invalidos.length,
  semTelefone: grupos.filter((g) => g.tels.length === 0).length,
  semEndereco: grupos.filter((g) => !g.principal.endereco).length,
  cidadeInferidaComoNiteroi: grupos.filter((g) => g.principal.endereco?.cidadeInferida).length,
  codigosJaGravadosAntes: codigosJaGravados.size,
  gruposComCodigoNovo: novosCodigos(grupos),
};
writeFileSync(path.join(SAIDA, 'resumo.json'), JSON.stringify(resumo, null, 2));
console.log(resumo);

if (!GRAVAR) {
  console.log(`\nSIMULAÇÃO: nada foi gravado. Relatórios em ${SAIDA}\nPara gravar: node --env-file=.env scripts/sicweb/importar-clientes.mjs --gravar`);
  process.exit(0);
}

// ---------- 6. gravar ----------
async function inserir(tabela, linhas) {
  let n = 0;
  for (const lote of lotes(linhas)) {
    // Código do SicWeb repetido não é erro: se já está gravado, fica como está
    const { error } = tabela === 'customer_sicweb_codes' ? await sb.from(tabela).upsert(lote, { onConflict: 'codigo', ignoreDuplicates: true }) : await sb.from(tabela).insert(lote);
    falhou(tabela, error);
    n += lote.length;
    process.stdout.write(`\r  ${tabela}: ${n}/${linhas.length}   `);
  }
  if (linhas.length) process.stdout.write('\n');
}
const linhaCodigo = (i, customer_id) => ({ codigo: i.codigo, customer_id, cadastrado_em: i.cadastradoEm, dados: i.bruto });
const tipoTel = (d) => (d.length === 11 ? { role: 'Celular', is_whatsapp: true } : { role: 'Telefone fixo', is_whatsapp: false });

// 6a. clientes que já existem: guarda o código e preenche o que estava vazio
{
  const codigos = [];
  let preenchidos = 0;
  let contatosNovos = 0;
  let enderecosNovos = 0;
  const contatos = [];
  const enderecos = [];
  for (const { g, cliente } of ligar) {
    for (const i of g.itens) if (!codigosJaGravados.has(i.codigo)) codigos.push(linhaCodigo(i, cliente.id));
    const ajuste = {};
    if (!cliente.document && g.documento && !ctlPorDoc.has(g.documento) && cliente.person_type === (g.documento.length === 14 ? 'PJ' : 'PF')) {
      ajuste.document = g.documento;
      ctlPorDoc.set(g.documento, cliente);
    }
    if (!cliente.email && g.emails[0]) ajuste.email = g.emails[0];
    if (!cliente.state_registration && g.principal.inscricao) ajuste.state_registration = g.principal.inscricao;
    if (Object.keys(ajuste).length) {
      const { error } = await sb.from('customers').update(ajuste).eq('id', cliente.id);
      falhou('customers', error);
      preenchidos++;
    }
    const conhecidos = telsDoCliente.get(cliente.id) ?? new Set();
    for (const t of g.tels) {
      if (conhecidos.has(chaveTel(t)) || telsJaVindos.get(cliente.id)?.has(chaveTel(t))) continue;
      conhecidos.add(chaveTel(t));
      contatos.push({ customer_id: cliente.id, name: g.principal.nomeContato ?? cliente.name, phone: formatarTel(t), email: null, is_primary: false, ...tipoTel(t) });
      contatosNovos++;
    }
    const e = g.principal.endereco;
    if (e && !temEndereco.has(cliente.id)) {
      temEndereco.add(cliente.id);
      const { cidadeInferida, ...campos } = e;
      void cidadeInferida;
      enderecos.push({ customer_id: cliente.id, label: 'Principal', is_primary: true, ...campos });
      enderecosNovos++;
    }
  }
  await inserir('customer_contacts', contatos);
  await inserir('customer_addresses', enderecos);
  await inserir('customer_sicweb_codes', codigos);
  console.log(`Existentes: ${ligar.length} ligados, ${preenchidos} com campo preenchido, ${contatosNovos} telefones novos, ${enderecosNovos} endereços novos, ${codigos.length} códigos gravados.`);
}

// 6b. clientes novos
if (!SO_EXISTENTES) {
  const clientes = [];
  const enderecos = [];
  const contatos = [];
  const codigos = [];
  for (const g of novos) {
    if (g.itens.every((i) => codigosJaGravados.has(i.codigo))) continue;
    const p = g.principal;
    const id = randomUUID();
    clientes.push({
      id,
      person_type: g.documento ? (g.documento.length === 14 ? 'PJ' : 'PF') : p.tipo,
      name: p.nome,
      document: g.documento,
      state_registration: g.itens.map((i) => i.inscricao).find(Boolean) ?? null,
      notes: g.itens.map((i) => i.observacoes).find(Boolean) ?? null,
      created_at: p.cadastradoEm ? `${p.cadastradoEm}T12:00:00-03:00` : undefined,
    });
    if (p.endereco) {
      const { cidadeInferida, ...campos } = p.endereco;
      void cidadeInferida;
      enderecos.push({ customer_id: id, label: 'Principal', is_primary: true, ...campos });
    }
    const nomeContato = p.nomeContato ?? p.nome;
    g.tels.forEach((t, i) => contatos.push({ customer_id: id, name: nomeContato, phone: formatarTel(t), email: i === 0 ? (g.emails[0] ?? null) : null, is_primary: i === 0, ...tipoTel(t) }));
    if (g.tels.length === 0 && g.emails[0]) contatos.push({ customer_id: id, name: nomeContato, phone: null, email: g.emails[0], is_primary: true, role: 'E-mail', is_whatsapp: false });
    for (const i of g.itens) if (!codigosJaGravados.has(i.codigo)) codigos.push(linhaCodigo(i, id));
  }
  await inserir('customers', clientes);
  await inserir('customer_addresses', enderecos);
  await inserir('customer_contacts', contatos);
  await inserir('customer_sicweb_codes', codigos);
  console.log(`Novos: ${clientes.length} clientes, ${enderecos.length} endereços, ${contatos.length} contatos, ${codigos.length} códigos.`);
}
console.log('Pronto. Os clientes de saida/revisar.csv entraram como cadastro novo; dá para unir com o do Control depois.');
