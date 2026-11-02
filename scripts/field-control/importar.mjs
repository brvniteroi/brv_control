// Importa o backup do Field Control (scripts/field-control/dados/, gerado por baixar-tudo.mjs e
// baixar-fotos.mjs) direto no Supabase. Idempotente por field_control_id: pode rodar de novo
// (ex.: na atualização final) que só atualiza o que mudou.
//
// Uso:  node --env-file=.env scripts/field-control/importar.mjs [--simular]
//   --simular  só confere e conta, sem gravar nada
// Precisa no .env: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (chave de admin: SÓ neste PC,
// nunca no app nem no GitHub). Antes: migration 20261102100000_importacao_field.sql aplicada.
// As fotos são enviadas à parte (enviar-fotos.mjs); aqui só os registros apontando para elas.
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PASTA = process.env.FC_PASTA || path.join(import.meta.dirname, 'dados');
const URL_FOTOS = (process.env.FC_URL_FOTOS || 'https://control.brvniteroi.com.br/api/uploads').replace(/\/+$/, '');
const SIMULAR = process.argv.includes('--simular');
const LOTE = 500;

const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.');
  process.exit(1);
}
const sb = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// ---------- utilitários ----------
const arq = (nome) => path.join(PASTA, nome);
const json = async (nome) => JSON.parse(await readFile(arq(nome), 'utf8'));
async function ndjson(nome) {
  if (!existsSync(arq(nome))) return [];
  return (await readFile(arq(nome), 'utf8')).split('\n').filter(Boolean).flatMap((l) => {
    try {
      return [JSON.parse(l)];
    } catch {
      return [];
    }
  });
}
const limpo = (s) => (typeof s === 'string' && s.trim() ? s.trim().replace(/[ \t]+/g, ' ') : null);
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const lotes = (xs, n = LOTE) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
// Mesmo nome de arquivo que baixar-fotos.mjs usa (ids do Field são base64)
const seguro = (id) => createHash('sha1').update(id).digest('hex').slice(0, 16);

function falhou(etapa, error) {
  if (error) throw new Error(`${etapa}: ${error.message}${error.details ? ` (${error.details})` : ''}`);
}

/** Grava em lotes (upsert por field_control_id, a não ser que outra chave seja passada). */
async function gravar(tabela, linhas, { onConflict = 'field_control_id', ignorar = false } = {}) {
  if (SIMULAR || linhas.length === 0) return;
  let n = 0;
  for (const lote of lotes(linhas)) {
    const { error } = await sb.from(tabela).upsert(lote, { onConflict, ignoreDuplicates: ignorar });
    falhou(tabela, error);
    n += lote.length;
    process.stdout.write(`\r  ${tabela}: ${n}/${linhas.length}   `);
  }
  console.log();
}

/** Mapa field_control_id -> id (lê a tabela toda em páginas de 1000). */
async function mapa(tabela, extra = '') {
  const m = new Map();
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from(tabela).select(`id, field_control_id${extra}`).not('field_control_id', 'is', null).range(de, de + 999);
    falhou(tabela, error);
    for (const r of data) m.set(r.field_control_id, extra ? r : r.id);
    if (data.length < 1000) break;
  }
  return m;
}

async function todos(tabela, colunas) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from(tabela).select(colunas).range(de, de + 999);
    falhou(tabela, error);
    linhas.push(...data);
    if (data.length < 1000) break;
  }
  return linhas;
}

