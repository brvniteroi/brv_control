import { TOPICOS, type TelaAjuda, type Topico } from './topicos';

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Tópicos da tela, na ordem em que foram escritos. */
export const topicosDaTela = (tela: TelaAjuda) => TOPICOS.filter((t) => t.telas.includes(tela));

/**
 * Busca sem acento: todas as palavras digitadas precisam aparecer no tópico.
 * Título vale mais que sinônimos, que valem mais que o texto; a tela atual desempata.
 */
export function buscarTopicos(termo: string, tela: TelaAjuda): Topico[] {
  const palavras = normalizar(termo).split(/\s+/).filter((p) => p.length > 1);
  if (!palavras.length) return [];

  return TOPICOS.map((t) => {
    const titulo = normalizar(t.titulo);
    const sinonimos = normalizar(t.palavras ?? '');
    const texto = normalizar(t.texto);
    let pontos = 0;
    for (const p of palavras) {
      if (titulo.includes(p)) pontos += 10;
      else if (sinonimos.includes(p)) pontos += 6;
      else if (texto.includes(p)) pontos += 2;
      else return { t, pontos: 0 };
    }
    if (t.telas.includes(tela)) pontos += 1;
    return { t, pontos };
  })
    .filter((r) => r.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .map((r) => r.t);
}
