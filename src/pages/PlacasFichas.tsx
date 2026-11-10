import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Loader2,
  Pencil,
  Printer,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import CadastrarFichaIAModal from '../components/placas/CadastrarFichaIAModal';
import FichaTecnicaImprimirPortal from '../components/placas/FichaTecnicaImprimirPortal';
import {
  excluirFicha,
  listarFichas,
  salvarFicha,
} from '../components/placas/fonteDeDados';
import FormularioCamposFicha from '../components/placas/FormularioCamposFicha';
import ModalDialogoPlacas from '../components/placas/ModalDialogoPlacas';
import NavegacaoPlacas from '../components/placas/NavegacaoPlacas';
import {
  criarFichaVazia,
  ehEscritorioOuAdminPlaca,
  type DadosCamposFicha,
} from '../components/placas/regrasPlacas';
import { useAuth } from '../contexts/useAuth';
import type { PlacaFichaTecnica } from '../types/placas';

const OPCOES_BTU = ['9.000', '12.000', '18.000', '24.000', '30.000', '36.000'] as const;

const valorOuTraco = (v: string | null | undefined) => (v && v.trim() ? v.trim() : '—');

function ItemDetalheFicha({
  rotulo,
  valor,
  mono,
}: {
  rotulo: string;
  valor: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <dt className="text-[11px] font-semibold text-slate-500">{rotulo}</dt>
      <dd className={`mt-0.5 text-xs font-bold text-slate-900 ${mono ? 'font-mono' : ''}`}>
        {valorOuTraco(valor)}
      </dd>
    </div>
  );
}