// ---------- dados do backup ----------
console.log(`Backup: ${PASTA}${SIMULAR ? '  (SIMULAÇÃO: nada será gravado)' : ''}\n`);
const tiposFC = await json('tipos_os.json');
const colaboradoresFC = await json('colaboradores.json');
const clientesFC = await json('clientes.json');
// As 6 OS sem número no Field (testes da implantação, 2018) ficam de fora: apagadas em 2026-11-02 a pedido do usuário
const ordensFC = (await json('ordens.json')).filter((o) => /^\d+$/.test(o.identifier));
const idsOrdens = new Set(ordensFC.map((o) => o.id));
const atividadesFC = (await json('atividades.json')).filter((t) => idsOrdens.has(t.order?.id));
const detalhesCliente = new Map((await ndjson('clientes_detalhes.ndjson')).map((l) => [l.id, l]));
// Uma OS pode ter sido rebaixada (FC_REFAZER_DESDE): vale a última linha
const anexosPorOS = [...new Map((await ndjson('anexos.ndjson')).map((l) => [l.id, l])).values()];
const fotosBaixadas = new Map((await ndjson('fotos.ndjson')).map((f) => [f.anexo, f]));
const formulariosFC = [...new Map((await ndjson('formularios_detalhes.ndjson')).map((l) => [l.id, l])).values()].map((l) => l.resposta).filter(Boolean);

const semDetalhe = clientesFC.filter((c) => !detalhesCliente.has(c.id)).length;
if (semDetalhe) console.log(`Aviso: ${semDetalhe} clientes ainda sem endereços/contatos baixados (etapa "clientes"); usando o endereço e o contato principais.\n`);

// ---------- 1. tipos de OS ----------
console.log('1. Tipos de OS');
{
  const existentes = await todos('service_types', 'id, name, field_control_id');
  const porNome = new Map(existentes.map((t) => [semAcento(t.name), t]));
  const comFC = new Set(existentes.map((t) => t.field_control_id).filter(Boolean));
  const novos = [];
  for (const s of tiposFC) {
    if (comFC.has(s.id)) continue;
    const igual = porNome.get(semAcento(s.name));
    if (igual && !igual.field_control_id) {
      // Já cadastrado à mão com o mesmo nome: só liga ao Field
      if (!SIMULAR) falhou('service_types', (await sb.from('service_types').update({ field_control_id: s.id }).eq('id', igual.id)).error);
      continue;
    }
    if (igual) continue; // nome repetido no próprio Field: as OS apontam para o primeiro (abaixo)
    novos.push({ name: limpo(s.name), default_duration_minutes: s.duration > 0 ? s.duration : null, active: !s.archived, field_control_id: s.id });
    porNome.set(semAcento(s.name), { field_control_id: s.id });
  }
  await gravar('service_types', novos);
  console.log(`  ${novos.length} novos`);
}

// ---------- 2. colaboradores ----------
console.log('2. Colaboradores');
const config = JSON.parse(await readFile(path.join(import.meta.dirname, 'colaboradores.json'), 'utf8'));
const idFCPorNome = new Map(colaboradoresFC.map((e) => [e.name.trim(), e.id]));
const idFC = (nome) => {
  const id = idFCPorNome.get(nome);
  if (!id) throw new Error(`colaboradores.json: "${nome}" não existe no Field Control`);
  return id;
};
const principalDe = new Map(config.mesmaPessoa.map((m) => [idFC(m.duplicado), idFC(m.principal)]));
const canon = (id) => principalDe.get(id) ?? id;
{
  const CORES = ['#2563EB', '#16A34A', '#DC2626', '#9333EA', '#EA580C', '#0891B2', '#CA8A04', '#DB2777', '#4F46E5', '#65A30D', '#0D9488', '#B91C1C', '#7C3AED'];
  const ajuste = new Map(config.mesmaPessoa.map((m) => [idFC(m.principal), m]));
  const existentes = await todos('employees', 'id, name, field_control_id');
  const comFC = new Set(existentes.map((e) => e.field_control_id).filter(Boolean));
  const porNome = new Map(existentes.filter((e) => !e.field_control_id).map((e) => [semAcento(e.name), e]));
  const novos = [];
  colaboradoresFC.forEach((e, i) => {
    if (principalDe.has(e.id) || comFC.has(e.id)) return;
    const igual = porNome.get(semAcento(e.name));
    if (igual) {
      igual.ligar = e.id; // cadastrado na Equipe com o mesmo nome: liga ao Field
      return;
    }
    const aj = ajuste.get(e.id);
    novos.push({ name: limpo(e.name), role: 'tecnico', email: aj && 'email' in aj ? aj.email : limpo(e.email), timeline_color: CORES[i % CORES.length], active: e.isActive !== false, field_control_id: e.id });
  });
  for (const e of porNome.values()) if (e.ligar && !SIMULAR) falhou('employees', (await sb.from('employees').update({ field_control_id: e.ligar }).eq('id', e.id)).error);
  await gravar('employees', novos);
  console.log(`  ${novos.length} novos, ${principalDe.size} fundidos no principal`);
}

