import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import {
  ArrowLeft,
  BookOpen,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Compass,
  FileBarChart,
  FolderOpen,
  LifeBuoy,
  Search,
  Sparkles,
  Star,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { NOME_TELA, SECOES, TOPICOS, topicoPorId, type TelaAjuda, type Topico } from './topicos';
import { buscarTopicos, topicosDaTela } from './buscaAjuda';
import TextoAjuda from './TextoAjuda';

interface AjudaPainelProps {
  tela: TelaAjuda;
  onFechar: () => void;
}

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

/** Painel lateral da ajuda (F1). Abre na lista de tópicos da tela atual. */
export default function AjudaPainel({ tela, onFechar }: AjudaPainelProps) {
  const { profile } = useAuth();
  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState<Topico | null>(null);
  const [secoesAbertas, setSecoesAbertas] = useState<Record<string, boolean>>({});
  const [veioDeTopico, setVeioDeTopico] = useState(false);
  const [fechando, setFechando] = useState(false);
  const busca = useRef<HTMLInputElement>(null);
  const painelRef = useRef<HTMLElement>(null);

  // Primeiro pedido anima a saída; um segundo (Esc/clique durante a animação) fecha na hora
  const fechandoRef = useRef(false);
  const solicitarFechamento = useCallback(() => {
    if (fechandoRef.current) {
      onFechar();
      return;
    }
    fechandoRef.current = true;
    setFechando(true);
  }, [onFechar]);

  // Aguarda a animação CSS de saída terminar antes de desmontar o painel
  useEffect(() => {
    if (!fechando) return;
    let cancelado = false;
    const animacoes = painelRef.current?.getAnimations?.() ?? [];
    if (animacoes.length === 0) {
      onFechar();
      return;
    }
    Promise.race([
      Promise.allSettled(animacoes.map((a) => a.finished)),
      new Promise((resolve) => setTimeout(resolve, 280)),
    ]).then(() => {
      if (!cancelado) onFechar();
    });
    return () => {
      cancelado = true;
    };
  }, [fechando, onFechar]);

  // Esc fecha o tópico ou o painel. Captura antes da OS/histórico, que também fecham com Esc.
  useEffect(() => {
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (aberto) setAberto(null);
      else solicitarFechamento();
    };
    window.addEventListener('keydown', aoTecla, true);
    return () => window.removeEventListener('keydown', aoTecla, true);
  }, [aberto, solicitarFechamento]);

  useEffect(() => {
    if (!aberto) busca.current?.focus();
  }, [aberto]);

  const daTela = useMemo(() => topicosDaTela(tela), [tela]);
  const idsDaTela = useMemo(() => new Set(daTela.map((t) => t.id)), [daTela]);
  const achados = useMemo(() => buscarTopicos(termo, tela), [termo, tela]);
  const outros = useMemo(
    () =>
      SECOES.map((secao) => ({
        secao,
        topicos: TOPICOS.filter((t) => t.secao === secao && !idsDaTela.has(t.id)),
      })).filter((g) => g.topicos.length),
    [idsDaTela],
  );

  const buscando = termo.trim().length > 1;

  const abrirTopico = (t: Topico) => {
    setVeioDeTopico(true);
    setAberto(t);
  };

  const alternarSecao = (secao: string) => {
    setSecoesAbertas((atual) => ({ ...atual, [secao]: !atual[secao] }));
  };

  const itemDestaque = (t: Topico) => (
    <li key={t.id}>
      <button
        type="button"
        onClick={() => abrirTopico(t)}
        className="group flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-blue-100/90 bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-800 shadow-2xs transition hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-700 sm:min-h-10"
      >
        <span className="flex-1 leading-snug">{t.titulo}</span>
        <ChevronRight
          size={16}
          aria-hidden="true"
          className="shrink-0 text-blue-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600"
        />
      </button>
    </li>
  );

  const itemPadrao = (t: Topico, mostrarSecao = false) => {
    const Icone = ICONE_SECAO[t.secao] ?? CircleHelp;
    const ehDaTela = idsDaTela.has(t.id);
    return (
      <li key={t.id}>
        <button
          type="button"
          onClick={() => abrirTopico(t)}
          className="group flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-blue-50/70 hover:text-blue-700 sm:min-h-9 sm:py-2"
        >
          {mostrarSecao && (
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-blue-100/80 group-hover:text-blue-600"
            >
              <Icone size={14} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block leading-snug font-medium">{t.titulo}</span>
            {mostrarSecao && (
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                <span>{t.secao}</span>
                {ehDaTela && (
                  <span className="rounded-full bg-blue-50 px-1.5 py-px text-[10px] font-semibold text-blue-600">
                    Nesta tela
                  </span>
                )}
              </span>
            )}
          </span>
          <ChevronRight
            size={15}
            aria-hidden="true"
            className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500"
          />
        </button>
      </li>
    );
  };

  const IconeTopicoAberto = aberto ? (ICONE_SECAO[aberto.secao] ?? CircleHelp) : CircleHelp;

  return (
    <>
      <div
        data-closing={fechando ? '' : undefined}
        className="fixed inset-0 z-[90] bg-slate-900/35 opacity-100 backdrop-blur-[1px] transition-opacity duration-200 ease-out starting:opacity-0 data-[closing]:opacity-0 motion-reduce:duration-75 print:hidden"
        onClick={solicitarFechamento}
        aria-hidden="true"
      />
      <aside
        ref={painelRef}
        role="dialog"
        aria-label="Ajuda"
        data-closing={fechando ? '' : undefined}
        className="fixed inset-0 z-[91] flex h-dvh w-full translate-x-0 flex-col bg-white opacity-100 shadow-2xl transition-[translate,opacity] duration-250 ease-out sm:left-auto sm:max-w-md sm:border-l sm:border-slate-200 starting:translate-x-full starting:opacity-95 data-[closing]:translate-x-full data-[closing]:opacity-95 motion-reduce:translate-x-0 motion-reduce:duration-100 motion-reduce:starting:translate-x-0 motion-reduce:data-[closing]:translate-x-0 print:hidden"
      >
        {/* Cabeçalho acolhedor com contexto da tela atual */}
        <div className="flex items-center gap-3.5 bg-gradient-to-r from-brv-navy to-brv-navy-light px-4 py-4 text-white sm:px-5">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/12 text-sky-300 ring-1 ring-white/15"
          >
            <CircleHelp size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-white">Ajuda</h2>
              <span className="rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-sky-200">
                F1
              </span>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-sky-200">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
              <span className="truncate">{NOME_TELA[tela]}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={solicitarFechamento}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white sm:h-9 sm:w-9"
            aria-label="Fechar ajuda"
            title="Fechar (Esc)"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        {aberto ? (
          <div
            key={aberto.id}
            className="flex-1 translate-x-0 overflow-y-auto px-4 py-4 opacity-100 transition-[translate,opacity] duration-200 ease-out sm:px-5 starting:translate-x-3 starting:opacity-0 motion-reduce:duration-75 motion-reduce:starting:translate-x-0"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setAberto(null)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:min-h-8 sm:py-1.5"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                Voltar
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                <IconeTopicoAberto size={12} aria-hidden="true" className="text-blue-600" />
                {aberto.secao}
              </span>
            </div>

            <h3 className="mb-3.5 text-lg leading-snug font-bold text-balance text-slate-900">{aberto.titulo}</h3>
            <TextoAjuda texto={aberto.texto} />

            {!!aberto.veja?.length && (
              <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5">
                <p className="mb-2 px-1 text-[11px] font-bold tracking-wide text-slate-500 uppercase">Veja também</p>
                <ul role="list" className="space-y-1">
                  {aberto.veja
                    .map(topicoPorId)
                    .filter((t): t is Topico => !!t)
                    .map((t) => itemPadrao(t, true))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div
            className={`flex min-h-0 flex-1 flex-col ${
              veioDeTopico
                ? 'translate-x-0 opacity-100 transition-[translate,opacity] duration-200 ease-out starting:-translate-x-3 starting:opacity-0 motion-reduce:duration-75 motion-reduce:starting:translate-x-0'
                : ''
            }`}
          >
            <search className="border-b border-slate-200/80 bg-slate-50/70 px-4 py-3 sm:px-5">
              <div className="relative">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
                />
                <input
                  ref={busca}
                  type="search"
                  aria-label="Buscar na ajuda"
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  placeholder="O que você quer fazer? Ex.: cancelar OS"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-9 pl-10 text-sm text-slate-800 shadow-2xs placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none sm:py-2"
                />
                {termo && (
                  <button
                    type="button"
                    onClick={() => {
                      setTermo('');
                      busca.current?.focus();
                    }}
                    aria-label="Limpar busca"
                    className="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </search>

            <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3.5 sm:px-4">
              {buscando ? (
                achados.length ? (
                  <div>
                    <p className="mb-1.5 px-2 text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                      {achados.length} {achados.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}
                    </p>
                    <ul role="list" className="space-y-1">
                      {achados.map((t) => itemPadrao(t, true))}
                    </ul>
                  </div>
                ) : (
                  <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
                    <div
                      aria-hidden="true"
                      className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"
                    >
                      <Search size={18} />
                    </div>
                    <p className="text-sm font-medium text-slate-700">Nada encontrado para &ldquo;{termo.trim()}&rdquo;</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Tente outra palavra ou consulte o manual completo abaixo.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setTermo('');
                        busca.current?.focus();
                      }}
                      className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Limpar busca
                    </button>
                  </div>
                )
              ) : (
                <>
                  {/* Destaque principal: tópicos da tela atual */}
                  {!!daTela.length && (
                    <section className="rounded-2xl border border-blue-200/85 bg-gradient-to-b from-blue-50/85 to-blue-50/30 p-3 shadow-2xs">
                      <div className="mb-2 flex items-center justify-between gap-2 px-1">
                        <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-blue-700 uppercase">
                          <Sparkles size={13} aria-hidden="true" className="text-blue-600" />
                          <span>Nesta tela</span>
                          <span className="font-medium normal-case text-blue-600/80">· {NOME_TELA[tela]}</span>
                        </h3>
                        <span className="rounded-full bg-blue-100/90 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                          {daTela.length}
                        </span>
                      </div>
                      <ul role="list" className="space-y-1.5">
                        {daTela.map(itemDestaque)}
                      </ul>
                    </section>
                  )}

                  {/* Demais seções recolhíveis, fechadas por padrão */}
                  {!!outros.length && (
                    <div className="space-y-1.5 pt-1">
                      <p className="px-2 pb-0.5 text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                        Outros assuntos
                      </p>
                      {outros.map((g) => {
                        const Icone = ICONE_SECAO[g.secao] ?? CircleHelp;
                        const secaoAberta = !!secoesAbertas[g.secao];
                        return (
                          <section
                            key={g.secao}
                            className="overflow-hidden rounded-xl border border-slate-200/80 bg-white transition-colors hover:border-slate-300/80"
                          >
                            <h3>
                              <button
                                type="button"
                                aria-expanded={secaoAberta}
                                onClick={() => alternarSecao(g.secao)}
                                className="group flex min-h-11 w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50/80 sm:min-h-10"
                              >
                                <span
                                  aria-hidden="true"
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                                    secaoAberta
                                      ? 'bg-blue-50 text-blue-600'
                                      : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50/70 group-hover:text-blue-600'
                                  }`}
                                >
                                  <Icone size={15} />
                                </span>
                                <span className="flex-1 text-sm font-semibold text-slate-800">{g.secao}</span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                  {g.topicos.length}
                                </span>
                                <ChevronDown
                                  size={16}
                                  aria-hidden="true"
                                  className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                                    secaoAberta ? 'rotate-180 text-blue-600' : ''
                                  }`}
                                />
                              </button>
                            </h3>
                            {secaoAberta && (
                              <ul role="list" className="space-y-0.5 border-t border-slate-100 bg-slate-50/40 p-1.5">
                                {g.topicos.map((t) => itemPadrao(t))}
                              </ul>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-3 sm:px-5">
          <span className="text-[11px] text-slate-500">
            Atalho: <kbd className="rounded border border-slate-300 bg-white px-1 py-0.5 font-mono text-[10px] font-semibold text-slate-700">F1</kbd> em qualquer tela
          </span>
          {/* O técnico da oficina só usa a Oficina: a rota /ajuda o mandaria de volta para ela */}
          {profile?.role !== 'oficina' && (
            <Link
              to="/ajuda"
              onClick={onFechar}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:min-h-8 sm:py-1.5"
            >
              <BookOpen size={14} aria-hidden="true" />
              Manual completo
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
