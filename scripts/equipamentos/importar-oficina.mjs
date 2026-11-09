// Importa os equipamentos do BRV Equipamentos (Kanban de equipamentos recolhidos) para a Oficina do BRV Control.
// Plano e regras em docs/oficina.md ("Usar o Control e o Equipamentos ao mesmo tempo" e "Importação").
//
// Pode rodar quantas vezes quiser: casa cada item por legacy_id e ATUALIZA os já importados (não duplica).
// Por isso, durante o período de teste, não edite no Control os itens importados: a próxima rodada sobrescreve.
// Placas (reparos_os) ficam de fora: seguem no Equipamentos.
//
// Uso:  node --env-file=.env scripts/equipamentos/importar-oficina.mjs [--simular] [--sem-fotos]
//   --simular   só lê, confere e gera o relatório, sem gravar nada no Control nem na HostGator
//   --sem-fotos importa os itens e o histórico, sem copiar fotos e vídeos
//
// Precisa no .env (SÓ neste PC; nunca no git):
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (BRV Control, os mesmos do importador do Field)
//   EQUIP_SERVICE_ROLE_KEY                          (BRV Equipamentos: Supabase > projeto tnsmwpewdkdigwjyaufr >
//                                                    Project Settings > API Keys > service_role "secret")
//   FTP_SERVER, FTP_USERNAME, FTP_PASSWORD          (para copiar as fotos para a HostGator)
// Opcional: EQUIP_SUPABASE_URL (padrão abaixo), EQUIP_URL_ANTIGA (fotos com caminho relativo "uploads/...").
//
// Saída: scripts/equipamentos/dados/relatorio-<data>.txt (itens sem cliente para revisão, técnicos e etapas não
// reconhecidos, fotos com falha). Itens sem OS e sem cliente reconhecido NÃO entram: cadastre/corrija e rode de novo.

import { createClient } from '@supabase/supabase-js';
import { Client as Ftp } from 'basic-ftp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { checkServerIdentity } from 'node:tls';

const SIMULAR = process.argv.includes('--simular');
const SEM_FOTOS = process.argv.includes('--sem-fotos');

const {
  VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  EQUIP_SERVICE_ROLE_KEY,
  FTP_SERVER,
  FTP_USERNAME,
  FTP_PASSWORD,
  FTP_INSEGURO,
} = process.env;
const EQUIP_SUPABASE_URL = process.env.EQUIP_SUPABASE_URL || 'https://tnsmwpewdkdigwjyaufr.supabase.co';
const URL_ANTIGA = (process.env.EQUIP_URL_ANTIGA || 'https://oficina.brvniteroi.com.br').replace(/\/+$/, '');
const URL_FOTOS = 'https://control.brvniteroi.com.br/api/uploads';
const DESTINO_FTP = 'api/uploads';
const PASTA_DADOS = path.join(import.meta.dirname, 'dados');
const MARCA = '(BRV Equipamentos)';   // sufixo do autor nos eventos importados (permite refazer sem duplicar)

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
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const digitos = (s) => String(s ?? '').replace(/\D/g, '');
const texto = (s) => {
  const t = String(s ?? '').trim();
  return t ? t : null;
};
const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

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
  semCliente: [],
  etapaDesconhecida: [],
  tecnicoNaoAchado: new Map(),
  osNaoAchada: [],
  nomeDiferenteDaOS: [],
  fotosFalha: [],
  garantiaSemOrigem: [],
};

// ---------------------------------------------------------------------
// Conversões do sistema antigo
// ---------------------------------------------------------------------
/** Etapa antiga → [etapa nova, decisão do cliente | null]. null = desconhecida. */
function converterEtapa(eq) {
  const s = norm(eq.status);
  if (!s) return null;
  if (s.includes('descarte')) return ['descarte', 'recusado'];
  if (s.includes('recusad')) return [eq.data_entrega ? 'entregue' : 'pronto', 'recusado'];
  if (s.includes('entregue') || s.includes('faturad')) return ['entregue', 'aprovado'];
  if (s.includes('pronto')) return ['pronto', 'aprovado'];
  if (s.includes('reparo') || s.includes('conserto')) return ['em_reparo', 'aprovado'];
  if (s.includes('aguardando peca') || s === 'peca') return ['aguardando_peca', 'aprovado'];
  if (s === 'aprovado') {
    const faltaPeca = ['solicitada', 'comprada'].includes(norm(eq.status_pecas).replace(/ /g, '_'));
    return [faltaPeca ? 'aguardando_peca' : 'em_reparo', 'aprovado'];
  }
  if (s.includes('aguardando aprovacao') || s.includes('aguardando cliente')) return ['aguardando_cliente', null];
  if (s.includes('aguardando orcamento')) return ['aguardando_orcamento', null];
  if (s.includes('diagnost') || s.includes('triagem')) return ['diagnostico', null];
  if (s.includes('entrada') || s === 'novo') return ['entrada', null];
  return null;
}