// ---------- 3. etiquetas ----------
console.log('3. Etiquetas');
const tagPorNome = new Map();
{
  const CORES_TAG = { 'servico pago': '#16A34A', 'nao cobrado': '#64748B', 'aguard. pagamen': '#EA580C', cancelado: '#DC2626', 'equip na loja': '#0891B2', 'peca na loja': '#9333EA', 'voltar p continuar': '#CA8A04' };
  const nomes = new Map();
  for (const o of ordensFC) for (const l of o.labels ?? []) nomes.set(semAcento(l.name), limpo(l.name));
  const existentes = await todos('tags', 'id, name');
  for (const t of existentes) tagPorNome.set(semAcento(t.name), t.id);
  const novas = [...nomes].filter(([k]) => !tagPorNome.has(k)).map(([k, nome]) => ({ name: nome.slice(0, 40), color: CORES_TAG[k] ?? '#2563EB' }));
  if (novas.length && !SIMULAR) {
    const { data, error } = await sb.from('tags').insert(novas).select('id, name');
    falhou('tags', error);
    for (const t of data) tagPorNome.set(semAcento(t.name), t.id);
  }
  console.log(`  ${nomes.size} etiquetas no Field, ${novas.length} criadas`);
}

// ---------- 4. clientes, endereços e contatos ----------
console.log('4. Clientes');
const UF = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};
const uf = (e) => (!limpo(e) ? 'RJ' : /^[A-Za-z]{2}$/.test(e.trim()) ? e.trim().toUpperCase() : (UF[semAcento(e)] ?? 'RJ'));
function telefone(n) {
  let d = String(n ?? '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d || null;
}
const ROTULO_TEL = { mobile: 'Celular', home: 'Casa', work: 'Comercial', other: 'Telefone' };
const enderecoDe = (a, extra) => ({
  zip_code: String(a?.postalCode ?? a?.zipCode ?? '').replace(/\D/g, '') || null,
  street: limpo(a?.street) ?? '(sem logradouro)',
  number: limpo(a?.number),
  complement: limpo(a?.complement),
  district: limpo(a?.neighborhood),
  city: limpo(a?.city) ?? 'Niterói',
  state: uf(a?.state),
  latitude: a?.coords?.latitude ?? null,
  longitude: a?.coords?.longitude ?? null,
  ...extra,
});

const clientes = [];
const enderecos = []; // { fcCliente, linha }
const contatos = []; // { fcCliente, linha }
let docsDescartados = 0;
for (const c of clientesFC) {
  const nome = limpo(c.name) ?? '(sem nome)';
  let doc = String(c.documentNumber ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  let tipo = doc.length === 14 ? 'PJ' : 'PF';
  let notas = limpo(c.notes);
  if (doc && !(/^\d{11}$/.test(doc) || /^[0-9A-Z]{12}\d{2}$/.test(doc))) {
    notas = [notas, `Documento no Field Control: ${c.documentNumber}`].filter(Boolean).join('\n');
    doc = '';
    tipo = 'PF';
    docsDescartados++;
  }
  clientes.push({ person_type: tipo, name: nome, document: doc || null, notes: notas, active: !c.archived, field_control_id: c.id, created_at: c.createdAt ?? undefined });

  const det = detalhesCliente.get(c.id);
  const locs = Array.isArray(det?.localizacoes) ? det.localizacoes : [];
  const principal = locs.filter((l) => !l.archived).find((l) => l.id === c.primaryLocation?.id) ?? locs.find((l) => !l.archived);
  for (const l of locs) {
    // No Field o nome da localização costuma repetir o do cliente: só vira apelido se for diferente
    const apelido = limpo(l.name) && semAcento(l.name) !== semAcento(nome) ? limpo(l.name) : null;
    enderecos.push({ fcCliente: c.id, linha: enderecoDe(l.address, { label: apelido, is_primary: l === principal, active: !l.archived, field_control_id: l.id }) });
  }
  if (locs.length === 0 && (c.address?.street || c.primaryLocation?.id)) {
    // Sem a lista de localizações: usa o endereço principal que vem no próprio cliente
    enderecos.push({ fcCliente: c.id, linha: enderecoDe(c.address, { label: null, is_primary: true, active: true, field_control_id: c.primaryLocation?.id ?? `${c.id}#endereco` }) });
  }

  // Contato principal junta o telefone e o e-mail principais; os demais viram contatos extras
  const tels = Array.isArray(det?.telefones) ? det.telefones : c.contact?.phone ? [{ number: c.contact.phone, primary: true, type: 'mobile' }] : [];
  const mails = Array.isArray(det?.emails) ? det.emails : c.contact?.email ? [{ address: c.contact.email, primary: true }] : [];
  const telP = tels.find((t) => t.primary) ?? tels[0];
  const mailP = mails.find((m) => m.primary) ?? mails[0];
  if (telP || mailP) {
    contatos.push({ fcCliente: c.id, linha: { name: nome, role: telP ? (ROTULO_TEL[telP.type] ?? 'Telefone') : 'E-mail', phone: telP ? telefone(telP.number) : null, is_whatsapp: telP?.whatsapp ?? false, email: limpo(mailP?.address), is_primary: true } });
  }
  for (const t of tels) if (t !== telP && telefone(t.number)) contatos.push({ fcCliente: c.id, linha: { name: nome, role: ROTULO_TEL[t.type] ?? 'Telefone', phone: telefone(t.number), is_whatsapp: t.whatsapp ?? false, email: null, is_primary: false } });
  for (const m of mails) if (m !== mailP && limpo(m.address)) contatos.push({ fcCliente: c.id, linha: { name: nome, role: 'E-mail', phone: null, is_whatsapp: false, email: limpo(m.address), is_primary: false } });
}
await gravar('customers', clientes);
const clienteId = SIMULAR ? new Map() : await mapa('customers');
{
  // O principal pode ter mudado no Field: desmarca antes para não bater no "um principal por cliente"
  if (!SIMULAR) {
    const ids = [...new Set(enderecos.map((e) => clienteId.get(e.fcCliente)))].filter(Boolean);
    for (const lote of lotes(ids, 200)) falhou('customer_addresses', (await sb.from('customer_addresses').update({ is_primary: false }).in('customer_id', lote).not('field_control_id', 'is', null)).error);
  }
  await gravar('customer_addresses', enderecos.map((e) => ({ ...e.linha, customer_id: clienteId.get(e.fcCliente) })).filter((e) => SIMULAR || e.customer_id));
  // Contatos importados são recriados a cada execução (no Field não têm id próprio)
  if (!SIMULAR) {
    const ids = [...new Set(clientesFC.map((c) => clienteId.get(c.id)))].filter(Boolean);
    for (const lote of lotes(ids, 200)) falhou('customer_contacts', (await sb.from('customer_contacts').delete().in('customer_id', lote)).error);
    const linhas = contatos.map((k) => ({ ...k.linha, customer_id: clienteId.get(k.fcCliente) })).filter((k) => k.customer_id);
    // Principais primeiro: o trigger rebaixaria o principal se um extra chegasse antes marcado
    linhas.sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
    for (const lote of lotes(linhas)) falhou('customer_contacts', (await sb.from('customer_contacts').insert(lote)).error);
  }
  console.log(`  ${clientes.length} clientes, ${enderecos.length} endereços, ${contatos.length} contatos${docsDescartados ? `, ${docsDescartados} documentos inválidos guardados nas observações` : ''}`);
}

// ---------- 5. OS ----------
console.log('5. OS');
const STATUS_TAREFA = { pending: 'agendada', scheduled: 'agendada', 'on-route': 'em_deslocamento', 'in-progress': 'em_execucao', done: 'concluida', canceled: 'cancelada' };
// Em aberto no Field com data anterior a isto = esquecida: entra cancelada (decidido com o usuário em 2026-11-02)
const CORTE_ABERTAS = '2026-10-01';
const MOTIVO_ESQUECIDA = 'Em aberto no Field Control (não concluída)';
/**
 * Situação no BRV Control e observação extra. "reported" = o técnico encerrou relatando um impedimento
 * (o motivo vem em statusDescription): entra concluída, com o relato nas observações.
 */
function situacaoTarefa(t) {
  if (t.status === 'reported') return { st: 'concluida', nota: 'Relatada no Field Control (encerrada sem concluir o serviço)' };
  const st = STATUS_TAREFA[t.status] ?? 'agendada';
  const data = t.scheduling?.date ?? t.createdAt?.slice(0, 10);
  if (st !== 'concluida' && st !== 'cancelada' && data && data < CORTE_ABERTAS) return { st: 'cancelada', nota: MOTIVO_ESQUECIDA };
  return { st, nota: null };
}
const tarefasPorOS = new Map();
for (const t of atividadesFC) {
  if (t.archived) continue;
  const lista = tarefasPorOS.get(t.order.id) ?? [];
  lista.push(t);
  tarefasPorOS.set(t.order.id, lista);
}
/** Mesma regra do trigger tasks_atualiza_status_os; sem atividade ou todas canceladas: cancelada (antiga) ou agendada. */
function statusOS(o, tarefas) {
  const sts = tarefas.map((t) => situacaoTarefa(t).st);
  if (sts.some((s) => s === 'em_deslocamento' || s === 'em_execucao')) return { status: 'em_andamento' };
  if (sts.includes('agendada')) return { status: 'agendada' };
  if (sts.includes('concluida')) return { status: 'concluida' };
  if (sts.length > 0 && tarefas.every((t) => t.status === 'canceled')) return { status: 'cancelada', motivo: 'Cancelada no Field Control' };
  if (o.createdAt.slice(0, 10) < CORTE_ABERTAS) return { status: 'cancelada', motivo: sts.length ? MOTIVO_ESQUECIDA : 'Sem atividade no Field Control' };
  return { status: 'agendada' };
}
/** Fim da atividade encerrada (reportada às vezes vem sem completedAt). */
const fimDaTarefa = (t) => t.completedAt ?? t.startedAt ?? t.updatedAt ?? t.createdAt;
const tipoId = SIMULAR ? new Map() : await mapa('service_types');
const tipoPorNome = new Map(tiposFC.map((s) => [s.id, semAcento(s.name)]));
const tipoIdPorNome = new Map();
for (const s of tiposFC) if (tipoId.has(s.id) && !tipoIdPorNome.has(tipoPorNome.get(s.id))) tipoIdPorNome.set(tipoPorNome.get(s.id), tipoId.get(s.id));
const tipoDaOS = (fcId) => tipoId.get(fcId) ?? tipoIdPorNome.get(tipoPorNome.get(fcId));
const enderecoId = SIMULAR ? new Map() : await mapa('customer_addresses', ', customer_id');
const nomeTipo = new Map(tiposFC.map((s) => [s.id, limpo(s.name)]));
const localPrincipal = new Map(clientesFC.map((c) => [c.id, c.primaryLocation?.id]));
const tipoFCDaOS = new Map(ordensFC.map((o) => [o.id, o.service?.id]));
{
  // Numeração: OS já importada mantém o número; OS nova usa o número do Field se estiver livre
  // (o BRV Control pode já ter usado: rodada depois da virada); senão ganha o próximo livre, com o nº do Field anotado.
  const jaNoBanco = SIMULAR ? [] : await todos('service_orders', 'number, field_control_id, internal_notes');
  const doBanco = new Map(jaNoBanco.filter((e) => e.field_control_id).map((e) => [e.field_control_id, e]));
  const usados = new Set(jaNoBanco.map((e) => Number(e.number)));
  const ehNumero = (o) => /^\d+$/.test(o.identifier);
  const numeroDe = new Map();
  for (const o of ordensFC) if (doBanco.has(o.id)) numeroDe.set(o.id, { numero: Number(doBanco.get(o.id).number), nota: doBanco.get(o.id).internal_notes });
  const ordenadas = [...ordensFC].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  for (const o of ordenadas) {
    if (numeroDe.has(o.id) || !ehNumero(o) || usados.has(Number(o.identifier))) continue;
    numeroDe.set(o.id, { numero: Number(o.identifier), nota: null });
    usados.add(Number(o.identifier));
  }
  let proximo = Math.max(0, ...usados, ...ordensFC.filter(ehNumero).map((o) => Number(o.identifier))) + 1;
  for (const o of ordenadas) {
    if (!numeroDe.has(o.id)) numeroDe.set(o.id, { numero: proximo++, nota: `Nº no Field Control: ${o.identifier}` });
  }

  const linhas = [];
  for (const o of ordenadas) {
    const tarefas = tarefasPorOS.get(o.id) ?? [];
    const { status, motivo } = statusOS(o, tarefas);
    const cliente = clienteId.get(o.customer.id);
    const loc = o.location?.id ?? localPrincipal.get(o.customer.id);
    const end = enderecoId.get(loc) ?? enderecoId.get(`${o.customer.id}#endereco`);
    const { numero, nota } = numeroDe.get(o.id);
    linhas.push({
      number: numero,
      customer_id: cliente,
      address_id: end && end.customer_id === cliente ? end.id : null,
      service_type_id: tipoDaOS(o.service?.id),
      status,
      description: limpo(o.description),
      internal_notes: nota,
      field_control_created_by: limpo(o.createdBy?.name) === 'Jessica Moura' ? 'Jéssica Moura' : limpo(o.createdBy?.name),
      opened_at: o.createdAt,
      due_date: o.deadlineAt ? o.deadlineAt.slice(0, 10) : null,
      completed_at:
        status === 'concluida'
          ? (tarefas.filter((t) => situacaoTarefa(t).st === 'concluida').map(fimDaTarefa).filter(Boolean).sort().at(-1) ?? o.updatedAt ?? o.createdAt)
          : null,
      cancelled_at: status === 'cancelada' ? (o.updatedAt ?? o.createdAt) : null,
      cancel_reason: status === 'cancelada' ? motivo : null,
      field_control_id: o.id,
      created_at: o.createdAt,
    });
  }
  const semTipo = linhas.filter((l) => !SIMULAR && !l.service_type_id).length;
  if (semTipo) throw new Error(`${semTipo} OS sem tipo de OS correspondente`);
  await gravar('service_orders', linhas);
  console.log(`  ${linhas.length} OS (${linhas.filter((l) => l.internal_notes).length} com número novo)`);
}
const osId = SIMULAR ? new Map() : await mapa('service_orders');

// Etiquetas das OS
{
  const linhas = [];
  for (const o of ordensFC) for (const l of o.labels ?? []) {
    const tag = tagPorNome.get(semAcento(l.name));
    if (tag && osId.get(o.id)) linhas.push({ service_order_id: osId.get(o.id), tag_id: tag });
  }
  await gravar('service_order_tags', linhas, { onConflict: 'service_order_id,tag_id', ignorar: true });
  console.log(`  ${linhas.length} etiquetas ligadas às OS`);
}

// ---------- 6. atividades ----------
console.log('6. Atividades');
const colabId = SIMULAR ? new Map() : await mapa('employees');
{
  const linhas = [];
  let ignoradas = 0;
  for (const [fcOS, tarefas] of tarefasPorOS) {
    for (const t of tarefas) {
      const { st, nota } = situacaoTarefa(t);
      const emp = t.employee?.id ? colabId.get(canon(t.employee.id)) : null;
      const data = t.scheduling?.date ?? null;
      // Atividade em aberto sem técnico ou data não entra (regra do sistema)
      if (st !== 'concluida' && st !== 'cancelada' && ((!SIMULAR && !emp) || !t.employee?.id || !data)) {
        ignoradas++;
        continue;
      }
      const duracao = Math.max(1, Number(t.duration) || 60);
      // Horário de Brasília (sem horário de verão desde 2019; antes disso a diferença é de 1 h no máximo)
      const inicio = data ? new Date(`${data}T${t.scheduling?.time ?? '08:00:00'}-03:00`) : null;
      const terminou = st === 'concluida' ? fimDaTarefa(t) : (t.completedAt ?? null);
      let iniciou = t.startedAt ?? terminou ?? null;
      if (iniciou && terminou && terminou < iniciou) iniciou = terminou;
      linhas.push({
        service_order_id: osId.get(fcOS),
        employee_id: emp ?? null,
        title: nomeTipo.get(tipoFCDaOS.get(fcOS)) ?? 'Atividade',
        description: limpo(t.description),
        status: st,
        scheduled_start: inicio?.toISOString() ?? null,
        scheduled_end: inicio ? new Date(inicio.getTime() + duracao * 60_000).toISOString() : null,
        estimated_minutes: duracao,
        started_at: iniciou,
        finished_at: terminou,
        checkin_lat: t.startCoords?.latitude ?? null,
        checkin_lng: t.startCoords?.longitude ?? null,
        checkout_lat: t.completeCoords?.latitude ?? null,
        checkout_lng: t.completeCoords?.longitude ?? null,
        technician_notes: [nota, limpo(t.statusDescription)].filter(Boolean).join(': ') || null,
        field_control_id: t.id,
        created_at: t.createdAt,
      });
    }
  }
  await gravar('tasks', linhas.filter((l) => SIMULAR || l.service_order_id));
  console.log(`  ${linhas.length} atividades (${ignoradas} em aberto sem técnico ou data ficaram de fora)`);
}
const tarefaId = SIMULAR ? new Map() : await mapa('tasks');

// ---------- 7. anexos (fotos já enviadas à HostGator) ----------
console.log('7. Anexos');
{
  const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime' };
  const linhas = [];
  let semArquivo = 0;
  for (const { id: fcOS, anexos } of anexosPorOS) {
    for (const a of anexos ?? []) {
      const f = fotosBaixadas.get(a.id);
      if (!f) {
        semArquivo++; // não existe mais no S3 do Field
        continue;
      }
      const ext = f.arquivo.split('.').pop();
      // fotos/<os>/<anexo>.<ext> no backup -> uploads/fc/<os>/<anexo>.<ext> no servidor
      const caminho = `fc/${seguro(fcOS)}/${seguro(a.id)}.${ext}`;
      linhas.push({
        service_order_id: osId.get(fcOS),
        task_id: a.task?.id ? (tarefaId.get(a.task.id) ?? null) : null,
        storage: 'hostgator',
        storage_path: caminho,
        public_url: `${URL_FOTOS}/${caminho}`,
        file_name: a.path.split('/').pop().slice(0, 150),
        mime_type: MIME[ext] ?? null,
        size_bytes: f.bytes,
        caption: limpo(a.title),
        field_control_id: a.id,
        created_at: a.createdAt,
      });
    }
  }
  const semTipo = linhas.filter((l) => !l.mime_type).length;
  await gravar('attachments', linhas.filter((l) => l.mime_type && (SIMULAR || l.service_order_id)));
  console.log(`  ${linhas.length} anexos (${semArquivo} sem arquivo no Field, ${semTipo} de tipo não aceito)`);
}

// ---------- 8. formulários ----------
console.log('8. Formulários');
{
  const TIPO = { checkboxes: 'multi', 'multiple-choice': 'single', dropdown: 'dropdown', paragraph: 'textarea', 'short-answer': 'text' };
  const modelos = await todos('form_templates', 'id, name');
  const modeloPorNome = new Map(modelos.map((m) => [semAcento(m.name), m.id]));
  const existentes = SIMULAR ? new Set() : new Set((await mapa('form_responses')).keys());
  // Formulário no Field é da OS; aqui é da atividade: usa a última atividade concluída (ou a última)
  const tarefasDaOS = new Map();
  for (const [fcOS, tarefas] of tarefasPorOS) {
    const ordenadas = [...tarefas].filter((t) => tarefaId.get(t.id) || SIMULAR).sort((a, b) => ((a.completedAt ?? a.createdAt) < (b.completedAt ?? b.createdAt) ? -1 : 1));
    tarefasDaOS.set(fcOS, ordenadas.filter((t) => t.status === 'done').at(-1) ?? ordenadas.at(-1));
  }
  const linhas = [];
  let semAtividade = 0;
  for (const f of formulariosFC) {
    if (f.archived || existentes.has(f.id)) continue;
    const tarefa = tarefasDaOS.get(f.order?.id);
    if (!tarefa) {
      semAtividade++;
      continue;
    }
    const perguntas = [];
    const respostas = {};
    for (const q of [...(f.questions ?? [])].sort((a, b) => a.position - b.position)) {
      const id = `q${q.position}`;
      const tipo = TIPO[q.type] ?? 'textarea';
      const opcoes = (q.options ?? []).map((o) => o.value).filter(Boolean);
      perguntas.push({ id, type: tipo, title: limpo(q.title) ?? `Pergunta ${q.position}`, ...(q.required ? { required: true } : {}), ...(['single', 'dropdown', 'multi'].includes(tipo) ? { options: opcoes } : {}) });
      const r = q.answer;
      if (r === null || r === undefined || r === '') continue;
      // Múltipla escolha vem como "Casa&Apartamento"
      respostas[id] = tipo === 'multi' ? (Array.isArray(r) ? r : String(r).split('&').map((x) => x.trim()).filter(Boolean)) : String(r);
    }
    linhas.push({
      template_id: modeloPorNome.get(semAcento(f.name)) ?? null,
      template_name: limpo(f.name),
      questions: perguntas,
      answers: respostas,
      status: 'preenchido',
      task_id: tarefaId.get(tarefa.id),
      service_order_id: osId.get(f.order.id),
      filled_at: f.createdAt,
      field_control_id: f.id,
      created_at: f.createdAt,
    });
  }
  // Índice único parcial (field_control_id IS NOT NULL): insert simples, já filtrado acima
  if (!SIMULAR) for (const lote of lotes(linhas)) falhou('form_responses', (await sb.from('form_responses').insert(lote)).error);
  console.log(`  ${linhas.length} novos (${semAtividade} sem atividade na OS ficaram de fora)`);
}

// ---------- 9. numeração ----------
if (!SIMULAR) {
  const { data, error } = await sb.rpc('ajustar_numeracao_os');
  falhou('ajustar_numeracao_os', error);
  console.log(`\nPróxima OS nova: ${Number(data) + 1}`);
}
console.log(`\nImportação ${SIMULAR ? 'simulada' : 'concluída'}.`);
