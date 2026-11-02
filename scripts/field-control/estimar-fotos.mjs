// Estima o espaço das fotos do Field Control (SOMENTE LEITURA, não baixa arquivos).
// Sorteia OS, conta os anexos de cada uma e pede ao servidor só o tamanho de parte deles (HEAD).
//
// Uso:  node --env-file=.env scripts/field-control/estimar-fotos.mjs [qtd_os=60]
// Precisa de FIELD_CONTROL_API_KEY no .env.
const BASE = 'https://carchost.fieldcontrol.com.br';
const CHAVE = process.env.FIELD_CONTROL_API_KEY;
const INTERVALO_MS = 1100; // a API aceita 1 requisição por segundo
const QTD_OS = Number(process.argv[2]) || 60;
const MAX_HEAD = 150; // anexos medidos (o HEAD vai para o S3, fora do limite da API)

if (!CHAVE) {
  console.error('Falta FIELD_CONTROL_API_KEY no .env.');
  process.exit(1);
}

let ultima = 0;
async function get(caminho, tentativas = 4) {
  const espera = ultima + INTERVALO_MS - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultima = Date.now();
  const res = await fetch(BASE + caminho, {
    headers: { 'X-Api-Key': CHAVE, 'Content-Type': 'application/json;charset=UTF-8', 'User-Agent': 'brv-control-importacao/1.0' },
  });
  if (res.status === 429 && tentativas > 0) {
    await new Promise((r) => setTimeout(r, 3000));
    return get(caminho, tentativas - 1);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} em ${caminho.split('?')[0]}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Todos os anexos de uma OS (paginado). */
async function anexosDa(osId) {
  const itens = [];
  for (let offset = 0; ; offset += 100) {
    const p = await get(`/orders/${encodeURIComponent(osId)}/attachments?limit=100&offset=${offset}`);
    if (!p) break;
    itens.push(...p.items);
    if (itens.length >= p.totalCount || p.items.length < 100) break;
  }
  return itens;
}

/** Tamanho em bytes pelo Content-Length; se o HEAD não for aceito, tenta GET só do 1º byte. */
async function tamanho(url) {
  try {
    const h = await fetch(url, { method: 'HEAD' });
    const n = Number(h.headers.get('content-length'));
    if (h.ok && n > 0) return n;
    const g = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    const total = Number(g.headers.get('content-range')?.split('/')[1]);
    await g.body?.cancel();
    return total > 0 ? total : null;
  } catch {
    return null;
  }
}

const mb = (b) => b / 1024 / 1024;
const fmt = (b) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${mb(b).toFixed(1)} MB`);
const media = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const desvio = (xs) => Math.sqrt(media(xs.map((x) => (x - media(xs)) ** 2)));

// 1) Total de OS
const primeira = await get('/orders?limit=1');
const totalOS = primeira.totalCount;
console.log(`Total de OS no Field Control: ${totalOS}`);

// 2) Sorteio: páginas de 100 em posições aleatórias, depois escolhe QTD_OS entre elas
const paginas = Math.min(5, Math.ceil(totalOS / 100));
const offsets = new Set();
while (offsets.size < paginas) offsets.add(Math.floor(Math.random() * Math.ceil(totalOS / 100)) * 100);
const candidatas = [];
for (const off of offsets) candidatas.push(...((await get(`/orders?limit=100&offset=${off}`))?.items ?? []));
const sorteadas = candidatas.sort(() => Math.random() - 0.5).slice(0, QTD_OS);
console.log(`Contando anexos de ${sorteadas.length} OS sorteadas (~${sorteadas.length} s)...`);

// 3) Anexos por OS
const porOS = [];
const anexos = [];
for (const os of sorteadas) {
  const a = await anexosDa(os.id);
  porOS.push(a.length);
  anexos.push(...a.filter((x) => x.path));
  process.stdout.write('.');
}
console.log();

// 4) Tamanho de parte dos anexos (5 por vez)
const medir = anexos.sort(() => Math.random() - 0.5).slice(0, MAX_HEAD);
const tamanhos = [];
const extensoes = {};
for (let i = 0; i < medir.length; i += 5) {
  const lote = medir.slice(i, i + 5);
  const r = await Promise.all(lote.map((x) => tamanho(x.path)));
  r.forEach((n, j) => {
    if (n) tamanhos.push(n);
    const ext = lote[j].path.split('?')[0].split('.').pop().toLowerCase();
    extensoes[ext] = (extensoes[ext] ?? 0) + 1;
  });
}

// 5) Estimativa
const anexosPorOS = media(porOS);
const totalAnexos = anexosPorOS * totalOS;
console.log('\n===== Resultado =====');
console.log(`OS sorteadas: ${porOS.length} | sem nenhum anexo: ${porOS.filter((n) => n === 0).length} | máximo numa OS: ${Math.max(...porOS)}`);
console.log(`Anexos por OS: média ${anexosPorOS.toFixed(1)}`);
console.log(`Anexos estimados no total: ~${Math.round(totalAnexos)}`);
console.log(`Tipos de arquivo (amostra): ${JSON.stringify(extensoes)}`);
if (tamanhos.length === 0) {
  console.log('Não foi possível obter o tamanho dos arquivos (o servidor não informou).');
  if (medir[0]) console.log(`Exemplo de link: ${medir[0].path.split('?')[0]}`);
  process.exit(0);
}
const tm = media(tamanhos);
const ord = [...tamanhos].sort((a, b) => a - b);
console.log(`Arquivos medidos: ${tamanhos.length} | médio ${fmt(tm)} | mediana ${fmt(ord[Math.floor(ord.length / 2)])} | menor ${fmt(ord[0])} | maior ${fmt(ord.at(-1))}`);

// Margem aproximada (95%) combinando a incerteza da contagem por OS e do tamanho médio
const erroAnexos = (1.96 * desvio(porOS)) / Math.sqrt(porOS.length) / anexosPorOS;
const erroTam = (1.96 * desvio(tamanhos)) / Math.sqrt(tamanhos.length) / tm;
const erro = Math.sqrt(erroAnexos ** 2 + erroTam ** 2);
const total = totalAnexos * tm;
console.log(`\nESPAÇO ESTIMADO: ~${fmt(total)}  (faixa provável ${fmt(total * Math.max(0, 1 - erro))} a ${fmt(total * (1 + erro))})`);
