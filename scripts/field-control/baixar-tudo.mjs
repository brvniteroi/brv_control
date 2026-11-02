// Backup completo do Field Control (SOMENTE LEITURA). Retomável: pode interromper (Ctrl+C)
// e rodar de novo, que continua de onde parou. Não baixa as fotos (ver baixar-fotos.mjs).
//
// Uso:  node --env-file=.env scripts/field-control/baixar-tudo.mjs [etapa]
//   sem etapa = todas, em ordem. Etapas: listas, anexos, formularios, clientes, comentarios, assinaturas
// Pasta: scripts/field-control/dados/ (ou FC_PASTA no .env). Dados reais de clientes: nunca vão para o git.
//
// Conforme a documentação (API_field_control.docx): 1 requisição por segundo, no máximo 100 itens
// por página (offset até 200000), cabeçalhos X-Api-Key e User-Agent obrigatórios, 429 = limite excedido.
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://carchost.fieldcontrol.com.br';
const CHAVE = process.env.FIELD_CONTROL_API_KEY;
const PASTA = process.env.FC_PASTA || path.join(import.meta.dirname, 'dados');
const INTERVALO_MS = 1100;

if (!CHAVE) {
  console.error('Falta FIELD_CONTROL_API_KEY no .env.');
  process.exit(1);
}

