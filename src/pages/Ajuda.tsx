import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  CalendarRange,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Compass,
  FileBarChart,
  FolderOpen,
  LifeBuoy,
  Lock,
  Printer,
  Star,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { SECOES, TOPICOS, topicoPorId, type Topico } from '../ajuda/topicos';
import TextoAjuda from '../ajuda/TextoAjuda';
import { formatarData } from '../utils/ordens';

const ICONE_SECAO: Record<string, LucideIcon> = {
  'Primeiros passos': Compass,
  Clientes: Users,
  'Ordens de serviço': ClipboardList,
  'Agenda dos técnicos': CalendarRange,
  'Avaliação do cliente': Star,
  Cadastros: FolderOpen,
  Relatórios: FileBarChart,
  'Equipe e acessos': UserCog,
  'Dúvidas comuns': LifeBuoy,
};

const ESTILO_IMPRESSAO_MANUAL = `
@media print {
  @page {
    size: A4 portrait;
    margin: 16mm 16mm 18mm 16mm;
  }
}
`;

/** Manual completo do operador: todos os tópicos da ajuda, com índice. Imprime ou salva em PDF. */
export default function Ajuda() {
  const { profile } = useAuth();
  const { hash } = useLocation();
  const podeVer = profile?.role === 'admin' || profile?.role === 'escritorio';
  const [indiceMovelAberto, setIndiceMovelAberto] = useState(false);
  const [topicoObservadoId, setTopicoObservadoId] = useState<string>('');
  const [dataHoje] = useState(() => formatarData(new Date().toISOString()));
  const topicoAtivoId = topicoObservadoId || (hash ? hash.slice(1) : (TOPICOS[0]?.id ?? ''));

  const grupos = useMemo(
    () =>
      SECOES.map((secao) => ({
        secao,
        topicos: TOPICOS.filter((t) => t.secao === secao),
      })).filter((g) => g.topicos.length),
    [],
  );

  // /ajuda#<id do tópico> rola até ele
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  // Acompanha o tópico visível na tela para destacar no índice lateral fixo
  useEffect(() => {
    if (!podeVer || typeof IntersectionObserver === 'undefined') return;
    const elementos = TOPICOS.map((t) => document.getElementById(t.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (!elementos.length) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.find((e) => e.isIntersecting);
        if (visivel?.target.id) {
          setTopicoObservadoId(visivel.target.id);
        }
      },
      { rootMargin: '-10% 0px -75% 0px', threshold: 0 },
    );

    for (const el of elementos) observador.observe(el);
    return () => observador.disconnect();
  }, [podeVer]);

  if (!podeVer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Lock size={28} aria-hidden="true" className="text-slate-400" />
        <h2 className="mt-3 text-base font-bold text-slate-800">Acesso restrito</h2>
        <p className="mt-1 text-xs text-slate-500">O manual é do escritório e dos administradores.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-6xl pb-16 print:hidden">
        {/* Cabeçalho da Central de Ajuda */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-col gap-4 bg-gradient-to-r from-brv-navy via-brv-navy-light to-[#1d4078] px-5 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div className="flex items-start gap-4">
              <div
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-sky-300 ring-1 ring-white/15"
              >
                <BookOpen size={24} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Manual do BRV Control</h1>
                  <span className="rounded-full bg-white/12 px-2.5 py-0.5 text-[11px] font-semibold text-sky-200">
                    {TOPICOS.length} tópicos
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-sky-100/90 sm:text-sm">
                  Passo a passo para o escritório. Em qualquer tela, aperte{' '}
                  <kbd className="rounded border border-white/25 bg-white/15 px-1.5 py-0.5 font-mono text-xs font-bold text-white">
                    F1
                  </kbd>{' '}
                  para ver só a ajuda daquela tela.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-brv-navy shadow-xs transition hover:bg-sky-50 sm:min-h-10"
            >
              <Printer size={15} aria-hidden="true" />
              Imprimir / salvar PDF
            </button>
          </div>
        </div>

        {/* Índice recolhível em telas menores que xl */}
        <nav
          aria-label="Índice do manual"
          className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs xl:hidden"
        >
          <button
            type="button"
            aria-expanded={indiceMovelAberto}
            onClick={() => setIndiceMovelAberto((a) => !a)}
            className="flex min-h-12 w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <BookOpen size={16} aria-hidden="true" className="text-blue-600" />
              Índice de assuntos ({grupos.length} seções)
            </span>
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={`text-slate-400 transition-transform duration-200 ${indiceMovelAberto ? 'rotate-180 text-blue-600' : ''}`}
            />
          </button>

          {indiceMovelAberto && (
            <div className="grid gap-x-6 gap-y-5 border-t border-slate-100 bg-slate-50/40 p-5 sm:grid-cols-2">
              {grupos.map((g) => {
                const Icone = ICONE_SECAO[g.secao] ?? CircleHelp;
                return (
                  <div key={g.secao}>
                    <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-slate-600 uppercase">
                      <Icone size={13} aria-hidden="true" className="text-blue-600" />
                      {g.secao}
                    </p>
                    <ul role="list" className="mt-1.5 space-y-1 border-l border-slate-200 pl-3">
                      {g.topicos.map((t) => (
                        <li key={t.id}>
                          <a
                            href={`#${t.id}`}
                            onClick={() => setIndiceMovelAberto(false)}
                            className="block py-0.5 text-sm text-slate-700 transition hover:text-blue-700 hover:underline"
                          >
                            {t.titulo}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        {/* Corpo em duas colunas em telas largas: índice lateral fixo + conteúdo */}
        <div className="mt-6 xl:grid xl:grid-cols-[270px_minmax(0,1fr)] xl:items-start xl:gap-8">
          <aside className="hidden xl:block">
            <nav
              aria-label="Índice lateral do manual"
              className="sticky top-0 max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
            >
              <p className="mb-3 px-2 text-xs font-bold tracking-wide text-slate-400 uppercase">Índice</p>
              <div className="space-y-4">
                {grupos.map((g) => {
                  const Icone = ICONE_SECAO[g.secao] ?? CircleHelp;
                  const secaoTemAtivo = g.topicos.some((t) => t.id === topicoAtivoId);
                  return (
                    <div key={g.secao}>
                      <div
                        className={`flex items-center gap-2 px-2 text-xs font-bold ${
                          secaoTemAtivo ? 'text-blue-700' : 'text-slate-700'
                        }`}
                      >
                        <Icone
                          size={14}
                          aria-hidden="true"
                          className={secaoTemAtivo ? 'text-blue-600' : 'text-slate-400'}
                        />
                        <span>{g.secao}</span>
                      </div>
                      <ul role="list" className="mt-1 ml-3.5 space-y-0.5 border-l border-slate-200/90 pl-2.5">
                        {g.topicos.map((t) => {
                          const ativo = t.id === topicoAtivoId;
                          return (
                            <li key={t.id}>
                              <a
                                href={`#${t.id}`}
                                onClick={() => setTopicoObservadoId(t.id)}
                                className={`block rounded-lg px-2 py-1 text-xs leading-snug transition ${
                                  ativo
                                    ? 'bg-blue-50 font-semibold text-blue-700'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                              >
                                {t.titulo}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </nav>
          </aside>

          <div className="min-w-0 space-y-10">
            {grupos.map((g) => {
              const Icone = ICONE_SECAO[g.secao] ?? CircleHelp;
              return (
                <section key={g.secao}>
                  <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100"
                    >
                      <Icone size={18} />
                    </span>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{g.secao}</h2>
                      <p className="text-xs text-slate-500">
                        {g.topicos.length} {g.topicos.length === 1 ? 'tópico' : 'tópicos'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    {g.topicos.map((t) => {
                      const relacionados = (t.veja ?? []).map(topicoPorId).filter((rel): rel is Topico => !!rel);
                      return (
                        <article
                          key={t.id}
                          id={t.id}
                          className="scroll-mt-5 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-colors hover:border-slate-300 sm:p-6"
                        >
                          <h3 className="mb-3.5 text-base font-bold text-balance text-slate-900 sm:text-lg">
                            {t.titulo}
                          </h3>
                          <TextoAjuda texto={t.texto} />

                          {relacionados.length > 0 && (
                            <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                              <span className="mr-1 text-xs font-semibold text-slate-400">Veja também:</span>
                              {relacionados.map((rel) => (
                                <a
                                  key={rel.id}
                                  href={`#${rel.id}`}
                                  onClick={() => setTopicoObservadoId(rel.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  {rel.titulo}
                                  <ArrowUpRight size={12} aria-hidden="true" className="text-slate-400" />
                                </a>
                              ))}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>

      {/* Versão dedicada para impressão / PDF no <body> (index.css oculta #root no @media print) */}
      {createPortal(
        <div className="hidden bg-white text-slate-900 print:block">
          <style>{ESTILO_IMPRESSAO_MANUAL}</style>

          {/* Capa simples visível apenas na impressão */}
          <section className="flex min-h-[245mm] flex-col items-center justify-between py-14 text-center break-after-page">
            <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
              BRV Niterói · Sistema de Gestão de Serviços
            </p>

            <div className="flex flex-col items-center">
              <img
                src="/logobrvcontrol.png"
                alt="Logo BRV Control"
                width={140}
                height={152}
                className="h-32 w-auto object-contain"
              />
              <h1 className="mt-8 text-3xl font-extrabold tracking-tight text-slate-900">
                Manual do BRV Control
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Guia de operação para o escritório e administração
              </p>
              <div className="mt-6 h-0.5 w-16 bg-slate-300" />
            </div>

            <p className="text-xs font-medium text-slate-600">Emitido em {dataHoje}</p>
          </section>

          {/* Índice limpo com os títulos */}
          <section className="py-2">
            <h2 className="border-b-2 border-slate-800 pb-2 text-xl font-bold text-slate-900">Índice</h2>
            <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-5">
              {grupos.map((g, idxSecao) => (
                <div key={g.secao} className="break-inside-avoid">
                  <p className="text-xs font-bold tracking-wide text-slate-800 uppercase">
                    {idxSecao + 1}. {g.secao}
                  </p>
                  <ul role="list" className="mt-1.5 space-y-1 border-l border-slate-300 pl-3">
                    {g.topicos.map((t) => (
                      <li key={t.id} className="text-xs leading-snug text-slate-700">
                        {t.titulo}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Cada seção começando em página nova, sem sombras e sem botões */}
          {grupos.map((g, idxSecao) => (
            <section key={g.secao} className="break-before-page">
              <h2 className="border-b-2 border-slate-800 pb-2 text-xl font-bold text-slate-900">
                {idxSecao + 1}. {g.secao}
              </h2>
              <div className="mt-4 divide-y divide-slate-200">
                {g.topicos.map((t) => (
                  <article key={t.id} className="break-inside-avoid py-4 first:pt-1">
                    <h3 className="mb-2 text-base font-bold text-slate-900">{t.titulo}</h3>
                    <TextoAjuda texto={t.texto} />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
