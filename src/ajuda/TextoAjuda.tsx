import type { ReactNode } from 'react';
import { AlertTriangle, Lightbulb } from 'lucide-react';

/** Desenha o texto de um tópico (formato descrito em `topicos.ts`). */

type VarianteNegrito = 'padrao' | 'passo' | 'dica' | 'atencao';

const TECLAS_ATALHO = new Set(['F1', 'Esc', 'F5']);

const CLASSE_ETIQUETA: Record<VarianteNegrito, string> = {
  padrao:
    'rounded-md border border-slate-200/90 bg-slate-100/80 px-1.5 py-0.5 text-[13px] font-semibold text-slate-900 box-decoration-clone print:border-slate-300 print:bg-slate-50',
  passo:
    'rounded-md border border-slate-200/90 bg-white px-1.5 py-0.5 text-[13px] font-semibold text-slate-900 shadow-2xs box-decoration-clone print:border-slate-300 print:bg-slate-50 print:shadow-none',
  dica:
    'rounded-md border border-blue-200/90 bg-white/85 px-1.5 py-0.5 text-[13px] font-semibold text-blue-950 box-decoration-clone print:border-slate-300 print:bg-white print:text-slate-900',
  atencao:
    'rounded-md border border-amber-300/90 bg-white/85 px-1.5 py-0.5 text-[13px] font-semibold text-amber-950 box-decoration-clone print:border-slate-300 print:bg-white print:text-slate-900',
};

function negrito(linha: string, variante: VarianteNegrito = 'padrao'): ReactNode[] {
  return linha.split(/\*\*(.+?)\*\*/g).map((parte, i) => {
    if (i % 2 === 0) return parte;
    if (TECLAS_ATALHO.has(parte)) {
      return (
        <kbd
          key={i}
          className="inline-flex items-center rounded-md border border-slate-300 border-b-2 bg-white px-1.5 py-0.5 font-mono text-xs leading-none font-bold text-slate-800 shadow-2xs print:border-slate-400 print:shadow-none"
        >
          {parte}
        </kbd>
      );
    }
    return (
      <strong key={i} className={CLASSE_ETIQUETA[variante]}>
        {parte}
      </strong>
    );
  });
}

interface PassoNumerado {
  numero: number;
  texto: string;
}

type Bloco =
  | { tipo: 'passos'; itens: PassoNumerado[] }
  | { tipo: 'lista'; itens: string[] }
  | { tipo: 'dica' | 'atencao' | 'subtitulo' | 'paragrafo'; texto: string };

function separar(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  for (const bruta of texto.split('\n')) {
    const linha = bruta.trim();
    if (!linha) continue;
    const passo = linha.match(/^(\d+)\.\s+(.*)$/);
    if (passo) {
      const item: PassoNumerado = { numero: Number(passo[1]), texto: passo[2] };
      const ultimo = blocos[blocos.length - 1];
      if (ultimo && ultimo.tipo === 'passos') ultimo.itens.push(item);
      else blocos.push({ tipo: 'passos', itens: [item] });
    } else if (linha.startsWith('- ')) {
      const conteudo = linha.slice(2);
      const ultimo = blocos[blocos.length - 1];
      if (ultimo && ultimo.tipo === 'lista') ultimo.itens.push(conteudo);
      else blocos.push({ tipo: 'lista', itens: [conteudo] });
    } else if (linha.startsWith('> ')) blocos.push({ tipo: 'dica', texto: linha.slice(2) });
    else if (linha.startsWith('! ')) blocos.push({ tipo: 'atencao', texto: linha.slice(2) });
    else if (linha.startsWith('## ')) blocos.push({ tipo: 'subtitulo', texto: linha.slice(3) });
    else blocos.push({ tipo: 'paragrafo', texto: linha });
  }
  return blocos;
}

export default function TextoAjuda({ texto }: { texto: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-700 print:space-y-2">
      {separar(texto).map((b, i) => {
        switch (b.tipo) {
          case 'passos':
            return (
              <ol key={i} start={b.itens[0]?.numero ?? 1} role="list" className="space-y-2 print:space-y-1.5">
                {b.itens.map((item, j) => (
                  <li
                    key={j}
                    className="flex items-start gap-3 rounded-xl border border-slate-200/75 bg-slate-50/80 px-3.5 py-2.5 text-slate-800 print:rounded-none print:border-none print:bg-transparent print:px-0 print:py-0.5"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-2xs print:h-5 print:w-5 print:border print:border-slate-700 print:bg-slate-100 print:text-[11px] print:text-slate-900 print:shadow-none"
                    >
                      {item.numero}
                    </span>
                    <span className="min-w-0 flex-1 leading-relaxed">{negrito(item.texto, 'passo')}</span>
                  </li>
                ))}
              </ol>
            );
          case 'lista':
            return (
              <ul key={i} role="list" className="space-y-1.5 pl-1 print:space-y-1">
                {b.itens.map((item, j) => (
                  <li key={j} className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 print:bg-slate-600"
                    />
                    <span className="min-w-0 flex-1">{negrito(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'dica':
            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-blue-200/80 border-l-4 border-l-blue-500 bg-blue-50/75 px-3.5 py-3 text-blue-950 print:break-inside-avoid print:border-slate-300 print:border-l-slate-600 print:bg-slate-50 print:py-2 print:text-slate-900"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 print:h-5 print:w-5 print:bg-transparent print:text-slate-700"
                >
                  <Lightbulb size={15} />
                </span>
                <p className="min-w-0 flex-1 leading-relaxed">
                  <span className="mr-1.5 text-xs font-bold tracking-wide text-blue-700 uppercase print:text-slate-800">
                    Dica:
                  </span>
                  {negrito(b.texto, 'dica')}
                </p>
              </div>
            );
          case 'atencao':
            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-amber-200/90 border-l-4 border-l-amber-500 bg-amber-50/80 px-3.5 py-3 text-amber-950 print:break-inside-avoid print:border-slate-400 print:border-l-slate-800 print:bg-slate-50 print:py-2 print:text-slate-900"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 print:h-5 print:w-5 print:bg-transparent print:text-slate-800"
                >
                  <AlertTriangle size={15} />
                </span>
                <p className="min-w-0 flex-1 leading-relaxed">
                  <span className="mr-1.5 text-xs font-bold tracking-wide text-amber-800 uppercase print:text-slate-900">
                    Atenção:
                  </span>
                  {negrito(b.texto, 'atencao')}
                </p>
              </div>
            );
          case 'subtitulo':
            return (
              <h4 key={i} className="pt-1.5 text-sm font-bold text-slate-900">
                {b.texto}
              </h4>
            );
          default:
            return (
              <p key={i} className="leading-relaxed">
                {negrito(b.texto)}
              </p>
            );
        }
      })}
    </div>
  );
}
