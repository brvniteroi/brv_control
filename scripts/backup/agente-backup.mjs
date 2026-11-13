// Vigia do backup sob demanda: roda o tempo todo no PC da empresa (tarefa "BRV Control - Agente de Backup").
// Faz três coisas a cada ~15 s:
//   1. manda o "sinal de vida" (tabela backup_agent), que o Dashboard usa para dizer se o PC está online;
//   2. procura um pedido do botão "Fazer backup agora" (backup_runs com origem 'manual' e status 'pendente');
//   3. se achar, reivindica, roda scripts/backup/backup.mjs e grava o resultado (ok/falhou e o fim do log).
// Pedido que ficou pendente por mais de 2 h (PC desligado) ou "executando" sem ninguém rodando (agente reiniciado) vira "falhou".
// Fala com o Supabase pela chave de serviço do .env (VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY), que fica só neste PC.
// Uso: node scripts/backup/agente-backup.mjs   (para rodar solto e ver o que acontece)
import { spawn } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { hostname } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSAO = '1.0.0'
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
try { process.loadEnvFile(join(raiz, '.env')) } catch { /* sem .env: usa o ambiente */ }

const e = process.env
const URL_BASE = (e.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const CHAVE = e.SUPABASE_SERVICE_ROLE_KEY
const PASTA = e.BACKUP_PASTA || 'D:/backups-brv'
const INTERVALO_MS = 15_000
const LIMITE_EXECUCAO_MS = 90 * 60_000
const DUAS_HORAS_MS = 2 * 3_600_000

mkdirSync(PASTA, { recursive: true })
const logArq = join(PASTA, 'agente-backup.log')
const agora = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace('T', ' ').slice(0, 19)
const log = (m) => { const l = `[${agora()}] ${m}`; console.log(l); try { appendFileSync(logArq, l + '\n') } catch { /* disco indisponível */ } }

if (!URL_BASE || !CHAVE) {
  console.error('Falta VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env deste PC.')
  process.exit(1)
}

const cabecalho = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'application/json' }
async function rest(caminho, { metodo = 'GET', corpo, prefer } = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
    method: metodo,
    headers: prefer ? { ...cabecalho, Prefer: prefer } : cabecalho,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(15_000),
  })
  if (!r.ok) throw new Error(`${metodo} ${caminho.split('?')[0]} -> ${r.status} ${(await r.text()).slice(0, 200)}`)
  const texto = await r.text()
  return texto ? JSON.parse(texto) : null
}

const iniciadoEm = new Date().toISOString()
async function sinalDeVida() {
  await rest('backup_agent?on_conflict=id', {
    metodo: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    corpo: { id: 1, last_seen: new Date().toISOString(), info: { host: hostname(), pid: process.pid, versao: VERSAO, iniciado_em: iniciadoEm } },
  })
}

async function limparPendencias(aoIniciar) {
  const limite = new Date(Date.now() - DUAS_HORAS_MS).toISOString()
  const fim = new Date().toISOString()
  await rest(`backup_runs?origem=eq.manual&status=eq.pendente&requested_at=lt.${limite}`, {
    metodo: 'PATCH', prefer: 'return=minimal',
    corpo: { status: 'falhou', finished_at: fim, detalhe: 'O PC da empresa ficou desligado por mais de 2 horas. Peça o backup de novo.' },
  })
  // "executando" sem ninguém rodando: ao iniciar, qualquer um (o agente anterior morreu); depois, só os de mais de 2 h
  const filtro = aoIniciar ? '' : `&started_at=lt.${limite}`
  await rest(`backup_runs?origem=eq.manual&status=eq.executando${filtro}`, {
    metodo: 'PATCH', prefer: 'return=minimal',
    corpo: { status: 'falhou', finished_at: fim, detalhe: 'Interrompido (o vigia do backup foi reiniciado ou o PC desligou). Peça o backup de novo.' },
  })
}

async function proximoPedido() {
  const linhas = await rest('backup_runs?origem=eq.manual&status=eq.pendente&order=requested_at.asc&limit=1&select=id')
  return linhas?.[0]?.id ?? null
}

// Só um vigia pega o pedido: o PATCH só vale se ele ainda estiver pendente
async function reivindicar(id) {
  const linhas = await rest(`backup_runs?id=eq.${id}&status=eq.pendente`, {
    metodo: 'PATCH', prefer: 'return=representation',
    corpo: { status: 'executando', started_at: new Date().toISOString() },
  })
  return Array.isArray(linhas) && linhas.length === 1
}

function rodarBackup(id) {
  return new Promise((resolve) => {
    const saida = []
    const filho = spawn(process.execPath, [join(raiz, 'scripts', 'backup', 'backup.mjs')], {
      cwd: raiz,
      env: { ...process.env, BACKUP_RUN_ID: id },
      windowsHide: true,
    })
    const guardar = (dados) => { for (const l of String(dados).split(/\r?\n/)) if (l.trim()) saida.push(l.trim()) }
    filho.stdout.on('data', guardar)
    filho.stderr.on('data', guardar)
    const limite = setTimeout(() => { saida.push('Passou de 90 minutos: backup interrompido.'); filho.kill() }, LIMITE_EXECUCAO_MS)
    filho.on('error', (err) => { clearTimeout(limite); resolve({ codigo: 1, saida: [...saida, `Não foi possível iniciar o backup: ${err.message}`] }) })
    filho.on('close', (codigo) => { clearTimeout(limite); resolve({ codigo: codigo ?? 1, saida }) })
  })
}

async function atenderPedido(id) {
  log(`Pedido ${id}: iniciando o backup`)
  const { codigo, saida } = await rodarBackup(id)
  let detalhe = saida.slice(-12).join('\n')
  if (codigo === 2) detalhe = 'Já havia um backup em andamento (o agendado ou outro pedido). Tente de novo em alguns minutos.'
  await rest(`backup_runs?id=eq.${id}`, {
    metodo: 'PATCH', prefer: 'return=minimal',
    corpo: { status: codigo === 0 ? 'ok' : 'falhou', finished_at: new Date().toISOString(), detalhe },
  })
  log(`Pedido ${id}: ${codigo === 0 ? 'concluído' : `falhou (código ${codigo})`}`)
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
let ocupado = false

// O sinal de vida continua mesmo durante um backup longo
setInterval(() => { sinalDeVida().catch((err) => log(`Sinal de vida falhou: ${err.message}`)) }, 30_000)

log(`Vigia do backup ${VERSAO} iniciado (PID ${process.pid}, ${hostname()})`)
let primeira = true
for (;;) {
  try {
    await sinalDeVida()
    if (!ocupado) {
      await limparPendencias(primeira)
      primeira = false
      const id = await proximoPedido()
      if (id && (await reivindicar(id))) {
        ocupado = true
        try { await atenderPedido(id) } finally { ocupado = false }
      }
    }
  } catch (err) {
    log(`Erro: ${err.message}`) // sem internet ou Supabase fora do ar: tenta de novo no próximo ciclo
  }
  await dormir(INTERVALO_MS)
}