export default function PlacasFichas() {
  const { profile } = useAuth();
  const idBase = useId();

  const papel = profile?.role;
  const ehAdmin = papel === 'admin';
  const podeCadastrarIA = ehEscritorioOuAdminPlaca(papel);

  const [busca, setBusca] = useState('');
  const [fabricante, setFabricante] = useState('');
  const [btus, setBtus] = useState('');

  const [todasParaFabricantes, setTodasParaFabricantes] = useState<PlacaFichaTecnica[]>([]);
  const [fichas, setFichas] = useState<PlacaFichaTecnica[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [chaveRecarga, setChaveRecarga] = useState(0);

  const [avisoSucesso, setAvisoSucesso] = useState<string | null>(null);

  // Ficha aberta no detalhe / impressão / edição / exclusão
  const [fichaDetalhe, setFichaDetalhe] = useState<PlacaFichaTecnica | null>(null);
  const [fichaImprimir, setFichaImprimir] = useState<PlacaFichaTecnica | null>(null);
  const [modalIAAberto, setModalIAAberto] = useState(false);

  const [fichaEditando, setFichaEditando] = useState<PlacaFichaTecnica | null>(null);
  const [dadosEdicao, setDadosEdicao] = useState<DadosCamposFicha>(criarFichaVazia);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  const [fichaExcluir, setFichaExcluir] = useState<PlacaFichaTecnica | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    listarFichas()
      .then((todas) => {
        if (!cancelado) setTodasParaFabricantes(todas);
      })
      .catch(() => {
        // silencioso: filtros continuam funcionando
      });
    return () => {
      cancelado = true;
    };
  }, [chaveRecarga]);

  useEffect(() => {
    let cancelado = false;
    Promise.resolve()
      .then(() => {
        if (cancelado) return null;
        setCarregando(true);
        setErroCarga(null);
        return listarFichas({ busca, fabricante, btus });
      })
      .then((lista) => {
        if (cancelado || !lista) return;
        setFichas(lista);
      })
      .catch((err) => {
        if (!cancelado) {
          setErroCarga(
            err instanceof Error ? err.message : 'Erro ao carregar fichas técnicas.',
          );
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [busca, fabricante, btus, chaveRecarga]);

  const fabricantesDisponiveis = useMemo(() => {
    const unicos = new Set<string>();
    for (const f of todasParaFabricantes) {
      if (f.fabricante.trim()) unicos.add(f.fabricante.trim());
    }
    return [...unicos].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [todasParaFabricantes]);

  const abrirEdicao = (f: PlacaFichaTecnica) => {
    const { id: _id, created_at: _criado, ...campos } = f;
    setDadosEdicao(campos);
    setErroEdicao(null);
    setFichaEditando(f);
  };

  const handleSalvarEdicao = async (e: FormEvent) => {
    e.preventDefault();
    if (!fichaEditando || !ehAdmin) return;
    setErroEdicao(null);

    setSalvandoEdicao(true);
    try {
      const atualizada = await salvarFicha(
        { ...dadosEdicao, id: fichaEditando.id },
        papel ?? 'admin',
      );
      setFichaEditando(null);
      if (fichaDetalhe?.id === atualizada.id) {
        setFichaDetalhe(atualizada);
      }
      setAvisoSucesso(`Ficha "${atualizada.fabricante} ${atualizada.linha ?? ''}" atualizada.`);
      setChaveRecarga((c) => c + 1);
    } catch (err) {
      setErroEdicao(err instanceof Error ? err.message : 'Erro ao atualizar ficha.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!fichaExcluir || !ehAdmin) return;
    setExcluindo(true);
    try {
      await excluirFicha(fichaExcluir.id, papel ?? 'admin');
      if (fichaDetalhe?.id === fichaExcluir.id) {
        setFichaDetalhe(null);
      }
      setFichaExcluir(null);
      setAvisoSucesso('Ficha técnica removida.');
      setChaveRecarga((c) => c + 1);
    } catch {
      setFichaExcluir(null);
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="space-y-5">
      <NavegacaoPlacas />

      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brv-navy text-white">
            <BookOpen size={18} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
              Fichas técnicas de splits
            </h1>
            <p className="text-xs text-slate-500">
              Consulta rápida de placas, bitolas, carga de fluido e dados elétricos por modelo.
            </p>
          </div>
        </div>

        {podeCadastrarIA && (
          <button
            type="button"
            onClick={() => setModalIAAberto(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brv-navy px-4 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800 sm:text-sm"
          >
            <Sparkles size={16} aria-hidden="true" />
            <span>Cadastrar ficha com IA</span>
          </button>
        )}
      </div>

      {avisoSucesso && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900"
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600" aria-hidden="true" />
            {avisoSucesso}
          </span>
          <button
            type="button"
            onClick={() => setAvisoSucesso(null)}
            className="text-emerald-800 hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Filtros: busca sem acento + fabricante + BTUs */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs md:grid-cols-4">
        <div className="relative md:col-span-2">
          <label htmlFor={`${idBase}-busca`} className="sr-only">
            Buscar ficha por marca, linha, código de evaporadora ou condensadora
          </label>
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id={`${idBase}-busca`}
            type="search"
            autoCorrect="off"
            spellCheck={false}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar marca, linha, evaporadora, condensadora ou part number..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50/70 py-2 pr-8 pl-9 text-sm focus:border-blue-600 focus:bg-white focus:outline-none"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              aria-label="Limpar busca"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        <div>
          <label htmlFor={`${idBase}-fab`} className="sr-only">
            Filtrar por fabricante
          </label>
          <select
            id={`${idBase}-fab`}
            value={fabricante}
            onChange={(e) => setFabricante(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="">Todos os fabricantes</option>
            {fabricantesDisponiveis.map((fab) => (
              <option key={fab} value={fab}>
                {fab}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${idBase}-btu`} className="sr-only">
            Filtrar por capacidade em BTUs
          </label>
          <select
            id={`${idBase}-btu`}
            value={btus}
            onChange={(e) => setBtus(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="">Todas as capacidades (BTU/h)</option>
            {OPCOES_BTU.map((b) => (
              <option key={b} value={b}>
                {b} BTU/h
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Estados da grade de cartões */}
      {carregando ? (
        <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white py-16 text-slate-500">
          <Loader2 size={24} className="animate-spin text-blue-600" aria-hidden="true" />
          <p className="text-sm font-medium">Carregando fichas técnicas...</p>
        </div>
      ) : erroCarga ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 py-12 text-center"
        >
          <p className="text-sm font-semibold text-rose-900">{erroCarga}</p>
          <button
            type="button"
            onClick={() => setChaveRecarga((c) => c + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Tentar de novo</span>
          </button>
        </div>
      ) : fichas.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-slate-200 bg-white py-14 text-center">
          <Inbox size={28} className="text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800">
            Nenhuma ficha técnica encontrada
          </p>
          <p className="max-w-md text-xs text-slate-500">
            Altere a busca ou limpe os filtros de fabricante e capacidade.
          </p>
          {(busca || fabricante || btus) && (
            <button
              type="button"
              onClick={() => {
                setBusca('');
                setFabricante('');
                setBtus('');
              }}
              className="mt-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {fichas.map((f) => (
            <article
              key={f.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-blue-300 hover:shadow-sm"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-blue-700">
                      {f.fabricante}
                    </span>
                    <h2 className="text-sm font-bold text-slate-900">
                      {f.linha || f.tipo_split || 'Linha padrão'}
                    </h2>
                  </div>
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-800">
                    {valorOuTraco(f.capacidade_btu)}
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5 text-xs">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase text-slate-400">
                      Evaporadora
                    </dt>
                    <dd className="truncate font-mono font-semibold text-slate-800">
                      {valorOuTraco(f.evaporadora)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase text-slate-400">
                      Condensadora
                    </dt>
                    <dd className="truncate font-mono font-semibold text-slate-800">
                      {valorOuTraco(f.condensadora)}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-900">
                    <Zap size={12} aria-hidden="true" />
                    {valorOuTraco(f.tensao)}
                  </span>
                  {f.gas && (
                    <span className="rounded-md bg-cyan-50 px-2 py-0.5 font-semibold text-cyan-900">
                      {f.gas}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setFichaDetalhe(f)}
                  className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Abrir ficha completa
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFichaImprimir(f)}
                    aria-label={`Imprimir ficha ${f.fabricante}`}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Printer size={15} aria-hidden="true" />
                  </button>
                  {ehAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => abrirEdicao(f)}
                        aria-label={`Editar ficha ${f.fabricante}`}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFichaExcluir(f)}
                        aria-label={`Excluir ficha ${f.fabricante}`}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal: Detalhe completo da ficha técnica (agrupado em 4 blocos, vazio = "—") */}
      <ModalDialogoPlacas
        aberto={!!fichaDetalhe}
        onFechar={() => setFichaDetalhe(null)}
        titulo={
          fichaDetalhe
            ? `${fichaDetalhe.fabricante} · ${fichaDetalhe.linha || fichaDetalhe.tipo_split || 'Split'}`
            : 'Ficha técnica'
        }
        subtitulo={fichaDetalhe ? valorOuTraco(fichaDetalhe.capacidade_btu) : undefined}
        larguraMax="max-w-4xl"
      >
        {fichaDetalhe && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {fichaDetalhe.arquivo_original_url && (
                  <a
                    href={fichaDetalhe.arquivo_original_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                    <span>Abrir manual original</span>
                  </a>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const alvo = fichaDetalhe;
                    setFichaDetalhe(null);
                    setFichaImprimir(alvo);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Printer size={14} aria-hidden="true" />
                  <span>Imprimir ficha A4</span>
                </button>
                {ehAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const alvo = fichaDetalhe;
                        setFichaDetalhe(null);
                        abrirEdicao(alvo);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      <Pencil size={13} aria-hidden="true" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const alvo = fichaDetalhe;
                        setFichaDetalhe(null);
                        setFichaExcluir(alvo);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      <span>Excluir</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Bloco 1: Identificação */}
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Identificação
              </h3>
              <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <ItemDetalheFicha rotulo="Fabricante" valor={fichaDetalhe.fabricante} />
                <ItemDetalheFicha rotulo="Linha" valor={fichaDetalhe.linha} />
                <ItemDetalheFicha rotulo="Tipo de split" valor={fichaDetalhe.tipo_split} />
                <ItemDetalheFicha rotulo="Capacidade (BTU/h)" valor={fichaDetalhe.capacidade_btu} />
                <ItemDetalheFicha rotulo="Capacidade (W)" valor={fichaDetalhe.capacidade_w} />
                <ItemDetalheFicha rotulo="Revisão do manual" valor={fichaDetalhe.revisao_manual} />
                <ItemDetalheFicha rotulo="Evaporadora" valor={fichaDetalhe.evaporadora} mono />
                <ItemDetalheFicha rotulo="Medida evaporadora" valor={fichaDetalhe.medida_evaporadora} />
                <ItemDetalheFicha rotulo="Ref. placa evaporadora" valor={fichaDetalhe.ref_evaporadora} mono />
                <ItemDetalheFicha rotulo="Condensadora" valor={fichaDetalhe.condensadora} mono />
                <ItemDetalheFicha rotulo="Medida condensadora" valor={fichaDetalhe.medida_condensadora} />
                <ItemDetalheFicha rotulo="Ref. placa condensadora" valor={fichaDetalhe.ref_condensadora} mono />
              </dl>
            </section>

            {/* Bloco 2: Linha frigorífica */}
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Linha frigorífica
              </h3>
              <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <ItemDetalheFicha rotulo="Fluido refrigerante" valor={fichaDetalhe.gas} />
                <ItemDetalheFicha rotulo="Tubulação líquido" valor={fichaDetalhe.cobre_liquido} />
                <ItemDetalheFicha rotulo="Tubulação sucção" valor={fichaDetalhe.cobre_succao} />
                <ItemDetalheFicha rotulo="Distância mínima" valor={fichaDetalhe.dist_min} />
                <ItemDetalheFicha rotulo="Distância padrão" valor={fichaDetalhe.dist_padrao} />
                <ItemDetalheFicha rotulo="Distância máxima" valor={fichaDetalhe.dist_max} />
                <ItemDetalheFicha rotulo="Desnível máximo" valor={fichaDetalhe.desnivel_max} />
                <ItemDetalheFicha rotulo="Carga de fábrica" valor={fichaDetalhe.carga_fabrica} />
                <ItemDetalheFicha rotulo="Carga extra" valor={fichaDetalhe.carga_extra} />
                <div className="sm:col-span-3">
                  <ItemDetalheFicha rotulo="Regra de bitola" valor={fichaDetalhe.regra_bitola} />
                </div>
              </dl>
            </section>

            {/* Bloco 3: Elétrica */}
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Elétrica
              </h3>
              <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <ItemDetalheFicha rotulo="Tensão" valor={fichaDetalhe.tensao} />
                <ItemDetalheFicha rotulo="Alimentação em" valor={fichaDetalhe.alimentacao_em} />
                <ItemDetalheFicha rotulo="Proteção / Disjuntor" valor={fichaDetalhe.protecao} />
                <ItemDetalheFicha rotulo="Potência nominal" valor={fichaDetalhe.p_nominal} />
                <ItemDetalheFicha rotulo="Potência máx. dim." valor={fichaDetalhe.p_max_dim} />
                <ItemDetalheFicha rotulo="Origem elétrica" valor={fichaDetalhe.origem_eletrica} />
                <ItemDetalheFicha rotulo="Corrente refrigeração" valor={fichaDetalhe.i_refrigeracao} />
                <ItemDetalheFicha rotulo="Corrente aquecimento" valor={fichaDetalhe.i_aquecimento} />
                <ItemDetalheFicha rotulo="Corrente máx. dim." valor={fichaDetalhe.i_max_dim} />
                <ItemDetalheFicha rotulo="Cabo de alimentação" valor={fichaDetalhe.cabo_alimentacao} />
                <div className="sm:col-span-2">
                  <ItemDetalheFicha rotulo="Cabo de interligação" valor={fichaDetalhe.cabo_interligacao} />
                </div>
              </dl>
            </section>

            {/* Bloco 4: Notas */}
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Notas
              </h3>
              <dl className="grid grid-cols-1 gap-2.5">
                <ItemDetalheFicha rotulo="Observações" valor={fichaDetalhe.observacao} />
                <ItemDetalheFicha rotulo="Lacunas do manual" valor={fichaDetalhe.lacunas} />
                <ItemDetalheFicha rotulo="Fonte documental" valor={fichaDetalhe.fonte} />
              </dl>
            </section>
          </div>
        )}
      </ModalDialogoPlacas>

      {/* Impressão A4 em portal fora de #root */}
      {fichaImprimir && (
        <FichaTecnicaImprimirPortal
          ficha={fichaImprimir}
          onFechar={() => setFichaImprimir(null)}
        />
      )}

      {/* Modal: Cadastrar ficha com IA (`admin` e `escritorio`) */}
      <CadastrarFichaIAModal
        aberto={modalIAAberto}
        papel={papel}
        onFechar={() => setModalIAAberto(false)}
        onSalva={(criada) => {
          setModalIAAberto(false);
          setAvisoSucesso(
            `Ficha "${criada.fabricante} ${criada.linha ?? ''}" cadastrada após revisão.`,
          );
          setChaveRecarga((c) => c + 1);
          setFichaDetalhe(criada);
        }}
      />

      {/* Modal: Editar ficha (`admin` somente) */}
      <ModalDialogoPlacas
        aberto={!!fichaEditando}
        onFechar={() => setFichaEditando(null)}
        titulo="Editar ficha técnica"
        larguraMax="max-w-4xl"
        fecharAoClicarFora={false}
      >
        <form onSubmit={handleSalvarEdicao} noValidate className="space-y-4">
          <FormularioCamposFicha dados={dadosEdicao} onChange={setDadosEdicao} />
          {erroEdicao && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-800"
            >
              {erroEdicao}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFichaEditando(null)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvandoEdicao}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brv-navy px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {salvandoEdicao ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Save size={14} aria-hidden="true" />
              )}
              <span>Salvar alterações</span>
            </button>
          </div>
        </form>
      </ModalDialogoPlacas>

      {/* Modal: Confirmar exclusão (`admin` somente) */}
      <ModalDialogoPlacas
        aberto={!!fichaExcluir}
        onFechar={() => setFichaExcluir(null)}
        titulo="Excluir ficha técnica?"
      >
        {fichaExcluir && (
          <div className="space-y-4 text-sm text-slate-700">
            <p>
              Confirma a exclusão da ficha{' '}
              <strong>
                {fichaExcluir.fabricante} {fichaExcluir.linha ?? ''} ({valorOuTraco(fichaExcluir.capacidade_btu)})
              </strong>
              ?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFichaExcluir(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={excluindo}
                onClick={() => void handleConfirmarExclusao()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {excluindo && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                <span>Excluir ficha</span>
              </button>
            </div>
          </div>
        )}
      </ModalDialogoPlacas>
    </div>
  );
}
