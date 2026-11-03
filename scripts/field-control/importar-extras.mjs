// Importa o que faltou do Field Control: assinaturas e comentários (comentarios.ndjson / assinaturas.ndjson, de baixar-tudo.mjs).
//  1. baixa as imagens das assinaturas do S3 do Field para dados/assinaturas/ (antes de a conta do Field acabar);
//  2. envia para a HostGator por FTPS, em api/uploads/fc/<os>/ (mesma pasta das fotos da OS);
//  3. registra as assinaturas em public.attachments (categoria 'assinatura');
//  4. grava os comentários da equipe em public.service_order_comments.
// Retomável e idempotente (upsert por field_control_id). Não mexe em OS nem atividades.
//
// Uso:  node --env-file=.env scripts/field-control/importar-extras.mjs [--simular]
// Precisa: migration 20261103100000_comentarios_os.sql aplicada; no .env VITE_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, FTP_SERVER, FTP_USERNAME e FTP_PASSWORD (FTP_INSEGURO=1 como no enviar-fotos.mjs).
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { checkServerIdentity } from 'node:tls';
import { Client } from 'basic-ftp';
import { createClient } from '@supabase/supabase-js';

const PASTA = process.env.FC_PASTA || path.join(import.meta.dirname, 'dados');
const URL_FOTOS = (process.env.FC_URL_FOTOS || 'https://control.brvniteroi.com.br/api/uploads').replace(/\/+$/, '');
const DESTINO = (process.env.FC_FTP_DESTINO || 'api/uploads/fc').replace(/\/+$/, '');
const SIMULAR = process.argv.includes('--simular');
const { VITE_SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: CHAVE, FTP_SERVER, FTP_USERNAME, FTP_PASSWORD, FTP_INSEGURO } = process.env;
if (!URL || !CHAVE) {
  console.error('Falta VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.');
  process.exit(1);
}
if (!SIMULAR && (!FTP_SERVER || !FTP_USERNAME || !FTP_PASSWORD)) {
  console.error('Falta FTP_SERVER, FTP_USERNAME ou FTP_PASSWORD no .env.');
  process.exit(1);
}
const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });
const arq = (nome) => path.join(PASTA, nome);
// Igual ao importar.mjs: os ids do Field são base64 (podem ter / + =)
const seguro = (id) => createHash('sha1').update(id).digest('hex').slice(0, 16);
const limpo = (s) => (typeof s === 'string' && s.trim() ? s.trim() : null);
const nomePessoa = (s) => (limpo(s) === 'Jessica Moura' ? 'Jéssica Moura' : limpo(s));

const ler = async (nome) =>
  existsSync(arq(nome))
    ? (await readFile(arq(nome), 'utf8')).split('\n').filter(Boolean).flatMap((l) => {
        try {
          return [JSON.parse(l)];
        } catch {
          return [];
        }
      })
    : [];

async function gravar(tabela, linhas) {
  if (SIMULAR) return;
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await sb.from(tabela).upsert(linhas.slice(i, i + 500), { onConflict: 'field_control_id' });
    if (error) throw new Error(`${tabela}: ${error.message}`);
  }
}

// OS do Field -> id no banco
const osId = new Map();
for (let de = 0; ; de += 1000) {
  const { data, error } = await sb.from('service_orders').select('id, field_control_id').not('field_control_id', 'is', null).range(de, de + 999);
  if (error) throw new Error(`service_orders: ${error.message}`);
  for (const r of data) osId.set(r.field_control_id, r.id);
  if (data.length < 1000) break;
}
console.log(`${osId.size} OS do Field no banco.${SIMULAR ? '  (SIMULAÇÃO: nada será gravado nem enviado)' : ''}\n`);

// A mesma OS pode aparecer mais de uma vez no ndjson (rebaixada): vale a última linha
const porOS = (linhas, campo) => new Map(linhas.map((l) => [l.id, l[campo] ?? []]));

// ---------- assinaturas ----------
console.log('1. Assinaturas');
const assinaturas = [];
for (const [os, lista] of porOS(await ler('assinaturas.ndjson'), 'assinaturas')) {
  for (const a of lista) {
    if (!a.path) continue;
    // O id da assinatura no Field é o da própria OS: prefixo para não colidir com os anexos
    const fcId = `assinatura:${a.id}`;
    const nome = `${seguro(fcId)}.png`;
    assinaturas.push({ os, fcId, a, local: path.join('assinaturas', seguro(os), nome), remoto: `${seguro(os)}/${nome}` });
  }
}