// ---------- HTTP ----------
let ultima = 0;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET com o ritmo da API. Erros de rede, 429 e 5xx são repetidos com espera crescente. */
async function get(caminho) {
  for (let tentativa = 1; ; tentativa++) {
    const espera = ultima + INTERVALO_MS - Date.now();
    if (espera > 0) await dormir(espera);
    ultima = Date.now();
    let res;
    try {
      res = await fetch(BASE + caminho, {
        headers: { 'X-Api-Key': CHAVE, 'Content-Type': 'application/json;charset=UTF-8', 'User-Agent': 'brv-control-backup/1.0' },
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      if (tentativa >= 8) throw new Error(`rede em ${caminho}: ${e.message}`);
      await dormir(Math.min(60_000, 2000 * tentativa));
      continue;
    }
    if (res.status === 401) {
      console.error('\n401: a chave da API foi recusada (assinatura vencida ou chave revogada?). Parando.');
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

/** Todas as páginas de uma listagem (100 por página). */
async function listarTudo(caminho, aoPaginar) {
  const itens = [];
  const sep = caminho.includes('?') ? '&' : '?';
  for (let offset = 0; ; offset += 100) {
    const p = await get(`${caminho}${sep}limit=100&offset=${offset}`);
    if (!p) break;
    itens.push(...p.items);
    aoPaginar?.(itens.length, p.totalCount);
    if (p.items.length < 100 || itens.length >= p.totalCount) break;
  }
  return itens;
}

// ---------- Arquivos ----------
const arq = (nome) => path.join(PASTA, nome);

async function salvarJson(nome, dados) {
  const tmp = arq(nome + '.tmp');
  await writeFile(tmp, JSON.stringify(dados));
  await rename(tmp, arq(nome));
}

async function lerNdjson(nome) {
  if (!existsSync(arq(nome))) return [];
  const texto = await readFile(arq(nome), 'utf8');
  return texto.split('\n').filter(Boolean).flatMap((l) => {
    try {
      return [JSON.parse(l)];
    } catch {
      return []; // linha cortada por uma interrupção: será baixada de novo
    }
  });
}

const erro = (etapa, id, e) =>
  appendFile(arq('erros.ndjson'), JSON.stringify({ etapa, id, erro: e.message, em: new Date().toISOString() }) + '\n');

function progresso(rotulo, feito, total, inicio) {
  const s = (Date.now() - inicio) / 1000;
  const resta = feito > 0 ? ((total - feito) * s) / feito : 0;
  const h = Math.floor(resta / 3600);
  const m = Math.round((resta % 3600) / 60);
  process.stdout.write(`\r${rotulo}: ${feito}/${total}  (faltam ~${h}h${String(m).padStart(2, '0')})   `);
}

// ---------- Etapa 1: listas globais ----------
// Cada lista vira um arquivo JSON. Uma lista já salva não é baixada de novo
// (para atualizar, apague o arquivo dela).
const LISTAS = [
  ['tipos_os', '/services'],
  ['colaboradores', '/employees'],
  ['tipos_equipamento', '/equipment-types'],
  ['etiquetas', '/labels'],
  ['clientes', '/customers'],
  ['clientes_campos', '/customers/custom-fields'],
  ['equipamentos', '/equipments'],
  ['ordens', '/orders?sort=created_at'],
  ['atividades', '/tasks?sort=created_at'],
  ['formularios_respostas', '/forms-answers'],
  ['solicitacoes', '/tickets'],
  ['orcamentos', '/quotations'],
  ['avaliacoes', '/ratings'],
  ['produtos_servicos', '/products-services'],
  ['materiais', '/materials'],
];

async function etapaListas() {
  for (const [nome, caminho] of LISTAS) {
    if (existsSync(arq(`${nome}.json`))) {
      console.log(`${nome}: já baixado`);
      continue;
    }
    const inicio = Date.now();
    try {
      const itens = await listarTudo(caminho, (n, t) => progresso(nome, n, t, inicio));
      await salvarJson(`${nome}.json`, itens);
      console.log(`\r${nome}: ${itens.length} registros                    `);
    } catch (e) {
      console.log(`\n${nome}: ERRO ${e.message}`);
      await erro('listas', nome, e);
    }
  }
}

// ---------- Etapas por item (uma requisição paginada por OS ou cliente) ----------
// Resultado em NDJSON (uma linha por OS/cliente), gravado na hora: interrompeu, continua.
async function porItem({ etapa, fonte, arquivo, caminhos, unico = false }) {
  if (!existsSync(arq(`${fonte}.json`))) {
    console.log(`${etapa}: falta ${fonte}.json (rode a etapa "listas" antes)`);
    return;
  }
  const todos = JSON.parse(await readFile(arq(`${fonte}.json`), 'utf8'));
  const feitos = new Set((await lerNdjson(arquivo)).map((l) => l.id));
  const faltam = todos.filter((x) => !feitos.has(x.id));
  console.log(`${etapa}: ${feitos.size} já feitos, ${faltam.length} a fazer`);
  const inicio = Date.now();
  let n = 0;
  for (const item of faltam) {
    try {
      const linha = { id: item.id };
      for (const [chave, montar] of Object.entries(caminhos)) {
        const caminho = montar(encodeURIComponent(item.id));
        linha[chave] = unico ? await get(caminho) : await listarTudo(caminho);
      }
      await appendFile(arq(arquivo), JSON.stringify(linha) + '\n');
    } catch (e) {
      await erro(etapa, item.id, e);
    }
    progresso(etapa, ++n, faltam.length, inicio);
  }
  if (faltam.length) console.log();
}

const ETAPAS = {
  listas: etapaListas,
  // Prioridade: as fotos ficam no S3 do Field e somem com a conta
  anexos: () => porItem({ etapa: 'anexos', fonte: 'ordens', arquivo: 'anexos.ndjson', caminhos: { anexos: (id) => `/orders/${id}/attachments` } }),
  // A listagem de /forms-answers não traz as perguntas e respostas; só o detalhe de cada uma
  formularios: () =>
    porItem({ etapa: 'formularios', fonte: 'formularios_respostas', arquivo: 'formularios_detalhes.ndjson', unico: true, caminhos: { resposta: (id) => `/forms-answers/${id}` } }),
  clientes: () =>
    porItem({
      etapa: 'clientes',
      fonte: 'clientes',
      arquivo: 'clientes_detalhes.ndjson',
      caminhos: {
        localizacoes: (id) => `/customers/${id}/locations`,
        telefones: (id) => `/customers/${id}/phones`,
        emails: (id) => `/customers/${id}/emails`,
      },
    }),
  comentarios: () => porItem({ etapa: 'comentarios', fonte: 'ordens', arquivo: 'comentarios.ndjson', caminhos: { comentarios: (id) => `/orders/${id}/comments` } }),
  assinaturas: () => porItem({ etapa: 'assinaturas', fonte: 'ordens', arquivo: 'assinaturas.ndjson', caminhos: { assinaturas: (id) => `/orders/${id}/signatures` } }),
};

const pedida = process.argv[2];
if (pedida && !ETAPAS[pedida]) {
  console.error(`Etapa desconhecida: ${pedida}. Use: ${Object.keys(ETAPAS).join(', ')}`);
  process.exit(1);
}
await mkdir(PASTA, { recursive: true });
console.log(`Backup em ${PASTA}\n`);
for (const [nome, fn] of Object.entries(ETAPAS)) {
  if (pedida && nome !== pedida) continue;
  console.log(`== ${nome} (${new Date().toLocaleString('pt-BR')})`);
  await fn();
}
console.log(`\nConcluído em ${new Date().toLocaleString('pt-BR')}. Erros (se houver) em ${arq('erros.ndjson')}; rode de novo para tentar outra vez.`);
