// Backup diário: pg_dump dos dois projetos Supabase + cópia incremental das fotos da HostGator.
// Uso: node scripts/backup/backup.mjs [--so-banco] [--so-fotos]
// Precisa no .env (ver .env.example): BACKUP_DB_URL_CONTROL, FTP_SERVER, FTP_USERNAME, FTP_PASSWORD.
// Opcionais: BACKUP_PASTA (padrão D:\backups-brv), BACKUP_PASTA_EXTRA (cópia dos dumps, ex. pasta do Google Drive),
// BACKUP_DIAS (quantos dias de dump guardar, padrão 14), PG_DUMP (caminho do pg_dump.exe).
// No fim, registra o resultado no painel do Dashboard (tabela backup_runs, com a chave de serviço do .env); sem internet
// o backup vale do mesmo jeito. Quando o backup é pedido pelo botão do Dashboard, quem registra é o vigia
// (agente-backup.mjs, que passa BACKUP_RUN_ID). Uma trava (backup.lock) impede dois backups ao mesmo tempo (código de saída 2).
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync, renameSync, writeFileSync, appendFileSync, createWriteStream } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'basic-ftp'
import { checkServerIdentity } from 'node:tls'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
try { process.loadEnvFile(join(raiz, '.env')) } catch { /* sem .env: usa o ambiente */ }

const e = process.env
const PASTA = e.BACKUP_PASTA || 'D:/backups-brv'
const EXTRA = e.BACKUP_PASTA_EXTRA || ''
const DIAS = Number(e.BACKUP_DIAS || 14)
const PG_DUMP = e.PG_DUMP || 'C:/PostgreSQL17/bin/pg_dump.exe'
const args = process.argv.slice(2)
const soBanco = args.includes('--so-banco')
const soFotos = args.includes('--so-fotos')

mkdirSync(PASTA, { recursive: true })
const logArq = join(PASTA, 'backup.log')
// Horário local do PC (toISOString dá UTC, 3 h à frente do Brasil)
const local = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString()
const agora = () => local().replace('T', ' ').slice(0, 19)
const inicio = new Date()
const linhas = [] // o que vai para o painel do Dashboard
const log = (m) => { const l = `[${agora()}] ${m}`; console.log(l); appendFileSync(logArq, l + '\n'); linhas.push(l) }
let falhas = 0

// Trava: dois backups ao mesmo tempo gravariam o mesmo arquivo. Trava com mais de 2 h é de um backup que morreu no meio.
const lockArq = join(PASTA, 'backup.lock')
function pegarTrava() {
  try { writeFileSync(lockArq, String(process.pid), { flag: 'wx' }); return true } catch { /* já existe */ }
  try {
    if (Date.now() - statSync(lockArq).mtimeMs > 2 * 3_600_000) {
      rmSync(lockArq, { force: true })
      writeFileSync(lockArq, String(process.pid), { flag: 'wx' })
      return true
    }
  } catch { /* outro backup pegou a trava agora */ }
  return false
}