function converterUnidade(eq) {
  const u = norm(eq.unidades_recolhidas);
  const tipo = norm(eq.tipo_equipamento);
  if (u.includes('ambas') || u.includes('ambos') || (u.includes('evap') && u.includes('cond')) || u.includes('complet')) return 'conjunto';
  if (u.includes('condens')) return 'condensadora';
  if (u.includes('evapor')) return 'evaporadora';
  if (u.includes('placa')) return 'outro';
  if (u.includes('acj') || u.includes('janela') || u.includes('bebedouro') || u.includes('purificador') || u.includes('aparelho')) return 'aparelho';
  if (tipo.includes('janela') || tipo.includes('bebedouro') || tipo.includes('purificador') || tipo.includes('adega') ||
      tipo.includes('gelo') || tipo.includes('cortina')) return 'aparelho';
  return u ? 'outro' : 'evaporadora';
}

function converterPecas(v) {
  const p = norm(v).replace(/ /g, '_');
  if (p === 'solicitada') return 'a_comprar';
  if (p === 'comprada') return 'comprada';
  if (p === 'na_bancada') return 'chegou';
  return 'nao_necessario';
}

// ---------------------------------------------------------------------
// Dados do Control (para casar OS, cliente e técnicos)
// ---------------------------------------------------------------------
console.log(`${SIMULAR ? '[SIMULAÇÃO] ' : ''}Lendo o BRV Control...`);
const ordens = new Map((await tudo(control, 'service_orders', 'id, number, customer_id')).map((o) => [Number(o.number), o]));
const clientes = await tudo(control, 'customers', 'id, name, trade_name, document, phone');
const contatos = await tudo(control, 'customer_contacts', 'id, customer_id, phone');
const funcionarios = await tudo(control, 'employees', 'id, name, active');
const nomeCliente = new Map(clientes.map((c) => [c.id, c.trade_name || c.name]));

const porDocumento = new Map(clientes.filter((c) => c.document).map((c) => [c.document.toUpperCase(), c.id]));
const porTelefone = new Map();
const anotarTelefone = (fone, id) => {
  const d = digitos(fone).slice(-9);
  if (d.length < 8) return;
  const atual = porTelefone.get(d);
  porTelefone.set(d, atual && atual !== id ? 'VARIOS' : id);
};
clientes.forEach((c) => anotarTelefone(c.phone, c.id));
contatos.forEach((c) => anotarTelefone(c.phone, c.customer_id));
const porNome = new Map();
for (const c of clientes) {
  for (const n of [c.name, c.trade_name]) {
    const k = norm(n);
    if (!k) continue;
    const atual = porNome.get(k);
    porNome.set(k, atual && atual !== c.id ? 'VARIOS' : c.id);
  }
}

/** Técnico pelo nome do sistema antigo: nome completo, senão primeiro nome se for único. */
function acharFuncionario(nome) {
  const k = norm(nome);
  if (!k) return null;
  const exato = funcionarios.filter((f) => norm(f.name) === k);
  if (exato.length === 1) return exato[0].id;
  const primeiro = k.split(' ')[0];
  const parecidos = funcionarios.filter((f) => norm(f.name).split(' ')[0] === primeiro && f.active);
  if (parecidos.length === 1) return parecidos[0].id;
  relatorio.tecnicoNaoAchado.set(nome, (relatorio.tecnicoNaoAchado.get(nome) ?? 0) + 1);
  return null;
}

