// Importa o reparo de placas do BRV Equipamentos (reparos_os, reparos_clientes, reparos_historico, fotos) para o
// módulo Placas do BRV Control (migration 20261110100000_placas_base.sql). Plano em docs/placas.md.
//
// Pode rodar quantas vezes quiser: casa cada placa por legacy_id e ATUALIZA as já importadas, SALVO as que alguém
// mexeu no Control (qualquer evento com autor no histórico): essas não são sobrescritas e aparecem no relatório.
//
// Uso:  node --env-file=.env scripts/equipamentos/importar-placas.mjs [--simular] [--sem-fotos]
//   --simular   só lê, confere e gera o relatório, sem gravar nada no Control nem na HostGator
//   --sem-fotos importa placas, clientes e histórico, sem copiar as fotos
//
// Precisa no .env (SÓ neste PC; nunca no git):
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (BRV Control)
//   EQUIP_SERVICE_ROLE_KEY                          (BRV Equipamentos, projeto tnsmwpewdkdigwjyaufr)
//   FTP_SERVER, FTP_USERNAME, FTP_PASSWORD          (para copiar as fotos para a HostGator)
//
// Regras de conversão (decididas em docs/placas.md):
//   - Número da placa = numero_os do sistema antigo (continua valendo nas etiquetas e papéis).
//   - Cliente: reparos_clientes entra 1:1 em board_clients; placa cujo cliente (por nome) não está lá cria o cliente a partir da OS.
//     Nunca mistura com customers do Control. Se a placa tinha OS do Control (os_field_control), guarda o vínculo service_order_id.
//   - Etapas: Entrada→entrada, Diagnóstico→diagnostico, Aguardando Peça→aguardando_peca, Em Reparo→em_reparo, Teste→teste,
//     Pronto→pronto, Entregue→entregue, Sem Conserto→sem_conserto. No sistema antigo "arquivada" = entregue e fechada: arquivada em
//     Pronto/Entregue vira ENTREGUE (saída = data_saida). Arquivada em etapa anterior fica arquivada na etapa e vai para o relatório.
//   - Orçamento: etapa seguinte à triagem = aprovado (sem isso o banco travaria a entrega); valor_orcamento → quote_amount e,
//     nas entregues, valor cobrado (board_finance). Reembolso → board_finance (refunded).
//   - Histórico: movimentações viram mudança de etapa (alimenta a linha do tempo pública); o resto vira nota; texto com R$ fica visível só
//     para quem tem o financeiro. Fotos de histórico e da coluna "fotos" e do Storage viram board_photos (arquivo na HostGator).
//
// Saída: scripts/equipamentos/dados/relatorio-placas-<data>.txt

import { createClient } from '@supabase/supabase-js';
import { Client as Ftp } from 'basic-ftp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { checkServerIdentity } from 'node:tls';

const SIMULAR = process.argv.includes('--simular');
const SEM_FOTOS = process.argv.includes('--sem-fotos');

const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EQUIP_SERVICE_ROLE_KEY, FTP_SERVER, FTP_USERNAME, FTP_PASSWORD, FTP_INSEGURO } = process.env;
const EQUIP_SUPABASE_URL = process.env.EQUIP_SUPABASE_URL || 'https://tnsmwpewdkdigwjyaufr.supabase.co';
const URL_FOTOS = 'https://control.brvniteroi.com.br/api/uploads';
const DESTINO_FTP = 'api/uploads';
const PASTA_DADOS = path.join(import.meta.dirname, 'dados');
const MARCA = '(BRV Equipamentos)';

for (const [nome, valor] of Object.entries({ VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EQUIP_SERVICE_ROLE_KEY })) {
  if (!valor) {
    console.error(`Falta ${nome} no .env.`);
    process.exit(1);
  }
}
if (!SIMULAR && !SEM_FOTOS && (!FTP_SERVER || !FTP_USERNAME || !FTP_PASSWORD)) {
  console.error('Falta FTP_SERVER, FTP_USERNAME ou FTP_PASSWORD no .env (ou rode com --sem-fotos).');
  process.exit(1);
}

