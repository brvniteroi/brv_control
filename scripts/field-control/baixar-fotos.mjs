// Baixa os arquivos dos anexos listados em anexos.ndjson (gerado por baixar-tudo.mjs, etapa "anexos").
// Pode rodar em paralelo com o baixar-tudo: os arquivos vêm do S3 do Field, fora do limite da API.
// Retomável: arquivo já baixado (com o tamanho certo) é pulado. Rode de novo quando a etapa "anexos" avançar.
//
// Uso:  node --env-file=.env scripts/field-control/baixar-fotos.mjs [simultaneos=6]
// Saída: <pasta>/fotos/<id da OS>/<id do anexo>.<ext> e fotos.ndjson (anexo -> arquivo, bytes).
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const PASTA = process.env.FC_PASTA || path.join(import.meta.dirname, 'dados');
const SIMULTANEOS = Number(process.argv[2]) || 6;
const arq = (nome) => path.join(PASTA, nome);

if (!existsSync(arq('anexos.ndjson'))) {
  console.error(`Não achei ${arq('anexos.ndjson')}. Rode antes: baixar-tudo.mjs anexos`);
  process.exit(1);
}

const linhas = (await readFile(arq('anexos.ndjson'), 'utf8')).split('\n').filter(Boolean).flatMap((l) => {
  try {
    return [JSON.parse(l)];
  } catch {
    return [];
  }
});

const feitos = new Set();
if (existsSync(arq('fotos.ndjson'))) {
  for (const l of (await readFile(arq('fotos.ndjson'), 'utf8')).split('\n').filter(Boolean)) {
    try {
      feitos.add(JSON.parse(l).anexo);
    } catch {}
  }
}

// Nome de pasta/arquivo seguro: os ids do Field são base64 (podem ter / + =)
const seguro = (id) => createHash('sha1').update(id).digest('hex').slice(0, 16);

const fila = [];
for (const { id: os, anexos } of linhas) {
  for (const a of anexos ?? []) {
    // A mesma OS pode aparecer de novo no anexos.ndjson (rebaixada com FC_REFAZER_DESDE)
    if (!a.path || feitos.has(a.id)) continue;
    feitos.add(a.id);
    const ext = (a.path.split('?')[0].split('.').pop() || 'bin').toLowerCase().slice(0, 5);
    fila.push({ os, anexo: a.id, url: a.path, rel: path.join('fotos', seguro(os), `${seguro(a.id)}.${ext}`) });
  }
}
console.log(`${feitos.size} já baixados, ${fila.length} na fila (${SIMULTANEOS} simultâneos). Pasta: ${PASTA}`);

let ok = 0;
let falhas = 0;
let bytes = 0;
const inicio = Date.now();

async function baixar(item) {
  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    try {
      const res = await fetch(item.url, { signal: AbortSignal.timeout(120_000) });
      if (res.status === 403 || res.status === 404) throw Object.assign(new Error(`HTTP ${res.status}`), { definitivo: true });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const destino = arq(item.rel);
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino + '.tmp', buf);
      await rename(destino + '.tmp', destino);
      await appendFile(arq('fotos.ndjson'), JSON.stringify({ os: item.os, anexo: item.anexo, arquivo: item.rel, bytes: buf.length }) + '\n');
      bytes += buf.length;
      ok++;
      return;
    } catch (e) {
      if (e.definitivo || tentativa === 5) {
        falhas++;
        await appendFile(arq('fotos_erros.ndjson'), JSON.stringify({ ...item, erro: e.message, em: new Date().toISOString() }) + '\n');
        return;
      }
      await new Promise((r) => setTimeout(r, 2000 * tentativa));
    }
  }
}

let proximo = 0;
const mostrar = setInterval(() => {
  const s = (Date.now() - inicio) / 1000;
  const feitosAgora = ok + falhas;
  const resta = feitosAgora ? ((fila.length - feitosAgora) * s) / feitosAgora / 60 : 0;
  process.stdout.write(`\rfotos: ${feitosAgora}/${fila.length}  falhas ${falhas}  ${(bytes / 1024 ** 3).toFixed(2)} GB  (faltam ~${Math.round(resta)} min)   `);
}, 2000);

await Promise.all(
  Array.from({ length: SIMULTANEOS }, async () => {
    while (proximo < fila.length) await baixar(fila[proximo++]);
  }),
);
clearInterval(mostrar);
console.log(`\nPronto: ${ok} baixadas, ${falhas} falhas (em fotos_erros.ndjson; rode de novo para tentar outra vez).`);
