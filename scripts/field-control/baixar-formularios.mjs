// Baixa as respostas de formulários do Field Control (SOMENTE LEITURA) e resume os modelos
// (form.id) com suas perguntas. Saída em scripts/field-control/amostra/ (gitignored).
//
// Uso:  node --env-file=.env scripts/field-control/baixar-formularios.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://carchost.fieldcontrol.com.br';
const CHAVE = process.env.FIELD_CONTROL_API_KEY;
const PASTA = path.join(import.meta.dirname, 'amostra');
if (!CHAVE) {
  console.error('Falta FIELD_CONTROL_API_KEY no .env.');
  process.exit(1);
}

let ultima = 0;
async function get(caminho) {
  const espera = ultima + 1100 - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultima = Date.now();
  const res = await fetch(BASE + caminho, {
    headers: { 'X-Api-Key': CHAVE, 'User-Agent': 'brv-control-importacao/1.0' },
  });
  if (!res.ok) throw new Error(`${res.status} em ${caminho}`);
  return res.json();
}

const respostas = [];
for (let offset = 0; ; offset += 100) {
  const r = await get(`/forms-answers?limit=100&offset=${offset}`);
  const itens = r.items ?? [];
  respostas.push(...itens);
  console.log(`offset ${offset}: ${itens.length}`);
  if (itens.length < 100) break;
}

const modelos = new Map();
for (const r of respostas) {
  const id = r.form?.id ?? r.name;
  let m = modelos.get(id);
  if (!m) {
    m = { formId: id, nome: r.name, respostas: 0, arquivadas: 0, comEquipamento: 0, perguntas: r.questions ?? [] };
    modelos.set(id, m);
  }
  m.respostas++;
  if (r.archived) m.arquivadas++;
  if (r.equipment?.id) m.comEquipamento++;
  if ((r.questions?.length ?? 0) > m.perguntas.length) m.perguntas = r.questions;
}

await mkdir(PASTA, { recursive: true });
const lista = [...modelos.values()].map((m) => ({
  ...m,
  perguntas: m.perguntas.map(({ answer: _resposta, ...p }) => p), // sem respostas (dados de cliente)
}));
await writeFile(path.join(PASTA, 'formularios_modelos.json'), JSON.stringify(lista, null, 2));
await writeFile(path.join(PASTA, 'formularios_respostas.json'), JSON.stringify(respostas));
console.log(`${respostas.length} respostas, ${lista.length} modelos`);
