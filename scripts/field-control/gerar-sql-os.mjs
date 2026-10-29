// Gera o SQL da amostra: tipos de OS, colaboradores, OS, atividades e anexos (links).
// Saída em amostra/ (ignorada pelo git). Antes: baixar-amostra.mjs e a referência
// (_referencias.json). Ordem no SQL Editor: 1) tipos_e_colaboradores.sql  2) clientes.sql  3) os.sql
// Todos são idempotentes por field_control_id.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PASTA = path.join(import.meta.dirname, 'amostra');
const lit = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : `'${String(v).replace(/'/g, "''")}'`);
// Data de origem; sem ela vale a de agora (NULL explícito ignora o DEFAULT e viola NOT NULL)
const ts = (v) => `COALESCE(${lit(v ?? null)}::timestamptz, NOW())`;
const limpo = (s) => (typeof s === 'string' && s.trim() ? s.trim().replace(/[ \t]+/g, ' ') : null);

const ref = JSON.parse(await readFile(path.join(PASTA, '_referencias.json'), 'utf8'));
// Colaboradores que são a mesma pessoa (colaboradores.json): o duplicado vira o principal
const config = JSON.parse(await readFile(path.join(import.meta.dirname, 'colaboradores.json'), 'utf8'));
const idPorNome = new Map(ref.employees.map((e) => [e.name.trim(), e.id]));
const idDe = (nome) => {
  const id = idPorNome.get(nome);
  if (!id) throw new Error(`colaboradores.json: "${nome}" não existe no Field Control`);
  return id;
};
const principalDe = new Map(config.mesmaPessoa.map((m) => [idDe(m.duplicado), idDe(m.principal)]));
const canon = (id) => principalDe.get(id) ?? id;
const ajuste = new Map(config.mesmaPessoa.map((m) => [idDe(m.principal), m]));
const nomeTipo = new Map(ref.services.map((s) => [s.id, s.name.trim()]));

// ---------- 1) tipos de OS e colaboradores ----------
const CORES = ['#2563EB', '#16A34A', '#DC2626', '#9333EA', '#EA580C', '#0891B2', '#CA8A04', '#DB2777', '#4F46E5', '#65A30D', '#0D9488', '#B91C1C', '#7C3AED'];
const refs = ['-- Tipos de OS e colaboradores do Field Control\n'];
for (const s of ref.services) {
  refs.push(`INSERT INTO public.service_types (name, default_duration_minutes, active, field_control_id)
VALUES (${lit(s.name.trim())}, ${lit(s.duration > 0 ? s.duration : null)}, ${lit(!s.archived)}, ${lit(s.id)})
ON CONFLICT (field_control_id) DO UPDATE SET name = EXCLUDED.name, default_duration_minutes = EXCLUDED.default_duration_minutes, active = EXCLUDED.active;`);
}
ref.employees.forEach((e, i) => {
  if (principalDe.has(e.id)) return; // duplicado: não vira cadastro, só aponta para o principal
  refs.push(`INSERT INTO public.employees (name, role, email, timeline_color, active, field_control_id, created_at)
VALUES (${lit(limpo(e.name))}, 'tecnico', ${lit(ajuste.get(e.id) && 'email' in ajuste.get(e.id) ? ajuste.get(e.id).email : limpo(e.email))}, ${lit(CORES[i % CORES.length])}, ${lit(e.isActive !== false)}, ${lit(e.id)}, ${ts(e.createdAt)})
ON CONFLICT (field_control_id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, active = EXCLUDED.active;`);
});
await writeFile(path.join(PASTA, 'tipos_e_colaboradores.sql'), refs.join('\n') + '\n');