// ---------------------------------------------------------------------
// Dados do BRV Equipamentos
// ---------------------------------------------------------------------
console.log('Lendo o BRV Equipamentos...');
// Ordem por id (existe em todas): a paginação fica estável; a data de cada linha vai junto
const equipamentos = await tudo(antigo, 'equipamentos');
const midias = await tudo(antigo, 'midias');
const historico = await tudo(antigo, 'historico_movimentacao');
const clientesAntigos = new Map((await tudo(antigo, 'clientes')).map((c) => [c.id, c]));
console.log(`  ${equipamentos.length} equipamentos, ${midias.length} mídias, ${historico.length} movimentações, ${clientesAntigos.size} clientes`);

/** Cliente do Control para item sem OS: documento → telefone → nome exato. Nunca adivinha. */
function acharCliente(eq) {
  const antigoCli = eq.cliente_id ? clientesAntigos.get(eq.cliente_id) : null;
  const doc = digitos(antigoCli?.documento);
  if (doc && porDocumento.has(doc)) return porDocumento.get(doc);
  for (const fone of [eq.cliente_telefone, antigoCli?.telefone]) {
    const d = digitos(fone).slice(-9);
    const id = d.length >= 8 ? porTelefone.get(d) : null;
    if (id && id !== 'VARIOS') return id;
  }
  const id = porNome.get(norm(eq.cliente_nome || antigoCli?.nome));
  if (id && id !== 'VARIOS') return id;
  return null;
}

// ---------------------------------------------------------------------
// Converte cada equipamento
// ---------------------------------------------------------------------
const linhas = [];
for (const eq of equipamentos) {
  const ref = [texto(eq.os_field_control), texto(eq.codigo_interno)].filter(Boolean).join(' / ') || eq.id;
  const etapa = converterEtapa(eq);
  if (!etapa) {
    relatorio.etapaDesconhecida.push(`${ref}: "${eq.status}"`);
    continue;
  }
  const [status, decisaoAntiga] = etapa;

  const numOs = /^\d+$/.test(String(eq.os_field_control ?? '').trim()) ? Number(String(eq.os_field_control).trim()) : null;
  const os = numOs ? ordens.get(numOs) : null;
  if (numOs && !os) relatorio.osNaoAchada.push(`${ref}: OS ${numOs} não existe no Control`);

  let customerId = os?.customer_id ?? null;
  if (!os) {
    customerId = acharCliente(eq);
    if (!customerId) {
      relatorio.semCliente.push(`${ref}: cliente "${eq.cliente_nome ?? ''}" tel. ${eq.cliente_telefone ?? '-'} (${eq.status})`);
      continue;
    }
  } else if (eq.cliente_nome && norm(nomeCliente.get(os.customer_id)) !== norm(eq.cliente_nome)) {
    const a = norm(nomeCliente.get(os.customer_id)).split(' ')[0];
    if (a !== norm(eq.cliente_nome).split(' ')[0]) {
      relatorio.nomeDiferenteDaOS.push(`${ref}: no Equipamentos "${eq.cliente_nome}", na OS ${numOs} "${nomeCliente.get(os.customer_id)}"`);
    }
  }

  const garantia = Boolean(eq.eh_garantia);
  const decisao = garantia && decisaoAntiga === 'aprovado' ? null : decisaoAntiga;
  const entrada = eq.data_entrada || eq.created_at;
  const final = ['entregue', 'descarte'].includes(status);
  const numDevolucao = /^\d+$/.test(String(eq.os_devolucao ?? '').trim()) ? Number(String(eq.os_devolucao).trim()) : null;

  // O que não tem campo próprio no Control vai para a conferência, identificado
  const extras = [
    texto(eq.gas_refrigerante) && `Gás: ${eq.gas_refrigerante}`,
    numero(eq.valor_pecas) && `Peças (sistema antigo): R$ ${Number(eq.valor_pecas).toFixed(2)}`,
    numero(eq.valor_servico) && `Serviço (sistema antigo): R$ ${Number(eq.valor_servico).toFixed(2)}`,
    texto(eq.os_devolucao) && !numDevolucao && `OS de devolução (sistema antigo): ${eq.os_devolucao}`,
    texto(eq.relato_devolucao) && `Relato da devolução: ${eq.relato_devolucao}`,
    texto(eq.tecnico_retirada) && `Retirada (sistema antigo): ${eq.tecnico_retirada}`,
    texto(eq.tecnico_bancada) && `Bancada (sistema antigo): ${eq.tecnico_bancada}`,
  ].filter(Boolean);

  linhas.push({
    eq,
    numOs,
    osGarantia: texto(eq.os_garantia_origem),
    registro: {
      kind: 'equipamento',
      legacy_table: 'equipamentos',
      legacy_id: String(eq.id),
      legacy_reference: ref,
      service_order_id: os?.id ?? null,
      customer_id: customerId,
      status,
      equipment_type: texto(eq.tipo_equipamento) ?? 'Não informado',
      units_collected: converterUnidade(eq),
      brand: texto(eq.marca),
      model: texto(eq.modelo),
      serial_number: texto(eq.numero_serie),
      voltage: texto(eq.tensao),
      reported_defect: texto(eq.defeito_reclamado),
      field_report: texto(eq.relato_field),
      intake_notes: extras.length ? `[Importado do BRV Equipamentos]\n${extras.join('\n')}` : null,
      diagnosis: texto(eq.diagnostico_tecnico),
      parts_needed: texto(eq.pecas_necessarias),
      parts_status: converterPecas(eq.status_pecas),
      pickup_employee_id: acharFuncionario(eq.tecnico_retirada),
      bench_employee_id: acharFuncionario(eq.tecnico_bancada),
      is_warranty: garantia,
      quote_amount: numero(eq.valor_orcamento),
      decision: decisao,
      decision_channel: null,
      decision_note: decisao ? 'Importado do BRV Equipamentos (canal da resposta não registrado no sistema antigo).' : null,
      decision_at: decisao ? eq.data_aprovacao || null : null,
      discard_note: status === 'descarte'
        ? 'Descarte registrado no BRV Equipamentos (a autorização do cliente não era registrada no sistema antigo).'
        : null,
      discard_authorized_at: status === 'descarte' ? eq.data_entrega || null : null,
      return_service_order_id: numDevolucao ? ordens.get(numDevolucao)?.id ?? null : null,
      received_at: entrada,
      ready_at: eq.data_conclusao || null,
      finished_at: final ? eq.data_entrega || eq.data_conclusao || null : null,
      created_at: entrada,
    },
  });
}

