import { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Cpu,
  Inbox,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { IndicadorElgin } from '../components/oficina/SituacaoElgin';
import ComprovanteEntradaDocumento from '../components/placas/ComprovanteEntradaDocumento';
import EtiquetaPlacaModal from '../components/placas/EtiquetaPlacaModal';
import {
  listarPlacas,
  moverPlaca,
  situacaoImpressora,
} from '../components/placas/fonteDeDados';
import KanbanPlacas from '../components/placas/KanbanPlacas';
import ListaFinalizadasPlacas from '../components/placas/ListaFinalizadasPlacas';
import NavegacaoPlacas from '../components/placas/NavegacaoPlacas';
import NovaPlacaModal from '../components/placas/NovaPlacaModal';
import PlacaDetalhes from '../components/placas/PlacaDetalhes';
import { useAuth } from '../contexts/useAuth';
import type {
  BoardListFilter,
  BoardListResult,
  BoardOrder,
  BoardStage,
  SituacaoImpressoraPlaca,
} from '../types/placas';
import { podeVerFinanceiroPlacas } from '../utils/acessoPlacas';

type RecorteChip = NonNullable<BoardListFilter['recorte']>;

const CHIPS_ANDAMENTO: readonly { chave: RecorteChip; rotulo: string }[] = [
  { chave: 'todas', rotulo: 'Todas' },
  { chave: 'parceiros', rotulo: 'Parceiros' },
  { chave: 'final', rotulo: 'Cliente final' },
  { chave: 'garantias', rotulo: 'Garantias' },
  { chave: 'encalhadas', rotulo: 'Encalhadas' },
];

export default function PlacasKanban() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const idBusca = useId();

  const papel = profile?.role;
  const atorNome = profile?.full_name || 'Usuário BRV';
  const temFinanceiro = podeVerFinanceiroPlacas(profile);

  const [aba, setAba] = useState<'andamento' | 'finalizadas'>('andamento');
  const [busca, setBusca] = useState('');
  const [recorte, setRecorte] = useState<RecorteChip>('todas');
  const [desfecho, setDesfecho] = useState<'todas' | 'entregue' | 'sem_conserto'>('todas');
  const [anoFinalizadas, setAnoFinalizadas] = useState<number>(() => new Date().getFullYear());
  const [paginaFinalizadas, setPaginaFinalizadas] = useState<number>(1);

  const [resultado, setResultado] = useState<BoardListResult>({
    itens: [],
    total: 0,
    por_pagina: 50,
    contagens: { todas: 0, parceiros: 0, final: 0, garantias: 0, encalhadas: 0 },
  });
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [chaveRecarga, setChaveRecarga] = useState(0);

  const [impressora, setImpressora] = useState<SituacaoImpressoraPlaca | null>(null);
  const [avisoBloqueio, setAvisoBloqueio] = useState<string | null>(null);

  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const [comprovanteRecemCriada, setComprovanteRecemCriada] = useState<BoardOrder | null>(null);
  const [etiquetaRecemCriada, setEtiquetaRecemCriada] = useState<BoardOrder | null>(null);

  const placaAbertaId = searchParams.get('placa');

  useEffect(() => {
    let cancelado = false;
    situacaoImpressora()
      .then((sit) => {
        if (!cancelado) setImpressora(sit);
      })
      .catch(() => {
        if (!cancelado) {
          setImpressora({ online: false, printer_name: 'Elgin L42 Pro', last_seen_at: null });
        }
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;
    Promise.resolve()
      .then(() => {
        if (cancelado) return null;
        setCarregando(true);
        setErroCarga(null);
        return listarPlacas({
          aba,
          busca,
          recorte,
          desfecho,
          ano: anoFinalizadas,
          pagina: paginaFinalizadas,
        });
      })
      .then((res) => {
        if (cancelado || !res) return;
        setResultado(res);
      })
      .catch((err) => {
        if (!cancelado) {
          setErroCarga(err instanceof Error ? err.message : 'Erro ao carregar placas.');
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [aba, busca, recorte, desfecho, anoFinalizadas, paginaFinalizadas, chaveRecarga]);

  const abrirDetalhePlaca = (id: string) => {
    const proximo = new URLSearchParams(searchParams);
    proximo.set('placa', id);
    setSearchParams(proximo, { replace: false });
  };

  const fecharDetalhePlaca = () => {
    const proximo = new URLSearchParams(searchParams);
    proximo.delete('placa');
    setSearchParams(proximo, { replace: true });
  };

  const handleMoverPlaca = async (placa: BoardOrder, destino: BoardStage) => {
    setAvisoBloqueio(null);
    try {
      await moverPlaca(placa.id, destino, undefined, { papel, atorNome });
      setChaveRecarga((c) => c + 1);
    } catch (err) {
      setAvisoBloqueio(err instanceof Error ? err.message : 'Não foi possível mover a placa.');
    }
  };

  return (
    <div className="space-y-5">
      <NavegacaoPlacas />

      {/* Cabeçalho principal */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brv-navy text-white">
              <Cpu size={18} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                Reparo de Placas
              </h1>
              <p className="text-xs text-slate-500">
                Laboratório eletrônico · controle de entrada, bancada, orçamento e entrega.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <IndicadorElgin
            online={impressora ? impressora.online : null}
            agente={
              impressora?.last_seen_at
                ? {
                    id: 'elgin-placas',
                    printer: impressora.printer_name,
                    version: null,
                    info: null,
                    last_seen_at: impressora.last_seen_at,
                  }
                : null
            }
            compacto
          />

          <button
            type="button"
            onClick={() => setModalNovaAberto(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brv-navy px-4 py-2.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-slate-800 sm:text-sm"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Nova placa</span>
          </button>
        </div>
      </div>

      {/* Barra de abas + busca + chips */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3.5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div
            role="tablist"
            aria-label="Visão das placas"
            className="inline-flex rounded-xl bg-slate-100 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'andamento'}
              onClick={() => setAba('andamento')}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition sm:text-sm ${
                aba === 'andamento'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Em andamento
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'finalizadas'}
              onClick={() => {
                setAba('finalizadas');
                setPaginaFinalizadas(1);
              }}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition sm:text-sm ${
                aba === 'finalizadas'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Finalizadas
            </button>
          </div>

          <div className="relative w-full md:max-w-sm">
            <label htmlFor={idBusca} className="sr-only">
              Buscar placa por número, cliente, marca ou código
            </label>
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id={idBusca}
              type="search"
              autoCorrect="off"
              spellCheck={false}
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPaginaFinalizadas(1);
              }}
              placeholder="Buscar nº OS-DDMMAA, cliente, marca ou placa..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50/70 py-2 pr-8 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
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
        </div>

        {aba === 'andamento' && (
          <div className="flex flex-wrap items-center gap-1.5">
            {CHIPS_ANDAMENTO.map((chip) => {
              const ativo = recorte === chip.chave;
              const qtd = resultado.contagens[chip.chave];
              const ehEncalhadas = chip.chave === 'encalhadas' && qtd > 0;
              return (
                <button
                  key={chip.chave}
                  type="button"
                  onClick={() => setRecorte(chip.chave)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    ativo
                      ? 'border-brv-navy bg-brv-navy text-white'
                      : ehEncalhadas
                        ? 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{chip.rotulo}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[11px] ${
                      ativo
                        ? 'bg-white/20 text-white'
                        : ehEncalhadas
                          ? 'bg-rose-200/70 text-rose-900'
                          : 'bg-slate-200/80 text-slate-700'
                    }`}
                  >
                    {qtd}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Aviso de regra de bloqueio ao mover */}
      {avisoBloqueio && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-950"
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-amber-700" aria-hidden="true" />
            {avisoBloqueio}
          </span>
          <button
            type="button"
            onClick={() => setAvisoBloqueio(null)}
            className="rounded-lg px-2 py-1 text-amber-800 hover:bg-amber-100"
          >
            Entendi
          </button>
        </div>
      )}

      {/* Estados: Carregando / Erro / Vazio / Conteúdo */}
      {carregando ? (
        <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white py-16 text-slate-500">
          <Loader2 size={24} className="animate-spin text-blue-600" aria-hidden="true" />
          <p className="text-sm font-medium">Carregando placas do laboratório...</p>
        </div>
      ) : erroCarga ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 py-12 text-center"
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
      ) : aba === 'andamento' && resultado.itens.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white py-14 text-center">
          <Inbox size={28} className="text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800">
            Nenhuma placa em andamento para este filtro
          </p>
          <p className="max-w-md text-xs text-slate-500">
            Limpe a busca ou o chip selecionado, ou clique em &ldquo;Nova placa&rdquo; para registrar uma entrada.
          </p>
          {(busca || recorte !== 'todas') && (
            <button
              type="button"
              onClick={() => {
                setBusca('');
                setRecorte('todas');
              }}
              className="mt-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : aba === 'andamento' ? (
        <KanbanPlacas
          placas={resultado.itens}
          papel={papel}
          podeVerFinanceiro={temFinanceiro}
          onAbrirPlaca={abrirDetalhePlaca}
          onMoverPlaca={handleMoverPlaca}
          onAvisoBloqueio={setAvisoBloqueio}
        />
      ) : (
        <ListaFinalizadasPlacas
          itens={resultado.itens}
          total={resultado.total}
          pagina={paginaFinalizadas}
          desfecho={desfecho}
          ano={anoFinalizadas}
          papel={papel}
          podeVerFinanceiro={temFinanceiro}
          onMudarDesfecho={(d) => {
            setDesfecho(d);
            setPaginaFinalizadas(1);
          }}
          onMudarAno={(novoAno) => {
            setAnoFinalizadas(novoAno);
            setPaginaFinalizadas(1);
          }}
          onMudarPagina={setPaginaFinalizadas}
          onAbrirPlaca={abrirDetalhePlaca}
        />
      )}

      {/* Modal de Nova Placa */}
      <NovaPlacaModal
        aberto={modalNovaAberto}
        atorNome={atorNome}
        onFechar={() => setModalNovaAberto(false)}
        onCriada={(nova) => {
          setModalNovaAberto(false);
          setChaveRecarga((c) => c + 1);
          setComprovanteRecemCriada(nova);
        }}
      />

      {/* Comprovante A4 automático após criar uma placa + atalho para Etiqueta */}
      {comprovanteRecemCriada && (
        <ComprovanteEntradaDocumento
          placa={comprovanteRecemCriada}
          onFechar={() => setComprovanteRecemCriada(null)}
          onAbrirEtiqueta={() => {
            const alvo = comprovanteRecemCriada;
            setComprovanteRecemCriada(null);
            setEtiquetaRecemCriada(alvo);
          }}
        />
      )}

      <EtiquetaPlacaModal
        placa={etiquetaRecemCriada}
        onFechar={() => setEtiquetaRecemCriada(null)}
      />

      {/* Gaveta de detalhe sincronizada com ?placa=<id> */}
      <PlacaDetalhes
        placaId={placaAbertaId}
        perfil={profile}
        onFechar={fecharDetalhePlaca}
        onTrocarPlaca={abrirDetalhePlaca}
        onListaAlterada={() => setChaveRecarga((c) => c + 1)}
      />
    </div>
  );
}
