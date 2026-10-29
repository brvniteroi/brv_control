import type { Pergunta, Resposta, Respostas } from '../types/formularios';

export const TIPOS_PERGUNTA: Record<Pergunta['type'], string> = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  number: 'Número',
  single: 'Escolha única',
  dropdown: 'Lista suspensa',
  multi: 'Múltipla escolha',
  date: 'Data',
  photo: 'Fotos',
  signature: 'Assinatura',
};

export function respostaVazia(r: Resposta | undefined): boolean {
  if (r === undefined || r === null) return true;
  if (typeof r === 'string') return r.trim() === '';
  if (Array.isArray(r)) return r.length === 0;
  return Number.isNaN(r);
}

/** A pergunta aparece se não tem condição ou se a resposta da outra pergunta bate com `in`. */
export function perguntaVisivel(p: Pergunta, respostas: Respostas): boolean {
  if (!p.visible_if) return true;
  const r = respostas[p.visible_if.question];
  const marcadas = Array.isArray(r) ? r : typeof r === 'string' ? [r] : [];
  return marcadas.some((v) => p.visible_if!.in.includes(v));
}

/** Só as perguntas visíveis (a que depende de uma pergunta escondida também some). */
export function perguntasVisiveis(perguntas: Pergunta[], respostas: Respostas): Pergunta[] {
  const visiveis: Pergunta[] = [];
  const ids = new Set<string>();
  for (const p of perguntas) {
    const pai = p.visible_if?.question;
    if (pai && !ids.has(pai)) continue;
    if (perguntaVisivel(p, respostas)) {
      visiveis.push(p);
      ids.add(p.id);
    }
  }
  return visiveis;
}

/** Mensagens em português por pergunta (id -> erro). Vazio = pode concluir. */
export function validarRespostas(perguntas: Pergunta[], respostas: Respostas): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const p of perguntasVisiveis(perguntas, respostas)) {
    if (p.required && respostaVazia(respostas[p.id])) erros[p.id] = 'Resposta obrigatória';
  }
  return erros;
}

/** Remove respostas de perguntas escondidas antes de salvar. */
export function limparRespostasOcultas(perguntas: Pergunta[], respostas: Respostas): Respostas {
  const ids = new Set(perguntasVisiveis(perguntas, respostas).map((p) => p.id));
  return Object.fromEntries(Object.entries(respostas).filter(([id]) => ids.has(id)));
}

/** Chave estável a partir do título (usada ao criar pergunta nova no construtor). */
export function novoIdPergunta(titulo: string, existentes: string[]): string {
  const base =
    titulo
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30) || 'pergunta';
  let id = base;
  for (let n = 2; existentes.includes(id); n++) id = `${base}_${n}`;
  return id;
}