// ---------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------
const contar = (lista, f) => lista.reduce((m, x) => m.set(f(x), (m.get(f(x)) ?? 0) + 1), new Map());
const porEtapa = contar(linhas, (l) => l.registro.status);
console.log(`\nItens a importar: ${linhas.length} de ${equipamentos.length}`);
for (const [e, n] of porEtapa) console.log(`  ${e.padEnd(22)} ${n}`);
console.log(`  com OS do Control: ${linhas.filter((l) => l.registro.service_order_id).length}, sem OS (balcão/antigos): ${linhas.filter((l) => !l.registro.service_order_id).length}`);
console.log(`Fora da importação: ${relatorio.semCliente.length} sem cliente reconhecido, ${relatorio.etapaDesconhecida.length} com etapa desconhecida`);

// ---------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------
let gravados = 0;
let eventos = 0;
let fotosOk = 0;
let fotosJa = 0;
const idNovo = new Map();   // id antigo → id no Control

if (!SIMULAR) {
  for (const l of linhas) {
    const { data, error } = await control
      .from('workshop_orders')
      .upsert(l.registro, { onConflict: 'legacy_table,legacy_id' })
      .select('id')
      .single();
    if (error) {
      console.error(`\n  ${l.registro.legacy_reference}: ${error.message}`);
      continue;
    }
    idNovo.set(String(l.eq.id), data.id);
    gravados++;
  }

  // Garantia: aponta para o item da OS de origem (segunda passada, todos já gravados)
  for (const l of linhas.filter((x) => x.osGarantia)) {
    const origem = linhas.find((x) => x !== l && (x.numOs && String(x.numOs) === l.osGarantia.replace(/\D/g, '')));
    const id = idNovo.get(String(l.eq.id));
    if (!origem || !id) {
      relatorio.garantiaSemOrigem.push(`${l.registro.legacy_reference}: origem "${l.osGarantia}" não encontrada`);
      continue;
    }
    await control.from('workshop_orders').update({ warranty_origin_id: idNovo.get(String(origem.eq.id)) }).eq('id', id);
  }

  // Histórico: refaz os eventos importados (marcados no autor) de cada item
  const etapaDoTexto = (s) => (s ? converterEtapa({ status: s })?.[0] ?? null : null);
  for (const [idAntigo, idControl] of idNovo) {
    const doItem = historico.filter((h) => String(h.equipamento_id) === idAntigo);
    await control.from('workshop_order_events').delete().eq('workshop_order_id', idControl).like('actor_name', `%${MARCA}`);
    if (doItem.length === 0) continue;
    const novos = doItem.map((h) => {
      const de = etapaDoTexto(h.status_anterior);
      const para = etapaDoTexto(h.status_novo);
      const mudou = h.status_anterior && h.status_novo && h.status_anterior !== h.status_novo;
      const notaEtapa = mudou && (!de || !para) ? `${h.status_anterior} → ${h.status_novo}` : null;
      return {
        workshop_order_id: idControl,
        event: mudou ? 'etapa' : 'nota',
        from_status: mudou ? de : null,
        to_status: mudou ? para : null,
        note: [notaEtapa, texto(h.observacao)].filter(Boolean).join('. ') || (mudou ? null : '(movimentação sem observação)'),
        actor_name: `${texto(h.usuario_nome) ?? 'Usuário'} ${MARCA}`,
        created_at: h.data_movimentacao || h.created_at,
      };
    });
    const { error } = await control.from('workshop_order_events').insert(novos);
    if (error) console.error(`\n  histórico ${idAntigo}: ${error.message}`);
    else eventos += novos.length;
  }
}