let semArquivo = 0;
for (const [i, s] of assinaturas.entries()) {
  process.stdout.write(`\r  baixando ${i + 1}/${assinaturas.length}   `);
  if (existsSync(arq(s.local))) continue;
  try {
    const res = await fetch(s.a.path, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(path.dirname(arq(s.local)), { recursive: true });
    await writeFile(arq(s.local) + '.tmp', buf);
    await rename(arq(s.local) + '.tmp', arq(s.local));
  } catch (e) {
    semArquivo++;
    await appendFile(arq('assinaturas_erros.ndjson'), JSON.stringify({ os: s.os, url: s.a.path, erro: e.message }) + '\n');
  }
}
const baixadas = assinaturas.filter((s) => existsSync(arq(s.local)));
console.log(`\n  ${baixadas.length} baixadas${semArquivo ? `, ${semArquivo} sem arquivo no Field (em assinaturas_erros.ndjson)` : ''}`);

if (!SIMULAR && baixadas.length) {
  // A HostGator apresenta o certificado dela (*.hostgator.com.br): aceita os dois nomes (como no enviar-fotos.mjs)
  const conferirNome = (host, cert) => (checkServerIdentity(host, cert) === undefined ? undefined : checkServerIdentity('ftp.hostgator.com.br', cert));
  const enviadas = new Set((await ler('assinaturas_enviadas.ndjson')).map((e) => e.remoto));
  const fila = baixadas.filter((s) => !enviadas.has(s.remoto));
  if (fila.length) {
    const conectar = async () => {
      const c = new Client(60_000);
      await c.access({
        host: FTP_SERVER,
        user: FTP_USERNAME,
        password: FTP_PASSWORD,
        secure: true,
        secureOptions: FTP_INSEGURO === '1' ? { rejectUnauthorized: false } : { checkServerIdentity: conferirNome },
      });
      return c;
    };
    let c = await conectar();
    for (const [i, s] of fila.entries()) {
      process.stdout.write(`\r  enviando ${i + 1}/${fila.length}   `);
      const [pasta, nome] = s.remoto.split('/');
      for (let tentativa = 1; ; tentativa++) {
        try {
          await c.ensureDir(`/${DESTINO}/${pasta}`);
          await c.uploadFrom(arq(s.local), nome);
          break;
        } catch (e) {
          if (tentativa >= 4) throw e;
          // Conexão caiu (a HostGator derruba de vez em quando): reconecta e tenta de novo
          c.close();
          await new Promise((r) => setTimeout(r, 3000 * tentativa));
          c = await conectar().catch(() => c);
        }
      }
      await appendFile(arq('assinaturas_enviadas.ndjson'), JSON.stringify({ remoto: s.remoto }) + '\n');
    }
    c.close();
    console.log();
  }
}

{
  const linhas = [];
  for (const s of baixadas) {
    if (!osId.has(s.os)) continue;
    const bytes = (await readFile(arq(s.local))).length;
    const caminho = `fc/${s.remoto}`;
    linhas.push({
      service_order_id: osId.get(s.os),
      storage: 'hostgator',
      storage_path: caminho,
      public_url: `${URL_FOTOS}/${caminho}`,
      file_name: s.a.path.split('/').pop().slice(0, 150),
      mime_type: 'image/png',
      size_bytes: bytes,
      category: 'assinatura',
      caption: limpo(s.a.name) ? `Assinatura de ${limpo(s.a.name)}` : 'Assinatura do cliente',
      field_control_id: s.fcId,
      created_at: s.a.createdAt,
    });
  }
  await gravar('attachments', linhas);
  console.log(`  ${linhas.length} assinaturas registradas nas OS`);
}

// ---------- comentários ----------
console.log('2. Comentários');
{
  const linhas = [];
  let arquivados = 0;
  for (const [os, lista] of porOS(await ler('comentarios.ndjson'), 'comentarios')) {
    if (!osId.has(os)) continue;
    for (const c of lista) {
      const texto = limpo(c.message);
      if (!texto) continue;
      if (c.archived) {
        arquivados++; // apagado no Field
        continue;
      }
      linhas.push({
        service_order_id: osId.get(os),
        author_name: nomePessoa(c.postedBy?.name),
        message: texto.slice(0, 4000),
        field_control_id: c.id,
        created_at: c.createdAt,
      });
    }
  }
  await gravar('service_order_comments', linhas);
  console.log(`  ${linhas.length} comentários${arquivados ? ` (${arquivados} apagados no Field ficaram de fora)` : ''}`);
}

console.log(`\n${SIMULAR ? 'Simulação concluída.' : 'Pronto.'}`);
