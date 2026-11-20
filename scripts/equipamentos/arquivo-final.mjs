// Arquivo final do BRV Equipamentos antes de pausar/apagar o projeto no Supabase (plano de 2026-11-19).
// Baixa TODAS as tabelas expostas pela API (JSON, uma por arquivo) e TODOS os arquivos do Storage, preservando as pastas,
// e grava um LEIA-ME.json com as contagens. Só lê o Equipamentos; não grava nada em banco nenhum.
//
// Uso (no PC da empresa, para cair na pasta sincronizada com o Google Drive):
//   node scripts/equipamentos/arquivo-final.mjs --simular   (só conta tabelas e arquivos)
//   node scripts/equipamentos/arquivo-final.mjs             (baixa tudo)
// Precisa no .env: EQUIP_SERVICE_ROLE_KEY. Opcionais: EQUIP_SUPABASE_URL, BACKUP_PASTA (padrão D:/backups-brv).
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
try { process.loadEnvFile(join(raiz, '.env')); } catch { /* sem .env: usa o ambiente */ }

const URL = process.env.EQUIP_SUPABASE_URL || 'https://tnsmwpewdkdigwjyaufr.supabase.co';
const CHAVE = process.env.EQUIP_SERVICE_ROLE_KEY;
if (!CHAVE) {
  console.error('Falta EQUIP_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}
const simular = process.argv.includes('--simular');
const dia = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD no horário local
const destino = join(process.env.BACKUP_PASTA || 'D:/backups-brv', `equipamentos-final-${dia}`);
const eq = createClient(URL, CHAVE, { auth: { persistSession: false } });

const resumo = { origem: URL, gerado_em: new Date().toISOString(), tabelas: {}, storage: {}, falhas: [] };

// 1. Tabelas: a lista vem da própria API (as que o PostgREST expõe no schema public)
const api = await fetch(`${URL}/rest/v1/`, { headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` } }).then((r) => r.json());
const tabelas = Object.keys(api.definitions ?? {}).sort();
console.log(`${tabelas.length} tabelas/visões`);
for (const t of tabelas) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await eq.from(t).select('*').range(de, de + 999);
    if (error) {
      resumo.falhas.push(`tabela ${t}: ${error.message}`);
      break;
    }
    linhas.push(...data);
    if (data.length < 1000) break;
  }
  resumo.tabelas[t] = linhas.length;
  console.log(`  ${t}: ${linhas.length}`);
  if (!simular) {
    mkdirSync(join(destino, 'tabelas'), { recursive: true });
    writeFileSync(join(destino, 'tabelas', `${t}.json`), JSON.stringify(linhas, null, 1));
  }
}

// 2. Storage: todos os buckets, recursivo
async function listar(bucket, pasta = '') {
  const itens = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await eq.storage.from(bucket).list(pasta, { limit: 1000, offset: off });
    if (error) {
      resumo.falhas.push(`listar ${bucket}/${pasta}: ${error.message}`);
      break;
    }
    for (const o of data) {
      const caminho = pasta ? `${pasta}/${o.name}` : o.name;
      if (o.id === null) itens.push(...(await listar(bucket, caminho)));
      else itens.push({ caminho, bytes: o.metadata?.size ?? 0 });
    }
    if (data.length < 1000) break;
  }
  return itens;
}

const { data: buckets, error: erroBuckets } = await eq.storage.listBuckets();
if (erroBuckets) resumo.falhas.push(`buckets: ${erroBuckets.message}`);
for (const b of buckets ?? []) {
  const arquivos = await listar(b.name);
  const total = arquivos.reduce((s, a) => s + a.bytes, 0);
  console.log(`bucket ${b.name}: ${arquivos.length} arquivos, ${(total / 1048576).toFixed(1)} MB`);
  resumo.storage[b.name] = { arquivos: arquivos.length, megabytes: Number((total / 1048576).toFixed(1)), lista: [] };
  if (simular) continue;
  let n = 0;
  for (const a of arquivos) {
    const { data, error } = await eq.storage.from(b.name).download(a.caminho);
    if (error || !data) {
      resumo.falhas.push(`baixar ${b.name}/${a.caminho}: ${error?.message ?? 'vazio'}`);
      continue;
    }
    const conteudo = Buffer.from(await data.arrayBuffer());
    const local = join(destino, 'storage', b.name, ...a.caminho.split('/'));
    mkdirSync(dirname(local), { recursive: true });
    writeFileSync(local, conteudo);
    resumo.storage[b.name].lista.push({ caminho: a.caminho, bytes: conteudo.length, sha256: createHash('sha256').update(conteudo).digest('hex') });
    n += 1;
    if (n % 10 === 0) console.log(`  ${n}/${arquivos.length}`);
  }
  console.log(`  baixados: ${n}/${arquivos.length}`);
}

if (!simular) {
  mkdirSync(destino, { recursive: true });
  writeFileSync(join(destino, 'LEIA-ME.json'), JSON.stringify(resumo, null, 1));
}
console.log(resumo.falhas.length ? `\nTERMINOU COM ${resumo.falhas.length} FALHA(S):\n${resumo.falhas.join('\n')}` : '\nTERMINOU SEM FALHAS');
console.log(simular ? 'Simulação: nada foi baixado.' : `Arquivo em: ${destino}`);
process.exit(resumo.falhas.length ? 1 : 0);