// Limpeza única do que já está no banco: repassa as atividades e apaga o cadastro duplicado
const fundir = ['-- Funde colaboradores duplicados (rodar uma vez, depois de tipos_e_colaboradores.sql)\n'];
for (const m of config.mesmaPessoa) {
  const dup = idDe(m.duplicado);
  const pri = idDe(m.principal);
  fundir.push(`DO $$
DECLARE v_dup UUID; v_pri UUID;
BEGIN
  SELECT id INTO v_dup FROM public.employees WHERE field_control_id = ${lit(dup)};
  SELECT id INTO v_pri FROM public.employees WHERE field_control_id = ${lit(pri)};
  IF v_pri IS NULL THEN RAISE EXCEPTION 'Principal não encontrado: ${m.principal.replace(/'/g, "''")}'; END IF;
  IF v_dup IS NOT NULL THEN
    UPDATE public.tasks SET employee_id = v_pri WHERE employee_id = v_dup;
    DELETE FROM public.employees WHERE id = v_dup;
  END IF;
END $$;`);
}
await writeFile(path.join(PASTA, 'colaboradores_fundir.sql'), fundir.join('\n') + '\n');

// ---------- 2) OS, atividades e anexos ----------
const STATUS_TAREFA = { pending: 'pendente', scheduled: 'agendada', 'in-progress': 'em_execucao', done: 'concluida', canceled: 'cancelada', reported: 'pausada' };
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function statusOS(tarefas) {
  const ativas = tarefas.filter((t) => !t.archived);
  if (ativas.length === 0) return 'aberta';
  const tem = (s) => ativas.some((t) => t.status === s);
  if (tem('in-progress')) return 'em_andamento';
  if (tem('reported')) return 'pausada';
  if (tem('scheduled')) return 'agendada';
  if (tem('pending')) return 'aberta';
  if (ativas.every((t) => t.status === 'canceled')) return 'cancelada';
  return 'concluida';
}

const sql = ['-- OS, atividades e anexos (links) do Field Control. Rodar depois de tipos_e_colaboradores.sql e clientes.sql\n'];
let nOS = 0, nTarefas = 0, nAnexos = 0;