const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
const control = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opcoes);
const antigo = createClient(EQUIP_SUPABASE_URL, EQUIP_SERVICE_ROLE_KEY, opcoes);

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const digitos = (s) => String(s ?? '').replace(/\D/g, '');
const texto = (s) => {
  const t = String(s ?? '').trim();
  return t ? t : null;
};
const valor = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const diaBrasilia = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

async function tudo(cliente, tabela, colunas = '*', ordem = 'id') {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await cliente.from(tabela).select(colunas).order(ordem).range(de, de + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    linhas.push(...data);
    if (data.length < 1000) break;
  }
  return linhas;
}

const relatorio = {
  clientesCriadosDaOs: [],
  tecnicoNaoAchado: new Map(),
  osNaoAchada: [],
  arquivadaEmEtapaAnterior: [],
  etapaDesconhecida: [],
  garantiaSemOrigem: [],
  jaAlteradasNoControl: [],
  semValor: [],
  fotosFalha: [],
};

// ---------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------
console.log(`Importação das placas${SIMULAR ? ' (SIMULAÇÃO)' : ''}\nLendo o sistema antigo...`);
const reparos = await tudo(antigo, 'reparos_os', '*', 'data_entrada');
const clientesAntigos = await tudo(antigo, 'reparos_clientes', '*', 'created_at');
const historico = await tudo(antigo, 'reparos_historico', '*', 'data_hora');
console.log(`  ${reparos.length} placas, ${clientesAntigos.length} clientes, ${historico.length} linhas de histórico`);

const funcionarios = await tudo(control, 'employees', 'id,name,active');
const existentesClientes = await tudo(control, 'board_clients', 'id,legacy_id,name');
const existentesPlacas = await tudo(control, 'board_orders', 'id,legacy_id,board_number');

// ---------------------------------------------------------------------
// Conversões
// ---------------------------------------------------------------------
/** Texto de etapa do sistema antigo (ou do histórico) → etapa nova. */
function etapaDoTexto(t) {
  const s = norm(t);
  if (!s) return null;
  if (s.includes('sem conserto') || s.includes('devolvido')) return 'sem_conserto';
  if (s.includes('entregue') || s.includes('faturado')) return 'entregue';
  if (s.includes('pronto') || s.includes('retirada')) return 'pronto';
  // 2026-11-10: Teste/Simulador e Aguardando Peça viraram "Em Reparo" no Control
  if (s.includes('teste') || s.includes('simulador')) return 'em_reparo';
  if (s.includes('em reparo') || s === 'reparo') return 'em_reparo';
  if (s.includes('peca')) return 'em_reparo';
  if (s.includes('diagnostico') || s.includes('orcamento')) return 'diagnostico';
  if (s.includes('entrada') || s.includes('triagem')) return 'entrada';
  return null;
}

// Técnico de bancada de TODAS as placas: Braulio (decidido pelo usuário em 2026-11-10; os nomes do sistema antigo eram logins dele)
const idBraulio = funcionarios.find((f) => norm(f.name) === 'braulio rodrigues valente')?.id ?? null;
if (!idBraulio) {
  console.error('Funcionário "Braulio Rodrigues Valente" não encontrado no Control.');
  process.exit(1);
}

// Logins do sistema antigo que são o Braulio (só para o técnico de retirada) (o funcionário cadastrado no Control é "Braulio Rodrigues Valente")
const APELIDOS_FUNCIONARIO = { 'administrador brv': 'braulio rodrigues valente', 'braulio valente': 'braulio rodrigues valente' };

function acharFuncionario(nome) {
  const n = APELIDOS_FUNCIONARIO[norm(nome)] ?? norm(nome);
  if (!n || n === 'balcao') return null;
  const ativos = funcionarios;
  const exato = ativos.filter((f) => norm(f.name) === n);
  if (exato.length === 1) return exato[0].id;
  const contem = ativos.filter((f) => norm(f.name).includes(n) || n.includes(norm(f.name)));
  if (contem.length === 1) return contem[0].id;
  relatorio.tecnicoNaoAchado.set(nome, (relatorio.tecnicoNaoAchado.get(nome) ?? 0) + 1);
  return null;
}

