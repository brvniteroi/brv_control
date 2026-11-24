// Une cadastros duplicados de um mesmo cliente em um só (chama a função unir_clientes do banco).
//
// Ver cadastros parecidos (para achar o nome ou o id):
//   node --env-file=.env scripts/sicweb/unir-clientes.mjs --buscar "teresa miranda"
// Simular (não altera nada, mostra o que aconteceria):
//   node --env-file=.env scripts/sicweb/unir-clientes.mjs --principal "Teresa Maria Miranda Silva" --unir "Teresa Miranda" --unir "Teresa Miranda - Consultorio"
// Unir de verdade (mesmo comando + --gravar):
//   ... --gravar
// Em lote (os casos óbvios, sem escolher um a um):
//   node --env-file=.env scripts/sicweb/unir-clientes.mjs --lote-seguro            (simula tudo e escreve dados/saida/lote-seguro.csv para você conferir)
//   node --env-file=.env scripts/sicweb/unir-clientes.mjs --lote-seguro --gravar    (une de verdade; cada grupo é uma transação, um erro não afeta os outros)
//   --limite N   só os N primeiros grupos (para experimentar antes de rodar tudo)
//   Grupo SEGURO = cadastros com o mesmo nome (sem acento/maiúscula/pontuação) em que UM só tem OS, equipamento, PMOC, oficina ou placa
//   (ele fica como principal e precisa estar ativo), todos os outros só têm código do SicWeb (vendas), nenhum cadastro vazio e no máximo
//   um CPF/CNPJ. Se o principal está TODO EM MAIÚSCULAS e um duplicado não, o nome do duplicado passa a ser o do cadastro.
// Opções:
//   --principal <nome ou id>   cadastro que FICA (o que tem as OS costuma ser o melhor)
//   --unir <nome ou id>        cadastro duplicado que entra no principal e é apagado (repita para vários)
//   --rotulo "trecho=Rótulo"   dá nome a um endereço do principal cujo texto contém o trecho (ex.: --rotulo "quintino=Consultório")
//   --nome "Novo nome"         troca o nome do principal (ex.: tirar o CAIXA ALTA)
//   --gravar                   sem isto, só simula
// O que a função faz (e confere) está na migration 20261124130000_unir_clientes.sql. Precisa no .env: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.');
  process.exit(1);
}
const sb = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// ---------- argumentos ----------
const args = process.argv.slice(2);
const valores = (nome) => args.flatMap((a, i) => (a === nome && args[i + 1] !== undefined ? [args[i + 1]] : []));
const um = (nome) => valores(nome)[0];
const GRAVAR = args.includes('--gravar');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const falhou = (etapa, error) => {
  if (error) {
    console.error(`${etapa}: ${error.message}${error.details ? ` (${error.details})` : ''}`);
    process.exit(1);
  }
};

async function resumo(c) {
  const conta = async (tabela) => {
    const { count, error } = await sb.from(tabela).select('*', { count: 'exact', head: true }).eq('customer_id', c.id);
    falhou(tabela, error);
    return count ?? 0;
  };
  const [os, vendas, enderecos] = await Promise.all([conta('service_orders'), conta('sicweb_vendas'), conta('customer_addresses')]);
  return { ...c, os, vendas, enderecos };
}
const linha = (c) => `${c.name}  [${c.document ?? 'sem CPF/CNPJ'}]  ${c.os} OS, ${c.vendas} vendas, ${c.enderecos} endereço(s)${c.active ? '' : ', INATIVO'}  id ${c.id}`;

async function procurar(texto) {
  const termo = String(texto).trim();
  if (UUID.test(termo)) {
    const { data, error } = await sb.from('customers').select('id, name, document, active').eq('id', termo);
    falhou('customers', error);
    return data;
  }
  const { data, error } = await sb.from('customers').select('id, name, document, active').ilike('name', `%${termo.replace(/[%_]/g, '')}%`).order('name').limit(40);
  falhou('customers', error);
  const exatos = data.filter((c) => semAcento(c.name) === semAcento(termo));
  return exatos.length ? exatos : data;
}