for (const f of (await readdir(PASTA)).filter((f) => f.endsWith('.json') && !f.startsWith('_'))) {
  const d = JSON.parse(await readFile(path.join(PASTA, f), 'utf8'));
  const cli = d.cliente;
  const localPrincipal = cli.primaryLocation?.id ?? null;
  sql.push(`-- ===== ${limpo(cli.name)} =====`);

  for (const os of [...d.ordens].reverse()) {
    const tarefas = d.atividades[os.id] ?? [];
    const status = statusOS(tarefas);
    const ativas = tarefas.filter((t) => !t.archived);
    const concluidoEm = status === 'concluida' ? ativas.map((t) => t.completedAt).filter(Boolean).sort().at(-1) ?? null : null;
    const canceladoEm = status === 'cancelada' ? os.updatedAt ?? os.createdAt : null;
    const loc = os.location?.id ?? localPrincipal;
    nOS++;
    sql.push(`INSERT INTO public.service_orders (number, customer_id, address_id, service_type_id, status, description, opened_at, due_date, completed_at, cancelled_at, cancel_reason, field_control_id, created_at)
SELECT ${Number(os.identifier)}, c.id,
  (SELECT a.id FROM public.customer_addresses a WHERE a.field_control_id = ${lit(loc)} AND a.customer_id = c.id),
  (SELECT t.id FROM public.service_types t WHERE t.field_control_id = ${lit(os.service?.id)}),
  ${lit(status)}, ${lit(limpo(os.description))}, ${ts(os.createdAt)}, ${lit(os.deadlineAt ? os.deadlineAt.slice(0, 10) : null)}, ${lit(concluidoEm)}, ${lit(canceladoEm)}, ${lit(canceladoEm ? 'Cancelada no Field Control' : null)}, ${lit(os.id)}, ${ts(os.createdAt)}
FROM public.customers c WHERE c.field_control_id = ${lit(cli.id)}
ON CONFLICT (field_control_id) DO UPDATE SET status = EXCLUDED.status, description = EXCLUDED.description, completed_at = EXCLUDED.completed_at, cancelled_at = EXCLUDED.cancelled_at, cancel_reason = EXCLUDED.cancel_reason;`);

    const titulo = nomeTipo.get(os.service?.id) ?? 'Atividade';
    for (const t of ativas) {
      const emp = t.employee?.id ? canon(t.employee.id) : null;
      const data = t.scheduling?.date ?? null;
      const hora = t.scheduling?.time ?? '08:00:00'; // atividade só com data: começa às 08:00
      let st = STATUS_TAREFA[t.status] ?? 'pendente';
      if (st === 'agendada' && (!emp || !data)) st = 'pendente'; // exigido pela constraint tasks_scheduled_needs_slot
      const inicio = data ? `('${data} ${hora}'::timestamp AT TIME ZONE 'America/Sao_Paulo')` : 'NULL';
      const fim = data ? `(('${data} ${hora}'::timestamp AT TIME ZONE 'America/Sao_Paulo') + interval '${Math.max(1, Number(t.duration) || 60)} minutes')` : 'NULL';
      // O banco exige início para ter fim
      const iniciou = t.startedAt ?? t.completedAt ?? null;
      const terminou = t.completedAt ?? null;
      nTarefas++;
      sql.push(`INSERT INTO public.tasks (service_order_id, employee_id, title, description, status, scheduled_start, scheduled_end, started_at, finished_at, checkin_lat, checkin_lng, checkout_lat, checkout_lng, technician_notes, field_control_id, created_at)
SELECT o.id, (SELECT e.id FROM public.employees e WHERE e.field_control_id = ${lit(emp)}), ${lit(titulo)}, ${lit(limpo(t.description))}, ${lit(st)}, ${inicio}, ${fim}, ${lit(iniciou)}, ${lit(terminou)}, ${lit(t.startCoords?.latitude ?? null)}, ${lit(t.startCoords?.longitude ?? null)}, ${lit(t.completeCoords?.latitude ?? null)}, ${lit(t.completeCoords?.longitude ?? null)}, ${lit(limpo(t.statusDescription))}, ${lit(t.id)}, ${ts(t.createdAt)}
FROM public.service_orders o WHERE o.field_control_id = ${lit(os.id)}
ON CONFLICT (field_control_id) DO UPDATE SET status = EXCLUDED.status, employee_id = EXCLUDED.employee_id, scheduled_start = EXCLUDED.scheduled_start, scheduled_end = EXCLUDED.scheduled_end, started_at = EXCLUDED.started_at, finished_at = EXCLUDED.finished_at, technician_notes = EXCLUDED.technician_notes;`);
    }

    for (const a of d.anexos[os.id] ?? []) {
      if (!a.path) continue;
      const nomeArq = a.path.split('/').pop();
      const ext = nomeArq.split('.').pop().toLowerCase();
      nAnexos++;
      sql.push(`INSERT INTO public.attachments (service_order_id, task_id, storage, storage_path, public_url, file_name, mime_type, caption, field_control_id, created_at)
SELECT o.id, (SELECT t.id FROM public.tasks t WHERE t.field_control_id = ${lit(a.task?.id ?? null)}), 'fieldcontrol', ${lit(a.path)}, ${lit(a.path)}, ${lit(nomeArq)}, ${lit(MIME[ext] ?? null)}, ${lit(limpo(a.title))}, ${lit(a.id)}, ${ts(a.createdAt)}
FROM public.service_orders o WHERE o.field_control_id = ${lit(os.id)}
ON CONFLICT (field_control_id) DO NOTHING;`);
    }
  }
}
// A numeração das OS novas continua depois da maior OS importada
sql.push("SELECT setval(pg_get_serial_sequence('public.service_orders', 'number'), (SELECT MAX(number) FROM public.service_orders));");
await writeFile(path.join(PASTA, 'os.sql'), sql.join('\n') + '\n');
console.log(`${ref.services.length} tipos, ${ref.employees.length - principalDe.size} colaboradores (${principalDe.size} fundidos) | ${nOS} OS, ${nTarefas} atividades, ${nAnexos} anexos`);
