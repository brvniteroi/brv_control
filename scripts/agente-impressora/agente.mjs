// Agente da fila de impressão do BRV Control (roda no servidor da loja, ligado direto).
//
// 1. Entra no Supabase com o login próprio (papel 'impressora'; só enxerga a fila).
// 2. Fica ouvindo a tabela print_jobs pelo Realtime e confere a fila a cada 30 s (segurança, se o Realtime cair).
// 3. Para cada pedido: impressora_pegar → envia o ZPL à Elgin (fila do Windows em RAW; se falhar e houver
//    ELGIN_IP, direto pela rede na porta 9100) → impressora_concluir (impressa ou falhou com o motivo).
// 4. Manda sinal de vida a cada 30 s (a tela mostra "Elgin pronta" ou "servidor da loja sem sinal").
//
// Uso:  node agente.mjs              (normal; a tarefa do Windows roda assim ao ligar o servidor)
//       node agente.mjs --teste-local (imprime uma etiqueta de teste direto, sem o Supabase)
// Log: agente.log na mesma pasta (os últimos ~2 MB).

import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Socket } from 'node:net';
import { fileURLToPath } from 'node:url';

const VERSAO = '1.1.0';   // 1.1.0: margem esquerda, passo do rolo, cópias uma por vez, calibrar; o sinal de vida informa os ajustes em uso
const PASTA = dirname(fileURLToPath(import.meta.url));
const INICIADO_EM = new Date().toISOString();
const ARQ_LOG = join(PASTA, 'agente.log');