// Clientes: 1:1 de reparos_clientes; o que faltar vem da própria OS
const clientePorChave = new Map();   // legacy key -> { legacy_id, name, phone, kind, city }
const clientesParaGravar = [];
for (const c of clientesAntigos) {
  const reg = { legacy_id: String(c.id), name: texto(c.nome) ?? 'Sem nome', phone: texto(c.telefone) ?? 'Não informado', kind: c.tipo === 'final' ? 'final' : 'instalador', city: texto(c.cidade) };
  clientesParaGravar.push(reg);
  clientePorChave.set(norm(reg.name), [...(clientePorChave.get(norm(reg.name)) ?? []), reg]);
}
function clienteDaOs(os) {
  const candidatos = clientePorChave.get(norm(os.cliente_nome)) ?? [];
  if (candidatos.length === 1) return candidatos[0];
  if (candidatos.length > 1) {
    const tel = digitos(os.cliente_telefone);
    return candidatos.find((c) => digitos(c.phone) === tel) ?? candidatos[0];
  }
  const novo = {
    legacy_id: `os:${norm(os.cliente_nome)}`,
    name: texto(os.cliente_nome) ?? 'Sem nome',
    phone: texto(os.cliente_telefone) ?? 'Não informado',
    kind: os.cliente_tipo === 'final' ? 'final' : 'instalador',
    city: texto(os.cidade),
  };
  clientesParaGravar.push(novo);
  clientePorChave.set(norm(novo.name), [novo]);
  relatorio.clientesCriadosDaOs.push(`${novo.name} (${novo.phone})`);
  return novo;
}

// OS do Control (os_field_control)
const numerosOs = [...new Set(reparos.map((r) => Number(digitos(r.os_field_control))).filter(Boolean))];
const osControl = new Map();
if (numerosOs.length) {
  const { data, error } = await control.from('service_orders').select('id,number').in('number', numerosOs);
  if (error) throw new Error(`service_orders: ${error.message}`);
  for (const o of data) osControl.set(o.number, o.id);
}

// Placa → linha do Control
const placas = [];
for (const r of reparos) {
  const etapaAntiga = etapaDoTexto(r.status);
  if (!etapaAntiga) {
    relatorio.etapaDesconhecida.push(`${r.numero_os}: "${r.status}"`);
    continue;
  }
  const cliente = clienteDaOs(r);
  let status = etapaAntiga;
  let arquivada = false;
  const fechadaNoAntigo = !!r.arquivado || etapaAntiga === 'entregue';
  if (fechadaNoAntigo && ['pronto', 'entregue'].includes(etapaAntiga)) status = 'entregue';
  else if (r.arquivado) {
    arquivada = true;
    relatorio.arquivadaEmEtapaAnterior.push(`${r.numero_os}: arquivada na etapa "${r.status}" (importada arquivada, sem entrega nem receita)`);
  }
  const final = status === 'entregue' || status === 'sem_conserto';
  const entrada = r.data_entrada || r.created_at;
  const saida = final ? (r.data_saida || r.data_etapa || entrada) : null;
  const orc = valor(r.valor_orcamento);
  if (final && !orc && !r.eh_garantia) relatorio.semValor.push(`${r.numero_os} (${status})`);

  let statusOrcamento = 'nao_feito';
  if (!r.eh_garantia && status !== 'entrada') statusOrcamento = status === 'diagnostico' ? (orc ? 'enviado' : 'nao_feito') : 'aprovado';

  const numOs = Number(digitos(r.os_field_control)) || null;
  const idOs = numOs ? osControl.get(numOs) ?? null : null;
  if (numOs && !idOs) relatorio.osNaoAchada.push(`${r.numero_os}: OS ${numOs} não existe no Control (importada só pelo cliente de placas)`);

  placas.push({
    r,
    cliente,
    status,
    linha: {
      legacy_id: String(r.id),
      board_number: r.numero_os,
      status,
      stage_changed_at: final ? saida : (r.data_etapa || entrada),
      finished_at: saida,
      archived: arquivada,
      archived_at: arquivada ? (r.data_etapa || null) : null,
      service_order_id: idOs,
      customer_kind: r.cliente_tipo === 'final' ? 'final' : 'instalador',
      customer_city: texto(r.cidade),
      equipment_type: texto(r.equipamento_tipo) ?? 'Split Inverter',
      brand_model: texto(r.marca_modelo) ?? 'Não informado',
      board_code: texto(r.codigo_placa) ?? 'Não informado',
      peripherals: texto(r.perifericos_acessorios),
      reported_defect: texto(r.defeito_reclamado) ?? 'Não informado',
      no_apparent_defect: !!r.sem_defeito,
      pickup_employee_id: acharFuncionario(r.tecnico_retirada),
      bench_employee_id: idBraulio,   // o único técnico de bancada das placas é o Braulio (decidido em 2026-11-10)
      error_code: texto(r.codigo_erro),
      technical_diagnosis: texto(r.diagnostico_tecnico),
      replaced_components: texto(r.componentes_trocados),
      quote_status: statusOrcamento,
      quote_amount: r.eh_garantia ? null : orc,
      quote_technical_opinion: r.eh_garantia ? null : texto(r.diagnostico_tecnico),
      is_warranty: !!r.eh_garantia,
      created_at: entrada,
      updated_at: new Date().toISOString(),
    },
    financeiro: final
      ? {
          charged_amount: orc,
          refunded: !!r.reembolsado,
          refund_amount: r.reembolsado ? (valor(r.valor_reembolso) ?? orc ?? 1) : null,
          refunded_at: r.reembolsado ? diaBrasilia(r.data_reembolso || saida) : null,
          refund_reason: r.reembolsado ? (texto(r.motivo_reembolso) ?? 'Reembolso (importado do sistema antigo)') : null,
        }
      : null,
  });
}

