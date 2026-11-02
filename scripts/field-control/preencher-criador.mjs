// Preenche service_orders.field_control_created_by (nome de quem criou a OS no Field) nas OS já importadas.
// Só mexe nessa coluna (não roda o importador inteiro, que sobrescreveria o que o escritório mudou).
//
// Uso:  node --env-file=.env scripts/field-control/preencher-criador.mjs
// Precisa: migration 20261102140000_criador_os.sql aplicada; VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PASTA = process.env.FC_PASTA || path.join(import.meta.dirname, 'dados');
const { VITE_SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: CHAVE } = process.env;
if (!URL || !CHAVE) {
  console.error('Falta VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.');
  process.exit(1);
}
const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });

// O Field tem a mesma pessoa escrita de dois jeitos
const MESMO_NOME = { 'Jessica Moura': 'Jéssica Moura' };

const ordens = JSON.parse(await readFile(path.join(PASTA, 'ordens.json'), 'utf8'));
// Agrupa por nome: uma atualização por nome e lote de ids
const porNome = new Map();
for (const o of ordens) {
  const bruto = o.createdBy?.name?.trim().replace(/\s+/g, ' ');
  if (!bruto) continue;
  const nome = MESMO_NOME[bruto] ?? bruto;
  const ids = porNome.get(nome) ?? [];
  ids.push(o.id);
  porNome.set(nome, ids);
}

let feitas = 0;
for (const [nome, ids] of porNome) {
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const { error, count } = await sb
      .from('service_orders')
      .update({ field_control_created_by: nome }, { count: 'exact' })
      .in('field_control_id', lote);
    if (error) {
      console.error(`\nErro em "${nome}": ${error.message}`);
      process.exit(1);
    }
    feitas += count ?? 0;
    process.stdout.write(`\r  ${feitas} OS atualizadas`);
  }
}
console.log(`\nPronto: ${porNome.size} criadores diferentes (${[...porNome.keys()].join(', ')}).`);
