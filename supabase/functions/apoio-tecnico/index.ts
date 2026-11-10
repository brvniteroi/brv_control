// Edge Function do apoio técnico das Placas (IA com o Gemini): duas ações numa função só.
//   acao = 'erro'  consulta de código de erro (lê primeiro os textos de board_manuals; sem texto, pesquisa na internet)
//   acao = 'ficha' leitura de manual PDF/TXT e preenchimento da ficha técnica (envio por multipart/form-data)
//
// Só admin e escritório ativos chamam (Verify JWT ligado + conferência do papel aqui). Limite de uso por pessoa por hora
// (tabela board_ai_usage). Segredo no Supabase: GEMINI_API_KEY (opcional: GEMINI_MODEL, padrão gemini-flash-latest).
// Publicar: Supabase > Edge Functions > Deploy a new function > nome `apoio-tecnico` (colar este arquivo).
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente das funções.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

const ORIGENS = ['https://control.brvniteroi.com.br', 'http://localhost:5173'];
const LIMITE_POR_HORA = 40;
const MAX_ARQUIVO = 20 * 1024 * 1024;
const MAX_TEXTO_MANUAIS = 60_000;

const CAMPOS_FICHA = [
  'fabricante', 'linha', 'tipo_split', 'capacidade_btu', 'capacidade_w', 'evaporadora', 'ref_evaporadora', 'medida_evaporadora',
  'condensadora', 'ref_condensadora', 'medida_condensadora', 'revisao_manual', 'gas', 'cobre_liquido', 'cobre_succao', 'dist_min',
  'dist_padrao', 'dist_max', 'desnivel_max', 'carga_extra', 'carga_fabrica', 'regra_bitola', 'tensao', 'alimentacao_em', 'p_nominal',
  'p_max_dim', 'i_refrigeracao', 'i_aquecimento', 'i_max_dim', 'origem_eletrica', 'cabo_alimentacao', 'cabo_interligacao', 'protecao',
  'observacao', 'lacunas',
];

const semAcento = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

Deno.serve(async (req) => {
  const origem = req.headers.get('Origin') ?? '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (ORIGENS.includes(origem)) headers['Access-Control-Allow-Origin'] = origem;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  const responder = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers });

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    // Quem chama: admin ou escritório ativo
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: sessao, error: erroSessao } = await admin.auth.getUser(token);
    if (erroSessao || !sessao.user) return responder(401, { erro: 'Sessão inválida. Entre novamente.' });
    const { data: perfil } = await admin.from('profiles').select('role, active').eq('id', sessao.user.id).maybeSingle();
    if (!perfil?.active || !['admin', 'escritorio'].includes(perfil.role)) {
      return responder(403, { erro: 'Seu perfil não pode usar o apoio técnico.' });
    }

    const chave = Deno.env.get('GEMINI_API_KEY');
    if (!chave) return responder(500, { erro: 'A chave do Gemini (GEMINI_API_KEY) não está configurada no Supabase.' });

    const ehForm = (req.headers.get('Content-Type') ?? '').includes('multipart/form-data');
    const form = ehForm ? await req.formData() : null;
    const corpo = form ? null : await req.json();
    const acao = String(form ? form.get('acao') : corpo?.acao ?? '');
    if (!['erro', 'ficha'].includes(acao)) return responder(400, { erro: 'Ação inválida.' });

    // Limite de uso por pessoa por hora (protege a cota da chave)
    const desde = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await admin
      .from('board_ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', sessao.user.id)
      .gte('created_at', desde);
    if ((count ?? 0) >= LIMITE_POR_HORA) {
      return responder(429, { erro: `Limite de ${LIMITE_POR_HORA} consultas por hora atingido. Tente de novo mais tarde.` });
    }
    await admin.from('board_ai_usage').insert({ user_id: sessao.user.id, action: acao });

    if (acao === 'erro') return responder(200, await consultarErro(admin, chave, corpo));
    return responder(200, await extrairFicha(chave, form!));
  } catch (e) {
    console.error('apoio-tecnico:', e);
    return responder(500, { erro: e instanceof Error ? e.message : 'Erro inesperado.' });
  }
});