// ---------------------------------------------------------------------
// Histórico convertido
// ---------------------------------------------------------------------
function eventosDaPlaca(p) {
  const linhas = historico.filter((h) => String(h.reparo_id) === String(p.r.id));
  const eventos = [];
  let temEntrada = false;
  for (const h of linhas) {
    const acao = texto(h.acao) ?? '';
    const detalhes = texto(h.detalhes) ?? '';
    const ator = `${texto(h.usuario_nome) ?? 'Sistema'} ${MARCA}`;
    const quando = h.data_hora;
    const financeiro = detalhes.includes('R$') ? 'financeiro' : 'todos';
    if (/^foto/i.test(acao)) continue;  // fotos entram em board_photos
    if (/cria[cç][aã]o da os|entrada registrada/i.test(acao)) {
      if (temEntrada) continue;
      temEntrada = true;
      eventos.push({ event_type: 'entrada', to_stage: 'entrada', note: `Placa registrada: ${p.r.numero_os}`, visibility: 'todos', actor_name: ator, created_at: quando });
    } else if (/movimenta[cç][aã]o de etapa/i.test(acao)) {
      const m = detalhes.match(/de ['"‘’\\]*(.+?)['"‘’\\]* para ['"‘’\\]*(.+?)['"‘’\\]*\.?$/i);
      const de = m ? etapaDoTexto(m[1]) : null;
      const para = m ? etapaDoTexto(m[2]) : null;
      eventos.push(para
        ? { event_type: 'mudanca_etapa', from_stage: de, to_stage: para, note: null, visibility: 'todos', actor_name: ator, created_at: quando }
        : { event_type: 'nota', note: `${acao}: ${detalhes}`, visibility: financeiro, actor_name: ator, created_at: quando });
    } else if (/reembolso/i.test(acao)) {
      eventos.push({ event_type: 'reembolso', note: detalhes || acao, visibility: 'financeiro', actor_name: ator, created_at: quando });
    } else {
      eventos.push({ event_type: 'nota', note: detalhes ? `${acao}: ${detalhes}` : acao, visibility: financeiro, actor_name: ator, created_at: quando });
    }
  }
  if (!temEntrada) {
    eventos.unshift({ event_type: 'entrada', to_stage: 'entrada', note: `Placa registrada: ${p.r.numero_os}`, visibility: 'todos', actor_name: `Sistema ${MARCA}`, created_at: p.linha.created_at });
  }
  return eventos;
}

// ---------------------------------------------------------------------
// Resumo antes de gravar
// ---------------------------------------------------------------------
const porEtapa = new Map();
for (const p of placas) porEtapa.set(p.status, (porEtapa.get(p.status) ?? 0) + 1);
console.log(`\nPlacas importáveis: ${placas.length}`);
for (const [e, n] of porEtapa) console.log(`  ${e}: ${n}`);
console.log(`Clientes: ${clientesParaGravar.length} (${relatorio.clientesCriadosDaOs.length} criados a partir da OS)`);

// ---------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------
let gravadas = 0;
let eventosGravados = 0;
const idNovo = new Map();   // legacy_id da placa -> id no Control

if (!SIMULAR) {
  // Clientes
  const idCliente = new Map(existentesClientes.filter((c) => c.legacy_id).map((c) => [c.legacy_id, c.id]));
  for (const c of clientesParaGravar) {
    if (idCliente.has(c.legacy_id)) continue;
    const { data, error } = await control.from('board_clients').insert(c).select('id').single();
    if (error) throw new Error(`cliente ${c.name}: ${error.message}`);
    idCliente.set(c.legacy_id, data.id);
  }

  const idPorLegacy = new Map(existentesPlacas.filter((p) => p.legacy_id).map((p) => [p.legacy_id, p.id]));
  for (const p of placas) {
    const linha = { ...p.linha, board_client_id: idCliente.get(p.cliente.legacy_id) };
    let id = idPorLegacy.get(linha.legacy_id);
    if (id) {
      const { count } = await control.from('board_events').select('id', { count: 'exact', head: true }).eq('board_order_id', id).not('actor_id', 'is', null);
      if (count) {
        relatorio.jaAlteradasNoControl.push(`${linha.board_number}: tem eventos feitos no Control (não sobrescrita)`);
        idNovo.set(linha.legacy_id, id);
        continue;
      }
      const { error } = await control.from('board_orders').update(linha).eq('id', id);
      if (error) throw new Error(`atualizar ${linha.board_number}: ${error.message}`);
    } else {
      const { data, error } = await control.from('board_orders').insert(linha).select('id').single();
      if (error) throw new Error(`inserir ${linha.board_number}: ${error.message}`);
      id = data.id;
    }
    idNovo.set(linha.legacy_id, id);

    if (p.financeiro) {
      const { error } = await control.from('board_finance').upsert({ board_order_id: id, ...p.financeiro }, { onConflict: 'board_order_id' });
      if (error) throw new Error(`financeiro ${linha.board_number}: ${error.message}`);
    }

    // Histórico: apaga o que veio de script (sem autor, inclusive o automático) e regrava o do sistema antigo
    const { error: erroDel } = await control.from('board_events').delete().eq('board_order_id', id).is('actor_id', null);
    if (erroDel) throw new Error(`limpar histórico ${linha.board_number}: ${erroDel.message}`);
    const eventos = eventosDaPlaca(p).map((e) => ({ board_order_id: id, ...e }));
    for (let i = 0; i < eventos.length; i += 200) {
      const { error } = await control.from('board_events').insert(eventos.slice(i, i + 200));
      if (error) throw new Error(`histórico ${linha.board_number}: ${error.message}`);
    }
    eventosGravados += eventos.length;
    gravadas++;
    process.stdout.write(`\r  placas gravadas: ${gravadas}/${placas.length}   `);
  }

  // Garantia: aponta para a placa original quando o sistema antigo tinha o vínculo
  for (const p of placas) {
    if (!p.r.eh_garantia) continue;
    const origem = p.r.os_origem_id ? idNovo.get(String(p.r.os_origem_id)) : null;
    if (!origem) {
      relatorio.garantiaSemOrigem.push(`${p.r.numero_os}: sem placa de origem no sistema antigo`);
      continue;
    }
    await control.from('board_orders').update({ warranty_origin_id: origem }).eq('id', idNovo.get(String(p.r.id)));
  }

  // Contador do número por dia: não pode repetir número já usado
  const { data: seq } = await control.from('board_number_seq').select('day,last');
  const maximos = new Map((seq ?? []).map((s) => [s.day, s.last]));
  for (const p of placas) {
    const m = p.r.numero_os.match(/^OS-(\d{2})(\d{2})(\d{2})-(\d+)$/);
    if (!m) continue;
    const dia = diaBrasilia(p.linha.created_at);
    if (`20${m[3]}-${m[2]}-${m[1]}` !== dia) continue;   // formato antigo (AAMMDD): não entra na contagem do dia
    maximos.set(dia, Math.max(maximos.get(dia) ?? 0, Number(m[4])));
  }
  const upserts = [...maximos].map(([day, last]) => ({ day, last }));
  if (upserts.length) {
    const { error } = await control.from('board_number_seq').upsert(upserts, { onConflict: 'day' });
    if (error) throw new Error(`contador de números: ${error.message}`);
  }
  console.log('');
}

// ---------------------------------------------------------------------
// Fotos: sistema antigo (coluna fotos, histórico e Storage) -> HostGator -> board_photos
// ---------------------------------------------------------------------
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const extensao = (url) => (url.split('?')[0].split('.').pop() || '').toLowerCase();

async function listarFotos() {
  const porCaminho = new Map();
  const juntar = (legacyPlaca, f) => {
    const caminho = f.path || decodeURIComponent((f.url ?? '').split('/midias/')[1] ?? '');
    if (!caminho || !f.url) return;
    if (!porCaminho.has(caminho)) porCaminho.set(caminho, { legacyPlaca, caminho, url: f.url, fase: norm(f.fase), legenda: texto(f.observacao), data: f.data });
  };
  for (const p of placas) {
    for (const f of Array.isArray(p.r.fotos) ? p.r.fotos : []) juntar(String(p.r.id), f);
    const { data } = await antigo.storage.from('midias').list(`reparos/${p.r.id}`, { limit: 1000 });
    for (const arq of data ?? []) {
      if (!arq.id) continue;
      const { data: pub } = antigo.storage.from('midias').getPublicUrl(`reparos/${p.r.id}/${arq.name}`);
      juntar(String(p.r.id), { path: `reparos/${p.r.id}/${arq.name}`, url: pub.publicUrl, fase: '', observacao: null, data: arq.created_at });
    }
  }
  for (const h of historico.filter((x) => /^foto/i.test(x.acao ?? ''))) {
    try {
      const j = JSON.parse(h.detalhes ?? '');
      if (j?.url) juntar(String(h.reparo_id), { path: j.path, url: j.url, fase: j.fase, observacao: j.observacao, data: h.data_hora });
    } catch {
      // detalhes em texto livre: sem arquivo para copiar
    }
  }
  return [...porCaminho.values()].filter((f) => placas.some((p) => String(p.r.id) === f.legacyPlaca));
}

let fotosOk = 0;
let fotosJa = 0;
if (!SEM_FOTOS) {
  const fotos = await listarFotos();
  console.log(`\nFotos encontradas: ${fotos.length}`);
  if (!SIMULAR) {
    const conferirNome = (host, cert) => (checkServerIdentity(host, cert) === undefined ? undefined : checkServerIdentity('ftp.hostgator.com.br', cert));
    const conectar = async () => {
      const c = new Ftp(120_000);
      await c.access({
        host: FTP_SERVER,
        user: FTP_USERNAME,
        password: FTP_PASSWORD,
        secure: true,
        secureOptions: FTP_INSEGURO === '1' ? { rejectUnauthorized: false } : { checkServerIdentity: conferirNome },
      });
      return c;
    };
    let ftp = await conectar();
    const enviarFtp = async (pasta, corpo, nome) => {
      for (let tentativa = 1; ; tentativa++) {
        try {
          await ftp.ensureDir(pasta);
          await ftp.uploadFrom(Readable.from(corpo), nome);
          return;
        } catch (e) {
          if (tentativa >= 4) throw e;
          ftp.close();
          await new Promise((r) => setTimeout(r, 3000 * tentativa));
          ftp = await conectar().catch(() => ftp);
        }
      }
    };
    const { data: jaRegistradas } = await control.from('board_photos').select('legacy_id').not('legacy_id', 'is', null);
    const registradas = new Set((jaRegistradas ?? []).map((f) => f.legacy_id));

    for (const f of fotos) {
      const idPlaca = idNovo.get(f.legacyPlaca);
      if (!idPlaca) continue;
      if (registradas.has(f.caminho)) {
        fotosJa++;
        continue;
      }
      const ext = extensao(f.url) === 'jpeg' ? 'jpg' : extensao(f.url);
      if (!MIME[ext]) {
        relatorio.fotosFalha.push(`${f.url}: tipo de arquivo não aceito (.${ext})`);
        continue;
      }
      const nome = `${f.caminho.split('/').pop().replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120)}`;
      const destino = `placas/${f.legacyPlaca}`;
      try {
        const resp = await fetch(f.url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ao baixar`);
        const corpo = Buffer.from(await resp.arrayBuffer());
        if (corpo.length === 0) throw new Error('arquivo vazio');
        await enviarFtp(`/${DESTINO_FTP}/${destino}`, corpo, nome);
        const placa = placas.find((p) => String(p.r.id) === f.legacyPlaca);
        const categoria = f.fase.includes('entrada') || f.fase.includes('triagem') ? 'antes' : f.fase.includes('teste') || f.fase.includes('pronto') || f.fase.includes('bancada') ? 'depois' : 'outros';
        const { error } = await control.from('board_photos').insert({
          board_order_id: idPlaca,
          category: categoria,
          public_url: `${URL_FOTOS}/${destino}/${nome}`,
          file_name: nome,
          caption: f.legenda,
          stage_at_capture: categoria === 'antes' ? 'entrada' : placa?.status ?? 'entrada',
          uploaded_by_name: `BRV Equipamentos`,
          legacy_id: f.caminho,
          created_at: f.data || undefined,
        });
        if (error) throw new Error(`registro: ${error.message}`);
        fotosOk++;
        process.stdout.write(`\r  fotos enviadas: ${fotosOk}   `);
      } catch (e) {
        relatorio.fotosFalha.push(`${f.url}: ${e.message}`);
      }
    }
    ftp.close();
  }
}

// ---------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------
const secao = (titulo, itens) => (itens.length ? [`\n## ${titulo} (${itens.length})`, ...itens.map((i) => `- ${i}`)] : []);
const conteudo = [
  `Importação BRV Equipamentos → Placas do BRV Control${SIMULAR ? ' (SIMULAÇÃO, nada gravado)' : ''}`,
  `Data: ${new Date().toLocaleString('pt-BR')}`,
  `Placas no sistema antigo: ${reparos.length}. Importáveis: ${placas.length}. Clientes: ${clientesParaGravar.length}.`,
  SIMULAR ? '' : `Gravadas: ${gravadas}. Eventos de histórico: ${eventosGravados}. Fotos novas: ${fotosOk} (já estavam: ${fotosJa}).`,
  ...[...porEtapa].map(([e, n]) => `  ${e}: ${n}`),
  ...secao('Etapa desconhecida (NÃO importadas)', relatorio.etapaDesconhecida),
  ...secao('Arquivadas em etapa anterior à entrega (conferir: no sistema antigo contavam como fechadas)', relatorio.arquivadaEmEtapaAnterior),
  ...secao('Clientes criados a partir da OS (não estavam em reparos_clientes)', relatorio.clientesCriadosDaOs),
  ...secao('OS do Control informada que não existe', relatorio.osNaoAchada),
  ...secao('Técnicos não reconhecidos (ficaram sem técnico)', [...relatorio.tecnicoNaoAchado].map(([n, q]) => `${n} (${q}x)`)),
  ...secao('Entregues sem valor de orçamento (conferir faturamento)', relatorio.semValor),
  ...secao('Garantia sem placa de origem', relatorio.garantiaSemOrigem),
  ...secao('Já alteradas no Control (não sobrescritas)', relatorio.jaAlteradasNoControl),
  ...secao('Fotos com falha (rode de novo para tentar outra vez)', relatorio.fotosFalha),
].join('\n');

await mkdir(PASTA_DADOS, { recursive: true });
const arquivo = path.join(PASTA_DADOS, `relatorio-placas-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}${SIMULAR ? '-simulacao' : ''}.txt`);
await writeFile(arquivo, conteudo + '\n', 'utf8');
console.log(`\nRelatório: ${arquivo}`);