// Registra o resultado no painel (só no backup agendado ou rodado à mão; o do botão é registrado pelo vigia)
async function reportar(ok) {
  const url = (e.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
  const chave = e.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave || e.BACKUP_RUN_ID) return
  try {
    await fetch(`${url}/rest/v1/backup_runs`, {
      method: 'POST',
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        origem: 'agendado',
        status: ok ? 'ok' : 'falhou',
        started_at: inicio.toISOString(),
        finished_at: new Date().toISOString(),
        detalhe: linhas.slice(-12).join('\n'),
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch { /* sem internet ou tabela ainda não criada: o backup já foi feito, só não aparece no painel */ }
}
const conferirNome = (host, cert) => (checkServerIdentity(host, cert) === undefined ? undefined : checkServerIdentity('ftp.hostgator.com.br', cert))

function dump(nome, url) {
  if (!url) { log(`PULOU ${nome}: falta a URL no .env`); falhas++; return }
  const dia = local().slice(0, 10)
  const pasta = join(PASTA, 'banco', nome)
  mkdirSync(pasta, { recursive: true })
  const arq = join(pasta, `${nome}-${dia}.dump`)
  // Grava num arquivo parcial e só troca pelo do dia se der certo: se falhar, o dump bom do mesmo dia (ex.: o das 9h) fica
  const parcial = `${arq}.parcial`
  // schemas public (dados do sistema) e auth (logins); formato custom, restaura com pg_restore
  const r = spawnSync(PG_DUMP, ['--dbname', url, '-Fc', '--no-owner', '-n', 'public', '-n', 'auth', '-f', parcial], { encoding: 'utf8' })
  if (r.status !== 0) {
    rmSync(parcial, { force: true })
    log(`FALHOU ${nome}: ${(r.stderr || r.error?.message || '').split('\n')[0]}`)
    falhas++
    return
  }
  renameSync(parcial, arq)
  log(`OK ${nome}: ${(statSync(arq).size / 1048576).toFixed(1)} MB`)
  if (EXTRA) {
    try { mkdirSync(join(EXTRA, nome), { recursive: true }); copyFileSync(arq, join(EXTRA, nome, `${nome}-${dia}.dump`)) }
    catch (err) { log(`AVISO cópia extra de ${nome}: ${err.message}`); falhas++ }
  }
  for (const base of [pasta, EXTRA && join(EXTRA, nome)].filter(Boolean)) {
    try {
      const antigos = readdirSync(base).filter((f) => f.endsWith('.dump')).sort().slice(0, -DIAS)
      for (const f of antigos) rmSync(join(base, f), { force: true })
    } catch { /* pasta extra indisponível */ }
  }
}

// Espelho incremental de api/uploads (exceto fc, o backup do Field, que já está em scripts/field-control/dados)
async function fotos() {
  if (!e.FTP_SERVER || !e.FTP_USERNAME || !e.FTP_PASSWORD) { log('PULOU fotos: falta FTP_* no .env'); falhas++; return }
  const destino = join(PASTA, 'fotos')
  let c
  let baixadas = 0, bytes = 0, total = 0
  const percorrer = async (remoto, local) => {
    mkdirSync(local, { recursive: true })
    for (const item of await c.list(remoto)) {
      if (item.name === '.' || item.name === '..') continue
      const r = `${remoto}/${item.name}`, l = join(local, item.name)
      if (item.isDirectory) {
        if (remoto === 'api/uploads' && item.name === 'fc') continue
        await percorrer(r, l)
      } else if (item.isFile) {
        total++
        if (existsSync(l) && statSync(l).size === item.size) continue
        try { await c.downloadTo(createWriteStream(l), r) } catch (err) { rmSync(l, { force: true }); throw err }
        baixadas++; bytes += item.size
      }
    }
  }
  // o servidor derruba a conexão de vez em quando: reconecta e recomeça (o que já foi baixado é pulado)
  for (let t = 1; t <= 40; t++) {
    c = new Client(120000)
    total = 0
    try {
      await c.access({ host: e.FTP_SERVER, user: e.FTP_USERNAME, password: e.FTP_PASSWORD, secure: true, secureOptions: e.FTP_INSEGURO === '1' ? { rejectUnauthorized: false } : { checkServerIdentity: conferirNome } })
      await percorrer('api/uploads', destino)
      log(`OK fotos: ${baixadas} novas (${(bytes / 1048576).toFixed(1)} MB) de ${total} no servidor`)
      return
    } catch (err) {
      if (t === 40) { log(`FALHOU fotos: ${err.message} (${baixadas} novas antes da falha)`); falhas++; return }
    } finally { c.close() }
  }
}

if (!pegarTrava()) {
  log('PULOU: já existe outro backup em andamento (backup.lock). Tente de novo em alguns minutos.')
  process.exit(2)
}
try {
  if (!soFotos) {
    if (!existsSync(PG_DUMP)) { log(`FALHOU: pg_dump não encontrado em ${PG_DUMP}`); falhas++ }
    else { dump('control', e.BACKUP_DB_URL_CONTROL); if (e.BACKUP_DB_URL_EQUIP) dump('equipamentos', e.BACKUP_DB_URL_EQUIP) }
  }
  if (!soBanco) await fotos()
  log(falhas ? `TERMINOU com ${falhas} problema(s)` : 'TERMINOU sem problemas')
} finally {
  rmSync(lockArq, { force: true })
}
await reportar(falhas === 0)
process.exit(falhas ? 1 : 0)