// ---------------------------------------------------------------------
// Gemini (REST direto; com tentativas para 429/5xx)
// ---------------------------------------------------------------------
async function gemini(
  chave: string,
  partes: unknown[],
  opcoes: { sistema?: string; json?: boolean; buscaNaInternet?: boolean; modelo?: string } = {},
): Promise<string> {
  const modelo = opcoes.modelo ?? Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest';
  const corpo: Record<string, unknown> = {
    contents: [{ role: 'user', parts: partes }],
    generationConfig: { temperature: 0.2, ...(opcoes.json ? { responseMimeType: 'application/json' } : {}) },
  };
  if (opcoes.sistema) corpo.systemInstruction = { parts: [{ text: opcoes.sistema }] };
  if (opcoes.buscaNaInternet) corpo.tools = [{ googleSearch: {} }];

  for (let tentativa = 1; ; tentativa++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify(corpo),
    });
    if (r.ok) {
      const dados = await r.json();
      const texto = (dados?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
      if (!texto) throw new Error('A IA não devolveu resposta. Tente de novo.');
      return texto;
    }
    const transitorio = [429, 500, 503, 504].includes(r.status);
    if (!transitorio || tentativa >= 3) {
      const detalhe = (await r.text()).slice(0, 300);
      throw new Error(`O serviço de IA falhou (${r.status}). ${r.status === 429 ? 'Cota esgotada, tente em alguns minutos.' : detalhe}`);
    }
    await new Promise((ok) => setTimeout(ok, 1500 * tentativa));
  }
}

function lerJson(texto: string): Record<string, unknown> {
  const limpo = texto.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const ini = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (ini < 0 || fim < ini) throw new Error('A IA respondeu fora do formato esperado. Tente de novo.');
  return JSON.parse(limpo.slice(ini, fim + 1));
}

const lista = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);

// ---------------------------------------------------------------------
// Código de erro
// ---------------------------------------------------------------------
async function consultarErro(admin: ReturnType<typeof createClient>, chave: string, c: Record<string, string>) {
  const marca = String(c?.marca ?? '').trim();
  const modelo = String(c?.modelo ?? '').trim();
  const consulta = String(c?.consulta ?? '').trim();
  if (!marca || !consulta) throw new Error('Informe a marca e o código de erro ou sintoma.');

  // Textos de manuais da marca (comparação sem acento nos dois sentidos: "LG" casa "LG Electronics")
  const { data: manuais } = await admin.from('board_manuals').select('manufacturer, title, file_name, content_text').not('content_text', 'is', null);
  const alvo = semAcento(marca);
  const doFabricante = (manuais ?? []).filter((m) => {
    const f = semAcento(m.manufacturer);
    return f.includes(alvo) || alvo.includes(f);
  });
  let texto = '';
  for (const m of doFabricante) {
    const bloco = `--- ARQUIVO: ${m.file_name} (${m.title}) ---\n${m.content_text}\n\n`;
    if (texto.length + bloco.length > MAX_TEXTO_MANUAIS) break;
    texto += bloco;
  }
  const temManual = texto.length > 0;

  const formato = `Responda SOMENTE com um objeto JSON válido (sem markdown) com exatamente estas chaves:
{
  "significado": "o que o código ou sintoma significa para esta marca",
  "causas_provaveis": ["da mais para a menos frequente"],
  "verificacoes": ["passos objetivos de verificação, em ordem"],
  "componentes_envolvidos": ["componentes da placa ou periféricos envolvidos"],
  "aviso_seguranca": "alerta de segurança elétrica ou null",
  "fonte_descricao": "de onde veio a resposta (nome do arquivo do manual ou do site oficial)",
  "encontrado": true
}
Se o código NÃO constar na fonte oficial, devolva "encontrado": false, "significado": "Código não localizado na documentação oficial do fabricante ${marca}." e listas vazias. Nunca invente significado de código.`;

  const sistema = temManual
    ? `Você apoia técnicos de bancada de placas de ar-condicionado split inverter. Responda em português do Brasil. Use APENAS os manuais abaixo, que são a documentação do fabricante guardada pela empresa.\n\nMANUAIS:\n${texto}\n\n${formato}`
    : `Você apoia técnicos de bancada de placas de ar-condicionado split inverter. Responda em português do Brasil. Não há manual desta marca guardado: pesquise na internet SOMENTE em sites oficiais do fabricante (ex.: daikin.com.br, lg.com/br, samsung.com/br, midea.com/br, gree.com.br, elgin.com.br, agratto.com.br, fujitsu-general.com/br, carrierdobrasil.com.br, tcl.com/br, hisense.com.br, electrolux.com.br, philco.com.br, consul.com.br, komeco.com.br, springer). Nunca use fóruns ou blogs. Se não achar em fonte oficial, diga que não localizou.\n\n${formato}`;

  const pergunta = `Marca: ${marca}\nModelo: ${modelo || 'não informado'}\nCódigo de erro ou sintoma: ${consulta}`;
  const resposta = lerJson(await gemini(chave, [{ text: pergunta }], { sistema, json: temManual, buscaNaInternet: !temManual }));

  return {
    significado: String(resposta.significado ?? ''),
    causas_provaveis: lista(resposta.causas_provaveis),
    verificacoes: lista(resposta.verificacoes),
    componentes_envolvidos: lista(resposta.componentes_envolvidos),
    aviso_seguranca: resposta.aviso_seguranca ? String(resposta.aviso_seguranca) : null,
    fonte_tipo: temManual ? 'manual_fabricante' : 'pesquisa_ia',
    fonte_descricao: String(resposta.fonte_descricao ?? (temManual ? 'Manuais guardados no sistema' : 'Pesquisa da IA em sites oficiais')),
    encontrado: resposta.encontrado !== false,
  };
}

