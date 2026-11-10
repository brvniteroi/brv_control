// Troca as "fotos" falsas da Oficina (545 bytes: era a página inicial do site antigo salva como .jpg) pelas
// originais, a partir de uma cópia da pasta `uploads` do sistema antigo (cPanel: brv_equipamentos/uploads).
//
// Como usar:
//   1. No cPanel (File Manager), compacte a pasta `brv_equipamentos/uploads` em .zip, baixe e extraia em
//      scripts/equipamentos/dados/uploads-antigos  (deve ficar dados/uploads-antigos/eq_50/midia_...jpg)
//   2. node --env-file=.env scripts/equipamentos/recuperar-fotos-oficina.mjs --simular   (só confere o que acharia)
//   3. node --env-file=.env scripts/equipamentos/recuperar-fotos-oficina.mjs             (envia por FTPS e corrige size_bytes)
// Opcional: --pasta=<caminho> se extraiu em outro lugar. Repetível: só mexe nos arquivos que ainda têm 545 bytes.

import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { checkServerIdentity } from 'node:tls';
import { Client as Ftp } from 'basic-ftp';
import { createClient } from '@supabase/supabase-js';

const SIMULAR = process.argv.includes('--simular');
const argPasta = process.argv.find((a) => a.startsWith('--pasta='))?.slice(8);
const PASTA = argPasta || path.join(import.meta.dirname, 'dados', 'uploads-antigos');
const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EQUIP_SERVICE_ROLE_KEY, FTP_SERVER, FTP_USERNAME, FTP_PASSWORD, FTP_INSEGURO } = process.env;
const EQUIP_SUPABASE_URL = process.env.EQUIP_SUPABASE_URL || 'https://tnsmwpewdkdigwjyaufr.supabase.co';
const TAMANHO_FALSO = 545;

for (const [nome, valor] of Object.entries({ VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EQUIP_SERVICE_ROLE_KEY })) {
  if (!valor) { console.error(`Falta ${nome} no .env.`); process.exit(1); }
}
if (!fs.existsSync(PASTA)) { console.error(`Pasta não encontrada: ${PASTA}`); process.exit(1); }
if (!SIMULAR && (!FTP_SERVER || !FTP_USERNAME || !FTP_PASSWORD)) { console.error('Falta FTP_SERVER, FTP_USERNAME ou FTP_PASSWORD no .env.'); process.exit(1); }

const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
const control = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opcoes);
const antigo = createClient(EQUIP_SUPABASE_URL, EQUIP_SERVICE_ROLE_KEY, opcoes);

// Índice de todos os arquivos da cópia: caminho relativo (minúsculo, com "/") → caminho real
const indice = new Map();
(function varrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) varrer(p);
    else indice.set(path.relative(PASTA, p).split(path.sep).join('/').toLowerCase(), p);
  }
})(PASTA);
console.log(`Arquivos na cópia: ${indice.size}`);

const { data: falsas, error } = await control.from('attachments').select('id, storage_path, workshop_order_id')
  .like('storage_path', 'oficina/%').eq('size_bytes', TAMANHO_FALSO);
if (error) throw new Error(error.message);

const { data: midias, error: e2 } = await antigo.from('midias').select('id, caminho');
if (e2) throw new Error(e2.message);
const caminhoDaMidia = new Map(midias.map((m) => [String(m.id), String(m.caminho ?? '')]));

function acharOriginal(caminhoAntigo) {
  const rel = caminhoAntigo.replace(/^\/+/, '').replace(/^uploads\//i, '').toLowerCase();
  if (indice.has(rel)) return indice.get(rel);
  // última tentativa: só o nome do arquivo (se for único na cópia)
  const nome = rel.split('/').pop();
  const iguais = [...indice.entries()].filter(([k]) => k.split('/').pop() === nome);
  return iguais.length === 1 ? iguais[0][1] : null;
}

const achadas = [];
const faltando = [];
for (const a of falsas) {
  const idMidia = a.storage_path.split('/').pop().replace(/\.[^.]+$/, '');
  const caminhoAntigo = caminhoDaMidia.get(idMidia);
  const arquivo = caminhoAntigo ? acharOriginal(caminhoAntigo) : null;
  if (arquivo && fs.statSync(arquivo).size > TAMANHO_FALSO) achadas.push({ ...a, arquivo });
  else faltando.push(`${a.storage_path}  (antigo: ${caminhoAntigo || 'sem registro em midias'})`);
}
console.log(`Fotos falsas: ${falsas.length}. Com original na cópia: ${achadas.length}. Sem original: ${faltando.length}.`);
if (faltando.length) console.log('Sem original:\n  ' + faltando.slice(0, 30).join('\n  ') + (faltando.length > 30 ? `\n  ... e mais ${faltando.length - 30}` : ''));
if (SIMULAR || !achadas.length) { console.log(SIMULAR ? '(--simular: nada foi alterado)' : 'Nada a enviar.'); process.exit(0); }

const conferirNome = (host, cert) => (checkServerIdentity(host, cert) === undefined ? undefined : checkServerIdentity('ftp.hostgator.com.br', cert));
const conectar = async () => {
  const c = new Ftp(120_000);
  await c.access({ host: FTP_SERVER, user: FTP_USERNAME, password: FTP_PASSWORD, secure: true,
    secureOptions: FTP_INSEGURO === '1' ? { rejectUnauthorized: false } : { checkServerIdentity: conferirNome } });
  return c;
};
let ftp = await conectar();
let ok = 0;
const falhas = [];
for (const a of achadas) {
  const corpo = fs.readFileSync(a.arquivo);
  const pasta = '/api/uploads/' + path.posix.dirname(a.storage_path);
  const nome = path.posix.basename(a.storage_path);
  try {
    for (let t = 1; ; t++) {
      try { await ftp.ensureDir(pasta); await ftp.uploadFrom(Readable.from(corpo), nome); break; }
      catch (e) { if (t >= 4) throw e; ftp.close(); await new Promise((r) => setTimeout(r, 3000 * t)); ftp = await conectar().catch(() => ftp); }
    }
    const { error: eu } = await control.from('attachments').update({ size_bytes: corpo.length }).eq('id', a.id);
    if (eu) throw new Error(eu.message);
    ok++;
    process.stdout.write(`\r  recuperadas: ${ok}/${achadas.length}   `);
  } catch (e) {
    falhas.push(`${a.storage_path}: ${e.message}`);
  }
}
ftp.close();
console.log(`\nPronto: ${ok} recuperadas, ${falhas.length} com falha.`);
if (falhas.length) console.log(falhas.join('\n'));