// ---------------------------------------------------------------------
// Fotos e vídeos: baixa do sistema antigo, envia por FTPS e registra em attachments
// ---------------------------------------------------------------------
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime' };
const extensao = (url) => (url.split('?')[0].split('.').pop() || '').toLowerCase();

/** Lista de mídias: as registradas em `midias` e os arquivos do Storage sem registro (pasta = id do equipamento). */
async function listarMidias() {
  const lista = midias
    .filter((m) => texto(m.caminho))
    .map((m) => ({
      id: String(m.id),
      equipamento: String(m.equipamento_id),
      url: m.caminho.startsWith('http') ? m.caminho : `${URL_ANTIGA}/${m.caminho.replace(/^\/+/, '')}`,
      fase: norm(m.fase || m.etapa),
      legenda: texto(m.observacao) ?? texto(m.nome_original),
      data: m.data_upload || m.created_at,
    }));
  const conhecidas = new Set(lista.map((m) => decodeURIComponent(m.url.split('?')[0])));
  for (const l of linhas) {
    const pasta = String(l.eq.id);
    const { data } = await antigo.storage.from('midias').list(pasta, { limit: 1000 });
    for (const arq of data ?? []) {
      if (!arq.id) continue; // subpasta
      const { data: pub } = antigo.storage.from('midias').getPublicUrl(`${pasta}/${arq.name}`);
      if (conhecidas.has(decodeURIComponent(pub.publicUrl))) continue;
      lista.push({ id: `storage-${pasta}-${arq.name}`, equipamento: pasta, url: pub.publicUrl, fase: '', legenda: 'Foto recuperada (sem registro no sistema antigo)', data: arq.created_at });
    }
  }
  return lista;
}

