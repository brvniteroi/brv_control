// Envia as fotos do backup (dados/fotos/) para a HostGator por FTPS, em api/uploads/fc/.
// Retomável: o que já subiu fica anotado em dados/fotos_enviadas.ndjson e é pulado.
//
// Uso:  node --env-file=.env scripts/field-control/enviar-fotos.mjs [conexoes=4]
// Precisa no .env: FTP_SERVER, FTP_USERNAME, FTP_PASSWORD (os mesmos dos secrets do deploy).
// A conta FTP é presa à pasta do subdomínio: a raiz dela é a raiz do app (FC_FTP_DESTINO muda o destino).
// Último recurso se o certificado for recusado: FTP_INSEGURO=1 no .env (continua criptografado, sem conferir o certificado).
import { appendFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { checkServerIdentity } from 'node:tls';
import { Client } from 'basic-ftp';

const PASTA = process.env.FC_PASTA || path.join(import.meta.dirname, 'dados');
const DESTINO = (process.env.FC_FTP_DESTINO || 'api/uploads/fc').replace(/\/+$/, '');
const CONEXOES = Number(process.argv[2]) || 4;
const { FTP_SERVER, FTP_USERNAME, FTP_PASSWORD, FTP_INSEGURO } = process.env;
const arq = (nome) => path.join(PASTA, nome);

if (!FTP_SERVER || !FTP_USERNAME || !FTP_PASSWORD) {
  console.error('Falta FTP_SERVER, FTP_USERNAME ou FTP_PASSWORD no .env.');
  process.exit(1);
}

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

const enviadas = new Set((await ler('fotos_enviadas.ndjson')).map((f) => f.arquivo));
// fotos/<os>/<anexo>.<ext>  ->  <DESTINO>/<os>/<anexo>.<ext>
const fila = (await ler('fotos.ndjson')).filter((f) => !enviadas.has(f.arquivo));
const total = fila.length;
const bytesTotal = fila.reduce((s, f) => s + f.bytes, 0);
console.log(`${enviadas.size} já enviadas, ${total} na fila (${(bytesTotal / 1024 ** 3).toFixed(2)} GB, ${CONEXOES} conexões) -> ${DESTINO}/`);

// A HostGator apresenta o certificado dela (*.hostgator.com.br) no FTP do domínio do cliente:
// aceita o nome do servidor ou o da HostGator (a cadeia do certificado continua sendo conferida)
const conferirNome = (host, cert) => (checkServerIdentity(host, cert) === undefined ? undefined : checkServerIdentity('ftp.hostgator.com.br', cert));

async function conectar() {
  const c = new Client(60_000);
  await c.access({
    host: FTP_SERVER,
    user: FTP_USERNAME,
    password: FTP_PASSWORD,
    secure: true,
    secureOptions: FTP_INSEGURO === '1' ? { rejectUnauthorized: false } : { checkServerIdentity: conferirNome },
  });
  return c;
}

let ok = 0;
let falhas = 0;
let bytes = 0;
let proximo = 0;
const inicio = Date.now();

async function trabalhador() {
  let c = await conectar();
  let pastaAtual = null;
  while (proximo < fila.length) {
    const f = fila[proximo++];
    const [, os, nome] = f.arquivo.split(/[\\/]/);
    for (let tentativa = 1; ; tentativa++) {
      try {
        const pasta = `/${DESTINO}/${os}`;
        if (pastaAtual !== pasta) {
          await c.ensureDir(pasta); // cria e entra na pasta
          pastaAtual = pasta;
        }
        await c.uploadFrom(arq(f.arquivo), nome);
        await appendFile(arq('fotos_enviadas.ndjson'), JSON.stringify({ arquivo: f.arquivo }) + '\n');
        ok++;
        bytes += f.bytes;
        break;
      } catch (e) {
        if (tentativa >= 4) {
          falhas++;
          await appendFile(arq('fotos_envio_erros.ndjson'), JSON.stringify({ arquivo: f.arquivo, erro: e.message, em: new Date().toISOString() }) + '\n');
          break;
        }
        // Conexão caiu: reconecta
        c.close();
        await new Promise((r) => setTimeout(r, 3000 * tentativa));
        c = await conectar().catch(() => c);
        pastaAtual = null;
      }
    }
  }
  c.close();
}

const mostrar = setInterval(() => {
  const s = (Date.now() - inicio) / 1000;
  const feitos = ok + falhas;
  const mbps = (bytes * 8) / 1024 ** 2 / s;
  const resta = bytes ? ((bytesTotal - bytes) / (bytes / s)) / 60 : 0;
  process.stdout.write(`\rfotos: ${feitos}/${total}  falhas ${falhas}  ${(bytes / 1024 ** 3).toFixed(2)} GB  ${mbps.toFixed(1)} Mbit/s  (faltam ~${Math.round(resta)} min)   `);
}, 3000);

await Promise.all(Array.from({ length: CONEXOES }, trabalhador));
clearInterval(mostrar);
console.log(`\nPronto: ${ok} enviadas, ${falhas} falhas (em fotos_envio_erros.ndjson; rode de novo para tentar outra vez).`);