async function resolver(texto, papel) {
  const achados = await procurar(texto);
  if (achados.length === 1) return resumo(achados[0]);
  const lista = await Promise.all(achados.map(resumo));
  console.error(achados.length === 0 ? `Nenhum cadastro encontrado para ${papel} "${texto}".` : `"${texto}" (${papel}) bate com ${achados.length} cadastros; use o nome completo ou o id:`);
  for (const c of lista) console.error(`  - ${linha(c)}`);
  process.exit(1);
}

// ---------- modo busca ----------
const busca = um('--buscar');
if (busca !== undefined) {
  const achados = await procurar(busca);
  if (!achados.length) console.log('Nada encontrado.');
  for (const c of await Promise.all(achados.map(resumo))) console.log(linha(c));
  process.exit(0);
}

// ---------- modo lote ----------
/** Lê a tabela inteira em páginas de 1000 (limite do Supabase). O primeiro nome de `colunas` é a chave usada para ordenar. */
async function lerTudo(tabela, colunas) {
  const chave = colunas.split(',')[0].trim();
  const out = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from(tabela).select(colunas).order(chave).range(de, de + 999);
    falhou(tabela, error);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
const CLIENTE_BALCAO = 'b38e330d-4cff-4af7-839e-7a93cf9ed4b2';
const csv = (linhas) => '﻿' + linhas.map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
const chaveNome = (nome) => semAcento(nome).replace(/[^a-z0-9]/g, '');
const TUDO_MAIUSCULO = (n) => n === n.toUpperCase() && /[A-Z]{3}/.test(n);

async function montarGruposSeguros() {
  const clientes = await lerTudo('customers', 'id, name, document, active');
  const contar = (linhas) => {
    const m = new Map();
    for (const l of linhas) m.set(l.customer_id, (m.get(l.customer_id) ?? 0) + 1);
    return m;
  };
  // "operacional" = qualquer coisa do dia a dia que NÃO é só histórico de venda do SicWeb
  const operacional = new Map();
  for (const t of ['service_orders', 'equipments', 'pmoc_plans', 'workshop_orders', 'board_orders']) {
    for (const [id, n] of contar(await lerTudo(t, 'id, customer_id'))) operacional.set(id, (operacional.get(id) ?? 0) + n);
  }
  const codigos = contar(await lerTudo('customer_sicweb_codes', 'codigo, customer_id'));
  const vendas = contar(await lerTudo('sicweb_vendas', 'controle, customer_id'));
  const os = contar(await lerTudo('service_orders', 'id, customer_id'));

  const grupos = new Map();
  for (const c of clientes) {
    if (c.id === CLIENTE_BALCAO || /balc/i.test(c.name)) continue;
    const k = chaveNome(c.name);
    if (!k) continue;
    const m = { ...c, operacional: operacional.get(c.id) ?? 0, codigos: codigos.get(c.id) ?? 0, vendas: vendas.get(c.id) ?? 0, os: os.get(c.id) ?? 0 };
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(m);
  }
  const seguros = [];
  let nomesIguais = 0;
  for (const membros of grupos.values()) {
    if (membros.length < 2) continue;
    nomesIguais++;
    const comOperacional = membros.filter((m) => m.operacional > 0);
    if (comOperacional.length !== 1) continue; // nenhum ou vários: decidir um a um
    const principal = comOperacional[0];
    if (!principal.active) continue;
    const outros = membros.filter((m) => m !== principal);
    if (outros.some((m) => m.codigos === 0)) continue; // cadastro vazio ou que não veio do SicWeb: olhar
    if (new Set(membros.map((m) => m.document).filter(Boolean)).size > 1) continue; // CPF/CNPJ diferentes: olhar
    const nomeMelhor = TUDO_MAIUSCULO(principal.name) ? outros.find((m) => !TUDO_MAIUSCULO(m.name))?.name : null;
    seguros.push({ principal, outros, nome: nomeMelhor ?? null });
  }
  seguros.sort((a, b) => a.principal.name.localeCompare(b.principal.name));
  return { seguros, nomesIguais };
}

if (args.includes('--lote-seguro')) {
  const limite = Number(um('--limite')) || Infinity;
  const { seguros: todos, nomesIguais } = await montarGruposSeguros();
  const grupos = todos.slice(0, limite);
  console.log(`\n${GRAVAR ? 'UNINDO DE VERDADE' : 'SIMULAÇÃO (nada será alterado)'} em lote`);
  console.log(`${nomesIguais} grupos de nomes iguais; ${todos.length} são seguros; processando ${grupos.length}.`);

  const pasta = path.join(import.meta.dirname, 'dados', 'saida');
  mkdirSync(pasta, { recursive: true });
  const planilha = [['Fica (principal)', 'OS do principal', 'CPF/CNPJ do principal', 'Entra (duplicado)', 'Vendas do duplicado', 'CPF/CNPJ do duplicado', 'Nome que o cadastro terá', 'id principal', 'id duplicado']];
  for (const g of grupos) for (const o of g.outros) planilha.push([g.principal.name, g.principal.os, g.principal.document ?? '', o.name, o.vendas, o.document ?? '', g.nome ?? g.principal.name, g.principal.id, o.id]);
  writeFileSync(path.join(pasta, 'lote-seguro.csv'), csv(planilha));
  console.log(`Planilha para conferir: scripts/sicweb/dados/saida/lote-seguro.csv (${planilha.length - 1} duplicados em ${grupos.length} grupos)`);

  const tot = { os: 0, equipamentos: 0, vendas: 0, codigos: 0, contatos: 0, enderecosCopiados: 0, enderecosIguais: 0 };
  const falhas = [];
  const resultado = [['Principal', 'Resultado', 'OS movidas', 'Vendas movidas', 'Endereços copiados', 'Endereços iguais', 'Erro']];
  let feitos = 0;
  for (const g of grupos) {
    const { data, error } = await sb.rpc('unir_clientes', {
      p_principal: g.principal.id,
      p_duplicados: g.outros.map((o) => o.id),
      p_simular: !GRAVAR,
      p_rotulos: [],
      p_nome: g.nome,
    });
    if (error) {
      falhas.push({ nome: g.principal.name, erro: error.message });
      resultado.push([g.principal.name, 'FALHOU', '', '', '', '', error.message]);
      continue;
    }
    feitos++;
    const copiados = data.enderecos_tratados.filter((e) => e.acao.startsWith('copiado')).length;
    tot.os += data.movido_os;
    tot.equipamentos += data.movido_equipamentos;
    tot.vendas += data.movido_vendas;
    tot.codigos += data.movido_codigos;
    tot.contatos += data.contatos_movidos;
    tot.enderecosCopiados += copiados;
    tot.enderecosIguais += data.enderecos_tratados.length - copiados;
    resultado.push([g.principal.name, GRAVAR ? 'unido' : 'simulado ok', data.movido_os, data.movido_vendas, copiados, data.enderecos_tratados.length - copiados, '']);
    if (feitos % 25 === 0) process.stdout.write(`\r  ${feitos}/${grupos.length}   `);
  }
  process.stdout.write('\n');
  writeFileSync(path.join(pasta, 'lote-resultado.csv'), csv(resultado));
  console.log(`\n${GRAVAR ? 'Unidos' : 'Simulados com sucesso'}: ${feitos} de ${grupos.length} grupos.`);
  console.log(`Movimento: ${tot.os} OS, ${tot.equipamentos} equipamentos, ${tot.vendas} vendas, ${tot.codigos} códigos do SicWeb, ${tot.contatos} contatos.`);
  console.log(`Endereços: ${tot.enderecosIguais} já existiam no principal, ${tot.enderecosCopiados} foram copiados (ficam como "Do cadastro: <nome>"; renomeie depois se quiser).`);
  if (falhas.length) {
    console.log(`\nFALHARAM ${falhas.length} (nada foi alterado nesses grupos):`);
    for (const x of falhas) console.log(`  - ${x.nome}: ${x.erro}`);
  }
  console.log(GRAVAR ? '\nPronto. Resultado em scripts/sicweb/dados/saida/lote-resultado.csv' : '\nSimulação: nada foi alterado. Confira o lote-seguro.csv e rode de novo com --gravar.');
  process.exit(falhas.length ? 2 : 0);
}

// ---------- unir ----------
const textoPrincipal = um('--principal');
const textosDup = valores('--unir');
if (!textoPrincipal || textosDup.length === 0) {
  console.error('Uso: --principal <nome ou id> --unir <nome ou id> [--unir ...] [--rotulo "trecho=Rótulo"] [--nome "Nome"] [--gravar]\n     --buscar "texto" lista cadastros para achar o nome ou o id.');
  process.exit(1);
}
const rotulos = valores('--rotulo').map((r) => {
  const i = r.indexOf('=');
  if (i < 1) {
    console.error(`--rotulo "${r}" inválido: use "trecho=Rótulo".`);
    process.exit(1);
  }
  return { trecho: r.slice(0, i).trim(), rotulo: r.slice(i + 1).trim() };
});

const principal = await resolver(textoPrincipal, 'principal');
const duplicados = [];
for (const t of textosDup) duplicados.push(await resolver(t, 'a unir'));
const ids = [principal.id, ...duplicados.map((d) => d.id)];
if (new Set(ids).size !== ids.length) {
  console.error('O mesmo cadastro aparece mais de uma vez.');
  process.exit(1);
}

console.log(`\n${GRAVAR ? 'UNINDO DE VERDADE' : 'SIMULAÇÃO (nada será alterado)'}`);
console.log(`Fica:  ${linha(principal)}`);
for (const d of duplicados) console.log(`Entra: ${linha(d)}`);

const { data, error } = await sb.rpc('unir_clientes', {
  p_principal: principal.id,
  p_duplicados: duplicados.map((d) => d.id),
  p_simular: !GRAVAR,
  p_rotulos: rotulos,
  p_nome: um('--nome') ?? null,
});
falhou('unir_clientes (a migration 20261124130000 já foi aplicada?)', error);

console.log('\nEndereços dos duplicados:');
for (const e of data.enderecos_tratados) console.log(`  - ${e.origem}: ${e.acao}${e.rotulo ? ` (nome "${e.rotulo}")` : ''}`);
console.log(`\nMovidos: ${data.movido_os} OS, ${data.movido_equipamentos} equipamento(s), ${data.movido_vendas} venda(s), ${data.movido_codigos} código(s) do SicWeb, ${data.contatos_movidos} contato(s) (${data.contatos_repetidos_descartados} repetido(s) descartado(s)).`);
if (data.documento_veio_do_duplicado) console.log(`CPF/CNPJ ${data.documento} veio do cadastro duplicado.`);
console.log(`\nCadastro final: ${data.principal}${data.documento ? `  [${data.documento}]` : ''}`);
console.log(`  ${data.os} OS, ${data.vendas} venda(s), ${data.contatos} contato(s), códigos do SicWeb: ${data.codigos_sicweb || '-'}`);
console.log('  Endereços:');
for (const e of data.enderecos) console.log(`   ${e.principal ? '*' : '-'} ${e.rotulo ? `[${e.rotulo}] ` : ''}${e.endereco}`);
console.log(GRAVAR ? '\nPronto: cadastros unidos.' : '\nSimulação: nada foi alterado. Para unir de verdade, repita o comando com --gravar.');