if (!SEM_FOTOS) {
  const todas = (await listarMidias()).filter((m) => SIMULAR || idNovo.has(m.equipamento));
  const semItem = todas.filter((m) => !linhas.some((l) => String(l.eq.id) === m.equipamento)).length;
  console.log(`\nMídias: ${todas.length} (${semItem} de itens fora da importação)`);

  if (!SIMULAR) {
    const conferirNome = (host, cert) =>
      checkServerIdentity(host, cert) === undefined ? undefined : checkServerIdentity('ftp.hostgator.com.br', cert);
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
    /** Envia com até 4 tentativas; se a conexão cair (ECONNRESET), reconecta. */
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
    const { data: jaRegistradas } = await control.from('attachments').select('storage_path').like('storage_path', 'oficina/%');
    const registradas = new Set((jaRegistradas ?? []).map((a) => a.storage_path));

    for (const m of todas) {
      const idItem = idNovo.get(m.equipamento);
      if (!idItem) continue;
      const ext = extensao(m.url) === 'jpeg' ? 'jpg' : extensao(m.url);
      const mime = MIME[ext];
      if (!mime) {
        relatorio.fotosFalha.push(`${m.url}: tipo de arquivo não aceito (.${ext})`);
        continue;
      }
      const nome = `${m.id.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120)}.${ext}`;
      const caminho = `oficina/${m.equipamento}/${nome}`;
      if (registradas.has(caminho)) {
        fotosJa++;
        continue;
      }
      try {
        const resp = await fetch(m.url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ao baixar`);
        const corpo = Buffer.from(await resp.arrayBuffer());
        if (corpo.length === 0) throw new Error('arquivo vazio');
        await enviarFtp(`/${DESTINO_FTP}/oficina/${m.equipamento}`, corpo, nome);
        const categoria = m.fase.includes('entrada') ? 'antes' : m.fase.includes('teste') || m.fase.includes('pronto') ? 'depois' : 'outros';
        const { error } = await control.from('attachments').insert({
          workshop_order_id: idItem,
          storage: 'hostgator',
          storage_path: caminho,
          public_url: `${URL_FOTOS}/${caminho}`,
          file_name: nome,
          mime_type: mime,
          size_bytes: corpo.length,
          category: categoria,
          caption: m.legenda,
          created_at: m.data || undefined,
        });
        if (error) throw new Error(`registro: ${error.message}`);
        fotosOk++;
        process.stdout.write(`\r  fotos enviadas: ${fotosOk}   `);
      } catch (e) {
        relatorio.fotosFalha.push(`${m.url}: ${e.message}`);
      }
    }
    ftp.close();
  }
}

// ---------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------
const secao = (titulo, itens) => (itens.length ? [`\n## ${titulo} (${itens.length})`, ...itens.map((i) => `- ${i}`)] : []);
const texto_relatorio = [
  `Importação BRV Equipamentos → Oficina do BRV Control${SIMULAR ? ' (SIMULAÇÃO, nada gravado)' : ''}`,
  `Data: ${new Date().toLocaleString('pt-BR')}`,
  `Equipamentos no sistema antigo: ${equipamentos.length}. Importáveis: ${linhas.length}.`,
  SIMULAR ? '' : `Gravados: ${gravados}. Eventos de histórico: ${eventos}. Fotos novas: ${fotosOk} (já estavam: ${fotosJa}).`,
  ...[...porEtapa].map(([e, n]) => `  ${e}: ${n}`),
  ...secao('SEM CLIENTE RECONHECIDO (não importados: cadastre o cliente no Control ou corrija no Equipamentos e rode de novo)', relatorio.semCliente),
  ...secao('Etapa desconhecida (não importados)', relatorio.etapaDesconhecida),
  ...secao('OS informada que não existe no Control (importados sem OS, pelo cliente)', relatorio.osNaoAchada),
  ...secao('Cliente do Equipamentos diferente do cliente da OS (conferir)', relatorio.nomeDiferenteDaOS),
  ...secao('Técnicos não reconhecidos (ficaram só no texto da conferência)', [...relatorio.tecnicoNaoAchado].map(([n, q]) => `${n} (${q}x)`)),
  ...secao('Garantia sem item de origem', relatorio.garantiaSemOrigem),
  ...secao('Fotos com falha (rode de novo para tentar outra vez)', relatorio.fotosFalha),
].join('\n');

await mkdir(PASTA_DADOS, { recursive: true });
const arqRelatorio = path.join(PASTA_DADOS, `relatorio-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}${SIMULAR ? '-simulacao' : ''}.txt`);
await writeFile(arqRelatorio, texto_relatorio + '\n', 'utf8');
console.log(`\n\nRelatório: ${arqRelatorio}`);
if (relatorio.semCliente.length) console.log(`ATENÇÃO: ${relatorio.semCliente.length} itens sem cliente reconhecido ficaram de fora (ver relatório).`);