// ---------------------------------------------------------------------
// Configuração (.env na mesma pasta)
// ---------------------------------------------------------------------
function lerEnv() {
  const arq = join(PASTA, '.env');
  if (!existsSync(arq)) throw new Error(`Falta o arquivo ${arq} (copie de .env.example)`);
  const env = {};
  for (const linha of readFileSync(arq, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = lerEnv();
const CFG = {
  url: env.SUPABASE_URL,
  chave: env.SUPABASE_ANON_KEY,
  email: env.AGENTE_EMAIL,
  senha: env.AGENTE_SENHA,
  agente: env.AGENTE_ID || 'servidor-loja',
  impressora: env.IMPRESSORA || 'elgin',
  impressoraWin: env.IMPRESSORA_WIN || 'ELGIN L42PRO FULL',
  ip: (env.ELGIN_IP || '').trim(),
  porta: Number(env.ELGIN_PORTA || 9100),
  // Margem esquerda extra (mm), somada pelo comando ^LH: compensa a etiqueta que sai encostada na borda. 8 pontos por mm.
  margemEsquerdaMm: Number(env.MARGEM_ESQUERDA_MM || 3),
  // Altura da etiqueta + espaço até a próxima (mm). Rolo atual: 50 + 3.
  passoEtiquetaMm: Number(env.PASSO_ETIQUETA_MM || 53),
  // Pausa entre uma cópia e a próxima (ms), para a Elgin terminar uma etiqueta antes de receber a outra.
  pausaEntreCopiasMs: Number(env.PAUSA_ENTRE_COPIAS_MS || 1500),
};

// ---------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------
function log(...partes) {
  const linha = `${new Date().toLocaleString('pt-BR')}  ${partes.join(' ')}`;
  console.log(linha);
  try {
    if (existsSync(ARQ_LOG) && statSync(ARQ_LOG).size > 2_000_000) {
      renameSync(ARQ_LOG, `${ARQ_LOG}.1`);
    }
    appendFileSync(ARQ_LOG, linha + '\n');
  } catch {
    // log é ajuda, não pode derrubar o agente
  }
}

// ---------------------------------------------------------------------
// Envio para a Elgin
// ---------------------------------------------------------------------
function pelaFilaDoWindows(zpl) {
  return new Promise((resolve, reject) => {
    const arq = join(tmpdir(), `brv-etiqueta-${Date.now()}-${Math.random().toString(36).slice(2)}.zpl`);
    writeFileSync(arq, zpl, 'utf8');
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(PASTA, 'imprimir-raw.ps1'),
       '-Impressora', CFG.impressoraWin, '-Arquivo', arq],
      { timeout: 30_000, windowsHide: true },
      (erro, saida) => {
        try { unlinkSync(arq); } catch { /* arquivo temporário */ }
        if (erro) reject(new Error((saida || erro.message).toString().trim() || 'Falha na fila do Windows'));
        else resolve('fila do Windows');
      },
    );
  });
}

function pelaRede(zpl) {
  return new Promise((resolve, reject) => {
    const s = new Socket();
    s.setTimeout(8000);
    s.once('timeout', () => { s.destroy(); reject(new Error(`Elgin não respondeu em ${CFG.ip}:${CFG.porta}`)); });
    s.once('error', (e) => reject(new Error(`Rede ${CFG.ip}:${CFG.porta}: ${e.message}`)));
    s.connect(CFG.porta, CFG.ip, () => {
      s.end(Buffer.from(zpl, 'utf8'), () => {
        // dá tempo de a impressora receber antes de fechar
        setTimeout(() => { s.destroy(); resolve(`rede ${CFG.ip}:${CFG.porta}`); }, 500);
      });
    });
  });
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function imprimir(zplOriginal) {
  // Rolo 100x50 mm com 3 mm de espaço entre etiquetas e nas laterais: passo de 53 mm (424 pontos) e leitura do
  // espaço entre etiquetas (^MNY). Sem isso a Elgin podia andar duas etiquetas e deixar uma em branco.
  const zpl = zplOriginal
    .replace('^LH0,0', `^LH${Math.round(CFG.margemEsquerdaMm * 8)},0`)
    .replace('^LL400', `^LL${Math.round(CFG.passoEtiquetaMm * 8)}`)
    .replace('^XA', '^XA\r\n^MNY');
  // Várias cópias: com ^PQn (e também com vários blocos num envio só) a Elgin deixava etiquetas em branco no meio.
  // Manda uma cópia por vez, cada uma como um trabalho separado (como o sistema antigo), com uma pausa entre elas.
  const copias = Math.min(10, Number(/\^PQ(\d+)/.exec(zpl)?.[1] ?? 1));
  const uma = zpl.replace(/\^PQ\d+/, '^PQ1');
  let via = '';
  for (let i = 0; i < copias; i++) {
    if (i > 0) await pausa(CFG.pausaEntreCopiasMs);
    via = await enviarUma(uma);
  }
  return via;
}

async function enviarUma(zpl) {
  try {
    return await pelaFilaDoWindows(zpl);
  } catch (e) {
    if (!CFG.ip) throw e;
    log('  fila do Windows falhou:', e.message, '→ tentando pela rede');
    try {
      return await pelaRede(zpl);
    } catch (e2) {
      throw new Error(`Fila do Windows: ${e.message} | ${e2.message}`);
    }
  }
}

process.on('unhandledRejection', (e) => log('Erro não tratado:', e?.message ?? e));

// ---------------------------------------------------------------------
// Teste local (sem Supabase)
// ---------------------------------------------------------------------
if (process.argv.includes('--calibrar')) {
  // Recalibra o sensor de etiquetas (~JC): a Elgin avança algumas etiquetas e aprende o tamanho/espaço do rolo.
  // Usar com o rolo certo colocado e a tampa fechada. Corrige etiqueta em branco entre as impressas.
  imprimir('~JC\r\n')
    .then((via) => { log('Calibração enviada pela', via, '- a impressora deve avançar algumas etiquetas'); process.exit(0); })
    .catch((e) => { log('Calibração FALHOU:', e.message); process.exit(1); });
} else if (process.argv.includes('--teste-local')) {
  const zpl = [
    '^XA', '^CI28', '^PW800', '^LL400', '^LH0,0', '^PR2',
    '^FO24,18^A0N,32,32^FDBRV CLIMATIZACAO^FS', '^FO24,70^GB752,3,3^FS',
    '^FO24,110^A0N,40,40^FDTESTE LOCAL DO AGENTE^FS',
    `^FO24,170^A0N,24,24^FD${new Date().toLocaleString('pt-BR')}^FS`,
    '^PQ1', '^XZ',
  ].join('\r\n') + '\r\n';
  imprimir(zpl)
    .then((via) => { log('Teste local impresso pela', via); process.exit(0); })
    .catch((e) => { log('Teste local FALHOU:', e.message); process.exit(1); });
} else {
  iniciar().catch((e) => {
    log('ERRO FATAL:', e?.message ?? e);
    // A tarefa do Windows reinicia o agente; espera um pouco para não ficar em laço rápido
    setTimeout(() => process.exit(1), 30_000);
  });
}

// ---------------------------------------------------------------------
// Fila
// ---------------------------------------------------------------------
async function iniciar() {
  for (const [nome, valor] of Object.entries({ SUPABASE_URL: CFG.url, SUPABASE_ANON_KEY: CFG.chave, AGENTE_EMAIL: CFG.email, AGENTE_SENHA: CFG.senha })) {
    if (!valor) throw new Error(`Preencha ${nome} no .env`);
  }

  const supabase = createClient(CFG.url, CFG.chave, {
    auth: { persistSession: false, autoRefreshToken: true },
  });

  const entrar = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: CFG.email, password: CFG.senha });
    if (error) throw new Error(`Login do agente: ${error.message}`);
  };
  await entrar();
  log(`Ajustes: margem esquerda ${CFG.margemEsquerdaMm} mm, passo do rolo ${CFG.passoEtiquetaMm} mm, pausa entre cópias ${CFG.pausaEntreCopiasMs} ms (pid ${process.pid})`);
  log(`Agente ${CFG.agente} v${VERSAO} conectado. Impressora: "${CFG.impressoraWin}"${CFG.ip ? ` (reserva pela rede ${CFG.ip}:${CFG.porta})` : ''}`);

  // Realtime precisa do token do login (o RLS da fila só deixa o papel 'impressora' ler)
  supabase.auth.onAuthStateChange((_evento, sessao) => {
    if (sessao?.access_token) supabase.realtime.setAuth(sessao.access_token);
  });

  let processando = false;
  let deNovo = false;

  const processarFila = async () => {
    if (processando) { deNovo = true; return; }
    processando = true;
    try {
      do {
        deNovo = false;
        for (;;) {
          const { data, error } = await supabase.rpc('impressora_pegar', { p_agente: CFG.agente, p_impressora: CFG.impressora });
          if (error) throw new Error(`impressora_pegar: ${error.message}`);
          const pedido = (data ?? [])[0];
          if (!pedido) break;
          log(`Pedido ${pedido.id.slice(0, 8)} (${pedido.kind}, ${pedido.copies} cópia(s), por ${pedido.requested_by_name ?? '?'})`);
          let ok = true;
          let motivo = null;
          try {
            const via = await imprimir(pedido.payload);
            log('  impresso pela', via);
          } catch (e) {
            ok = false;
            motivo = e.message;
            log('  FALHOU:', motivo);
          }
          const { error: erroFim } = await supabase.rpc('impressora_concluir', { p_id: pedido.id, p_ok: ok, p_erro: motivo });
          if (erroFim) log('  impressora_concluir:', erroFim.message);
        }
      } while (deNovo);
    } catch (e) {
      log('Erro na fila:', e.message);
      if (/JWT|token|401/i.test(e.message)) await entrar().catch((e2) => log('Novo login falhou:', e2.message));
    } finally {
      processando = false;
    }
  };

  const sinal = async () => {
    const { error } = await supabase.rpc('impressora_sinal', {
      p_agente: CFG.agente,
      p_impressora: CFG.impressora,
      p_versao: VERSAO,
      p_info: {
        impressora_windows: CFG.impressoraWin,
        rede: CFG.ip || null,
        node: process.version,
        // Ajustes que este processo está usando (a tela e o Claude conferem aqui se o arquivo certo está rodando)
        margem_esquerda_mm: CFG.margemEsquerdaMm,
        passo_etiqueta_mm: CFG.passoEtiquetaMm,
        pausa_entre_copias_ms: CFG.pausaEntreCopiasMs,
        pid: process.pid,
        iniciado_em: INICIADO_EM,
        arquivo_modificado_em: statSync(fileURLToPath(import.meta.url)).mtime.toISOString(),
      },
    });
    if (error) {
      log('Sinal de vida:', error.message);
      if (/JWT|token|401/i.test(error.message)) await entrar().catch((e2) => log('Novo login falhou:', e2.message));
    }
  };

  supabase
    .channel('agente-impressora')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'print_jobs' }, () => processarFila())
    .subscribe((status) => {
      log('Realtime:', status);
      if (status === 'SUBSCRIBED') processarFila();
    });

  await sinal();
  await processarFila();
  setInterval(() => { sinal(); processarFila(); }, 30_000);
}
