// Atualiza os modelos de tarefa do PMOC (decisão do usuário, 2026-11-17): os 22 itens vieram do modelo do Field Control,
// pensado para equipamento grande. Split Hi-Wall, Split Piso-Teto e Cassete passam a ter a lista própria de split
// (com a limpeza dos filtros de ar, que faltava); o VRF só perde a tarefa das correias.
// Vale para aparelhos incluídos depois: planos já criados mantêm as tarefas que têm.
// Uso: node scripts/pmoc/atualizar-modelos-tarefas.mjs [--simular]   (precisa de SUPABASE_SERVICE_ROLE_KEY no .env)
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
process.loadEnvFile(join(raiz, '.env'));
const simular = process.argv.includes('--simular');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CORRENTE = ['current_a'];
const TEMPERATURAS = ['temp_supply_c', 'temp_return_c', 'temp_ambient_c'];

// [descrição, periodicidade, campos de medição]
const SPLIT = [
  ['Limpar ou lavar os filtros de ar', 'mensal'],
  ['Verificar estado de fiação, terminais e contatos elétricos', 'mensal'],
  ['Medir e registrar a corrente elétrica do compressor e do ventilador', 'mensal', CORRENTE],
  ['Medir e registrar as temperaturas do ar de insuflamento, de retorno e do ambiente', 'mensal', TEMPERATURAS],
  ['Limpar a bandeja de condensado e testar o escoamento do dreno', 'mensal'],
  ['Verificar ruídos e vibrações anormais', 'mensal'],
  ['Verificar o funcionamento do controle remoto e do sensor de temperatura', 'mensal'],
  ['Lavar a serpentina e a bandeja da evaporadora com remoção do biofilme (sem produto desengraxante ou corrosivo)', 'trimestral'],
  ['Limpar o gabinete e a turbina (ventilador) da evaporadora', 'trimestral'],
  ['Efetuar o reaperto dos terminais elétricos e dos parafusos de fixação', 'trimestral'],
  ['Verificar a carga de gás refrigerante e sinais de vazamento nas conexões', 'trimestral'],
  ['Eliminar sujeira, danos e corrosão no gabinete, na moldura da serpentina e na bandeja', 'trimestral'],
  ['Verificar o isolamento térmico da tubulação e a fixação da condensadora', 'trimestral'],
  ['Limpar a condensadora (serpentina e gabinete)', 'semestral'],
  ['Medir a resistência de isolamento do compressor e dos motores', 'semestral'],
  ['Verificar disjuntor, fusíveis e proteções elétricas do circuito', 'semestral'],
  ['Verificar o protetor térmico do compressor', 'semestral'],
];

// Cassete: as do split + bomba de dreno (depois do dreno) e painel/aletas (depois do gabinete)
const CASSETE = [
  ...SPLIT.slice(0, 5),
  ['Verificar o funcionamento da bomba de dreno', 'mensal'],
  ...SPLIT.slice(5, 9),
  ['Limpar o painel frontal e as aletas de direcionamento do ar', 'trimestral'],
  ...SPLIT.slice(9),
];

const NOVOS = {
  'Split Hi-Wall': { lista: SPLIT, descricao: 'Modelo padrão da BRV Niterói para split hi-wall (17 tarefas).' },
  'Split Piso-Teto': { lista: SPLIT, descricao: 'Checklist preventivo para split piso-teto (17 tarefas).' },
  Cassete: { lista: CASSETE, descricao: 'Checklist preventivo para cassete 1 ou 4 vias (19 tarefas, com bomba de dreno e painel).' },
};

function falhar(error, contexto) {
  if (error) throw new Error(`${contexto}: ${error.message}`);
}

const { data: modelos, error } = await sb.from('pmoc_task_templates').select('id, equipment_type, itens:pmoc_task_template_items(id, description)');
falhar(error, 'Erro ao ler os modelos');

for (const m of modelos) {
  const novo = NOVOS[m.equipment_type];
  if (novo) {
    console.log(`${m.equipment_type}: ${m.itens.length} -> ${novo.lista.length} tarefas`);
    if (simular) continue;
    // Apaga e grava de novo: o cronograma dos planos já criados não muda (template_item_id vira NULL, a tarefa fica)
    falhar((await sb.from('pmoc_task_template_items').delete().eq('template_id', m.id)).error, `Erro ao limpar ${m.equipment_type}`);
    const linhas = novo.lista.map(([description, periodicity, campos], i) => ({
      template_id: m.id,
      description,
      periodicity,
      relative_start_month: 1,
      requires_measurement: Boolean(campos),
      measurement_fields: campos ?? [],
      sort_order: i + 1,
    }));
    falhar((await sb.from('pmoc_task_template_items').insert(linhas)).error, `Erro ao gravar ${m.equipment_type}`);
    falhar((await sb.from('pmoc_task_templates').update({ description: novo.descricao }).eq('id', m.id)).error, `Erro ao atualizar ${m.equipment_type}`);
  } else if (m.equipment_type === 'VRF') {
    const correias = m.itens.filter((i) => /correia/i.test(i.description));
    console.log(`VRF: sai ${correias.length} tarefa(s) de correias (fica com ${m.itens.length - correias.length})`);
    if (simular || correias.length === 0) continue;
    falhar((await sb.from('pmoc_task_template_items').delete().in('id', correias.map((c) => c.id))).error, 'Erro ao tirar as correias do VRF');
    // Renumera
    const { data: restantes } = await sb.from('pmoc_task_template_items').select('id, sort_order').eq('template_id', m.id).order('sort_order');
    for (const [i, r] of (restantes ?? []).entries()) {
      if (r.sort_order !== i + 1) falhar((await sb.from('pmoc_task_template_items').update({ sort_order: i + 1 }).eq('id', r.id)).error, 'Erro ao renumerar o VRF');
    }
  } else {
    console.log(`${m.equipment_type}: sem mudança`);
  }
}
console.log(simular ? '\nSimulação: nada foi gravado.' : '\nModelos atualizados.');
