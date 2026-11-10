// Importa o apoio técnico do BRV Equipamentos para o módulo Placas do BRV Control (migration 20261110130000_placas_apoio_tecnico.sql):
//   fichas_tecnicas_split (131)  → board_tech_sheets
//   documentos_fabricantes (18, textos de códigos de erro) → board_manuals (só texto; o texto é o que a IA consulta)
//
// Repetível: casa por legacy_id e só INSERE o que ainda não existe (nunca sobrescreve ficha editada no Control).
// Uso:  node --env-file=.env scripts/equipamentos/importar-apoio-tecnico.mjs [--simular]
// Precisa no .env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (Control) e EQUIP_SERVICE_ROLE_KEY (Equipamentos).

import { createClient } from '@supabase/supabase-js';

const SIMULAR = process.argv.includes('--simular');
const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EQUIP_SERVICE_ROLE_KEY } = process.env;
const EQUIP_SUPABASE_URL = process.env.EQUIP_SUPABASE_URL || 'https://tnsmwpewdkdigwjyaufr.supabase.co';

for (const [nome, valor] of Object.entries({ VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EQUIP_SERVICE_ROLE_KEY })) {
  if (!valor) {
    console.error(`Falta ${nome} no .env.`);
    process.exit(1);
  }
}

const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
const control = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opcoes);
const antigo = createClient(EQUIP_SUPABASE_URL, EQUIP_SERVICE_ROLE_KEY, opcoes);

async function lerTudo(cliente, tabela) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await cliente.from(tabela).select('*').order('created_at').range(de, de + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    linhas.push(...data);
    if (data.length < 1000) return linhas;
  }
}

async function jaImportados(tabela) {
  const { data, error } = await control.from(tabela).select('legacy_id').not('legacy_id', 'is', null);
  if (error) throw new Error(`${tabela}: ${error.message}`);
  return new Set(data.map((l) => String(l.legacy_id)));
}

async function inserirEmLotes(tabela, linhas) {
  for (let i = 0; i < linhas.length; i += 100) {
    const { error } = await control.from(tabela).insert(linhas.slice(i, i + 100));
    if (error) throw new Error(`${tabela}: ${error.message}`);
  }
}

// ---- Fichas técnicas
const COLUNAS_FICHA = [
  'fabricante', 'linha', 'tipo_split', 'capacidade_btu', 'capacidade_w', 'evaporadora', 'medida_evaporadora', 'ref_evaporadora',
  'condensadora', 'medida_condensadora', 'ref_condensadora', 'revisao_manual', 'gas', 'cobre_liquido', 'cobre_succao', 'dist_min',
  'dist_padrao', 'dist_max', 'desnivel_max', 'carga_fabrica', 'carga_extra', 'regra_bitola', 'tensao', 'alimentacao_em', 'p_nominal',
  'p_max_dim', 'i_refrigeracao', 'i_aquecimento', 'i_max_dim', 'origem_eletrica', 'cabo_alimentacao', 'cabo_interligacao', 'protecao',
  'observacao', 'lacunas', 'fonte', 'arquivo_original_url',
];

const fichas = await lerTudo(antigo, 'fichas_tecnicas_split');
const fichasExistentes = await jaImportados('board_tech_sheets');
const fichasNovas = fichas
  .filter((f) => !fichasExistentes.has(String(f.id)) && String(f.fabricante ?? '').trim())
  .map((f) => ({
    ...Object.fromEntries(COLUNAS_FICHA.map((c) => [c, typeof f[c] === 'string' && f[c].trim() ? f[c].trim() : null])),
    legacy_id: f.id,
    created_at: f.created_at,
  }));

// ---- Manuais (textos de códigos de erro)
const documentos = await lerTudo(antigo, 'documentos_fabricantes');
const manuaisExistentes = await jaImportados('board_manuals');
const manuaisNovos = documentos
  .filter((d) => !manuaisExistentes.has(String(d.id)))
  .map((d) => ({
    manufacturer: String(d.fabricante ?? '').trim() || 'Outros',
    title: `Códigos de erro ${String(d.fabricante ?? '').trim()}`.trim(),
    file_name: d.nome_arquivo || `manual-${d.id}.txt`,
    file_type: 'TXT',
    file_size_bytes: Buffer.byteLength(d.conteudo ?? '', 'utf8'),
    file_url: null,
    content_text: d.conteudo ?? '',
    uploaded_by_name: 'Importado do BRV Equipamentos',
    legacy_id: d.id,
    created_at: d.created_at,
  }));

console.log(`Fichas: ${fichas.length} no Equipamentos, ${fichasExistentes.size} já no Control, ${fichasNovas.length} a importar.`);
console.log(`Manuais: ${documentos.length} no Equipamentos, ${manuaisExistentes.size} já no Control, ${manuaisNovos.length} a importar.`);

if (SIMULAR) {
  console.log('(--simular: nada foi gravado)');
  process.exit(0);
}

await inserirEmLotes('board_tech_sheets', fichasNovas);
await inserirEmLotes('board_manuals', manuaisNovos);
console.log('Pronto.');
