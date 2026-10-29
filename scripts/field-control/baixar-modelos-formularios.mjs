// Para cada modelo de formulário (form.id) busca UMA resposta completa e grava só a estrutura
// (perguntas, tipos, opções, condições), sem respostas. Lê amostra/formularios_respostas.json.
// Uso:  node --env-file=.env scripts/field-control/baixar-modelos-formularios.mjs
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://carchost.fieldcontrol.com.br';
const PASTA = path.join(import.meta.dirname, 'amostra');
const respostas = JSON.parse(await readFile(path.join(PASTA, 'formularios_respostas.json'), 'utf8'));

const porModelo = new Map();
for (const r of respostas) if (!porModelo.has(r.form.id)) porModelo.set(r.form.id, r);

const saida = [];
for (const r of porModelo.values()) {
  await new Promise((ok) => setTimeout(ok, 1100));
  const res = await fetch(`${BASE}/forms-answers/${r.id}`, {
    headers: { 'X-Api-Key': process.env.FIELD_CONTROL_API_KEY, 'User-Agent': 'brv-control-importacao/1.0' },
  });
  const f = await res.json();
  saida.push({
    formId: r.form.id,
    nome: f.name,
    perguntas: (f.questions ?? []).map(({ answer: _resposta, ...p }) => p),
  });
}
await writeFile(path.join(PASTA, 'formularios_modelos.json'), JSON.stringify(saida, null, 2));
console.log(saida.map((s) => `${s.nome}: ${s.perguntas.length} perguntas`).join('\n'));
