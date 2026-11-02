// Importa as avaliações dos clientes do Field Control (dados/avaliacoes.json) para public.ratings.
// Uma por atividade do Field (field_control_id = id da atividade); rodar de novo só atualiza.
// Não mexe em OS nem atividades (não roda o importador inteiro, que sobrescreveria o que o escritório mudou).
//
// Uso:  node --env-file=.env scripts/field-control/importar-avaliacoes.mjs [--simular]
// Precisa: migration 20261102160000_avaliacoes.sql aplicada; VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PASTA = process.env.FC_PASTA || path.join(import.meta.dirname, 'dados');
const SIMULAR = process.argv.includes('--simular');
const { VITE_SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: CHAVE } = process.env;
if (!URL || !CHAVE) {
  console.error('Falta VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.');
  process.exit(1);
}
const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });

async function todos(tabela, colunas) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from(tabela).select(colunas).not('field_control_id', 'is', null).range(de, de + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    linhas.push(...data);
    if (data.length < 1000) break;
  }
  return linhas;
}

const avaliacoes = JSON.parse(await readFile(path.join(PASTA, 'avaliacoes.json'), 'utf8'));
const tarefas = new Map((await todos('tasks', 'id, service_order_id, employee_id, field_control_id')).map((t) => [t.field_control_id, t]));
const clienteDaOS = new Map((await todos('service_orders', 'id, customer_id, field_control_id')).map((o) => [o.id, o.customer_id]));

const linhas = [];
let semAtividade = 0;
for (const a of avaliacoes) {
  const t = tarefas.get(a.task?.id);
  if (!t || !clienteDaOS.get(t.service_order_id)) {
    semAtividade++;
    continue;
  }
  const comentario = typeof a.comment === 'string' ? a.comment.trim().slice(0, 1000) : '';
  linhas.push({
    service_order_id: t.service_order_id,
    task_id: t.id,
    employee_id: t.employee_id,
    customer_id: clienteDaOS.get(t.service_order_id),
    stars: Math.min(5, Math.max(1, Math.round(Number(a.stars) || 1))),
    comment: comentario || null,
    field_control_id: a.task.id,
    created_at: a.createdAt,
  });
}

if (!SIMULAR) {
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await sb.from('ratings').upsert(linhas.slice(i, i + 500), { onConflict: 'field_control_id' });
    if (error) throw new Error(`ratings: ${error.message}`);
    process.stdout.write(`\r  ${Math.min(i + 500, linhas.length)}/${linhas.length}`);
  }
  console.log();
}
console.log(`${SIMULAR ? 'Simulação: ' : ''}${linhas.length} avaliações${semAtividade ? ` (${semAtividade} de atividades que não estão no banco ficaram de fora)` : ''}.`);