// ---------------------------------------------------------------------
// Ficha técnica a partir do manual (PDF ou TXT)
// ---------------------------------------------------------------------
async function extrairFicha(chave: string, form: FormData) {
  const arquivo = form.get('arquivo');
  if (!(arquivo instanceof File)) throw new Error('Nenhum arquivo enviado.');
  if (arquivo.size === 0) throw new Error('Não foi possível ler este arquivo.');
  if (arquivo.size > MAX_ARQUIVO) throw new Error('Este arquivo é muito grande (máximo de 20 MB).');
  const nome = arquivo.name.toLowerCase();
  const ehTxt = arquivo.type === 'text/plain' || nome.endsWith('.txt');
  const ehPdf = arquivo.type === 'application/pdf' || nome.endsWith('.pdf');
  if (!ehTxt && !ehPdf) throw new Error('Formato não suportado. Envie apenas arquivos PDF ou TXT.');

  const modeloJson = `{${CAMPOS_FICHA.map((c) => `"${c}": ""`).join(', ')}}`;
  const instrucao = `Você é especialista em refrigeração e ar-condicionado. Leia o manual anexo e preencha a ficha técnica do split.
REGRAS: use APENAS o que está no documento; é proibido chutar ou usar conhecimento externo; se a informação não estiver clara ou não existir, preencha exatamente "não encontrado". medida_evaporadora e medida_condensadora no formato Largura x Altura x Profundidade (ex.: 80 x 30 x 20 cm), de preferência sem a embalagem. Em "lacunas" liste o que faltou ou ficou ambíguo. Responda SOMENTE com um JSON válido, sem markdown, com exatamente estas chaves: ${modeloJson}`;

  const parte = ehTxt
    ? { text: `DOCUMENTO:\n${await arquivo.text()}` }
    : { inlineData: { mimeType: 'application/pdf', data: encodeBase64(new Uint8Array(await arquivo.arrayBuffer())) } };
  const r = lerJson(await gemini(chave, [{ text: instrucao }, parte], { json: true, modelo: Deno.env.get('GEMINI_MODEL_FICHA') ?? undefined }));

  const ficha: Record<string, string | null> = {};
  const conferir: string[] = [];
  for (const campo of CAMPOS_FICHA) {
    const v = String(r[campo] ?? '').trim();
    const faltou = !v || /^n[ãa]o encontrado$/i.test(v);
    ficha[campo] = faltou ? null : v;
    if (faltou && campo !== 'lacunas' && campo !== 'observacao') conferir.push(campo);
  }
  ficha.fonte = arquivo.name;
  ficha.arquivo_original_url = null;
  return { ficha, campos_conferir: conferir };
}
